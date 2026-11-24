import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

// Run with browser/build campaigns idle. Preserve every repetition and baseline.
const root = path.resolve(import.meta.dirname, '..');
const baselinePath = path.join(root, 'artifacts/performance.json');
const sha = value => createHash('sha256').update(value).digest('hex');
const baselineBytes = fs.readFileSync(baselinePath), baseline = JSON.parse(baselineBytes);
const original = fs.readFileSync(path.join(root, 'tooling/benchmark.mjs'), 'utf8');
const repetitions = [];
const priorReport = path.join(root, 'artifacts/performance-comparison.json');
if (fs.existsSync(priorReport)) {
  const prior = JSON.parse(fs.readFileSync(priorReport));
  const directory = path.join(root, 'artifacts/performance-checkpoints', prior.core.sha256 + '-' + (prior.webArchiveSha256 ?? sha(fs.readFileSync(priorReport))).slice(0, 12));
  fs.mkdirSync(directory, { recursive: true });
  for (const filename of ['performance-comparison.json', ...[1, 2, 3].map(index => 'performance-pure-repeat-' + index + '.json')]) {
    const source = path.join(root, 'artifacts', filename), destination = path.join(directory, filename);
    if (fs.existsSync(source) && !fs.existsSync(destination)) fs.copyFileSync(source, destination);
  }
}
fs.mkdirSync(path.join(root, 'work'), { recursive: true });
for (let index = 1; index <= 3; index++) {
  const filename = 'performance-pure-repeat-' + index + '.json';
  const script = original.replace("'artifacts/performance.json'", JSON.stringify('artifacts/' + filename));
  assert.notEqual(script, original, 'Only the output path changes');
  const scriptPath = path.join(root, 'work/benchmark-repeat.mjs');
  fs.writeFileSync(scriptPath, script);
  execFileSync(process.execPath, [scriptPath], { cwd: root, stdio: 'pipe' });
  repetitions.push(JSON.parse(fs.readFileSync(path.join(root, 'artifacts', filename))));
}
assert.equal(sha(fs.readFileSync(baselinePath)), sha(baselineBytes));
const comparisons = baseline.results.filter(result => result.status === 'MEASURED').flatMap(previous => {
  const matches = repetitions.map(run => run.results.find(result => result.type === previous.type && result.countPerSeries === previous.countPerSeries && result.seriesCount === previous.seriesCount));
  return Object.keys(previous.milliseconds).map(phase => {
    const prior = previous.milliseconds[phase], current = matches.map(result => result.milliseconds[phase]);
    return { type: previous.type, points: previous.logicalPoints, phase, baseline: prior, repetitions: current,
      svgElements: { baseline: previous.svgElements, current: matches[0].svgElements },
      p95DeltaPercent: current.map(value => (value.p95 / prior.p95 - 1) * 100),
      reproducibleOver20Percent: current.every(value => value.p95 > prior.p95 * 1.2) };
  });
});
const report = { recordedAt: new Date().toISOString(), baselineSha256: sha(baselineBytes), scriptSha256: sha(original), webArchiveSha256: JSON.parse(fs.readFileSync(path.join(root, 'artifacts/verification.json'))).archiveSha256, core: JSON.parse(fs.readFileSync(path.join(root, 'docs/core-candidate.json'))),
  method: 'Three sequential repetitions, same deterministic scenarios and 15 samples/3 warmups, only output path changed. All repetitions retained; no favorable sample selected. Absolute submillisecond timings and changed SVG node counts are reported separately from large-dataset planning.', comparisons };
fs.writeFileSync(path.join(root, 'artifacts/performance-comparison.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({comparisons: comparisons.length, reproducibleOver20: comparisons.filter(result => result.reproducibleOver20Percent).map(result => ({type: result.type, points: result.points, phase: result.phase, p95: result.repetitions.map(value => value.p95)}))}));
