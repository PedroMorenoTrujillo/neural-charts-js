import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const tests = (await readdir(new URL('../tests/', import.meta.url)))
  .filter(name => name.endsWith('.test.mjs'))
  .map(name => 'tests/' + name);
for (const args of [
  ['--test', '--test-reporter=dot', ...tests],
  ['tooling/collect-browser-coverage.mjs'],
  ['tooling/verify-panels.mjs'],
  ['tooling/verify-drilldown.mjs'],
  ['tooling/verify-advanced.mjs'],
  ['tooling/verify-content.mjs'],
  ['tooling/verify-configuration.mjs'],
  ['tooling/verify-formatting-selection.mjs'],
  ['tooling/verify-chart-controls.mjs'],
  ['tooling/verify-runtime-boundaries.mjs'],
  ['tooling/verify-catalog-selection.mjs'],
  ['tooling/verify-touch-input.mjs'],
]) {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
