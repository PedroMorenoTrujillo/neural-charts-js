import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { planWebChart } from '../dist/index.js';
import { chartSvg } from '../dist/svg.js';

const root = path.resolve(import.meta.dirname, '..');
const samples = 15, results = [];
const quantile = (values, p) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * p) - 1];
for (const [type, count, seriesCount] of [['line', 1000, 1], ['line', 5000, 1], ['line', 10000, 1], ['line', 50000, 1], ['column', 10, 3], ['column', 64, 3], ['column', 100, 3], ['column', 1000, 3], ['scatter', 5000, 1]]) {
  const category = type === 'column';
  const data = Object.freeze({ type, axes: { x: category ? { type: 'category', values: Array.from({ length: count }, (_, i) => ({ id: 'p' + i, label: 'Category ' + i })) } : { type: 'linear' }, y: { type: 'linear' } }, series: Array.from({ length: seriesCount }, (_, s) => ({ id: 's' + s, name: 'Series ' + s, data: Array.from({ length: count }, (_, i) => ({ id: 'p' + i, x: category ? 'p' + i : i, y: Math.sin(i / 17 + s) * 40 + 50 })) })) });
  const options = { title: type + ' deterministic baseline', appearance: { markers: count <= 1000 } }, timing = { planning: [], serialization: [] };
  let svg = '', observations = 0, rejected;
  for (let sample = -3; sample < samples; sample++) {
    const start = performance.now(), frame = planWebChart(data, options, { width: 900, height: 380 }), planned = performance.now();
    if (frame.status === 'invalid' && (count === 50000 && frame.diagnostic.reason === 'INPUT_LIMIT' || type === 'column' && count > 64 && frame.diagnostic.reason === 'LABEL_LIMIT')) { rejected = frame.diagnostic; break; }
    assert.equal(frame.status, 'ok', JSON.stringify(frame.status === 'invalid' ? frame : null));
    svg = chartSvg(frame.value, options, 'benchmark'); observations = frame.value.observations.length;
    const serialized = performance.now();
    if (sample >= 0) { timing.planning.push(planned - start); timing.serialization.push(serialized - planned); }
  }
  results.push(rejected ? { type, logicalPoints: count * seriesCount, status: 'REJECTED_BY_PUBLIC_CORE_LIMIT', diagnostic: rejected } : { type, status: 'MEASURED', countPerSeries: count, seriesCount, logicalPoints: count * seriesCount, observations, svgBytes: Buffer.byteLength(svg), svgElements: (svg.match(/<[a-z][^/!> ]*/g) ?? []).length, milliseconds: Object.fromEntries(Object.entries(timing).map(([phase, values]) => [phase, { p50: quantile(values, .5), p95: quantile(values, .95), samples }])) });
  console.log((rejected ? 'Rejected by public Core capacity: ' : 'Measured ') + type + ' ' + count * seriesCount + ' logical points');
}
fs.mkdirSync(path.join(root, 'artifacts'), { recursive: true });
fs.writeFileSync(path.join(root, 'artifacts/performance.json'), JSON.stringify({ recordedAt: new Date().toISOString(), environment: { node: process.version, os: os.platform(), arch: os.arch(), cpu: os.cpus()[0]?.model }, dataset: 'Deterministic sine wave; original values retained; no historical benchmark changed', scope: 'Pure planning plus SVG serialization. Browser render, gestures, heap retention and all-family performance certification are separate pending gates.', results }, null, 2));
