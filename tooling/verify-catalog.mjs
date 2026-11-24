import fs from 'node:fs';
import path from 'node:path';
import { planWebChart } from '../dist/index.js';
import { catalog } from './catalog.mjs';

const root = path.resolve(import.meta.dirname, '..'), checks = [];
for (const item of catalog) {
  const result = planWebChart(item.data, item.options, { width: 768, height: 360 }, [], {
    // Deterministic measurement fixture for pure transport tests only. Browser SVG metrics are a separate gate.
    measureWords: requests => requests.map(r => ({ ...r, width: r.text.length * r.fontSize * .65, height: r.fontSize * 1.4 })),
  });
  checks.push({ family: item.family, id: item.id, status: result.status, ...(result.status === 'invalid' ? { diagnostic: result.diagnostic } : { observations: result.value.observations.length, series: result.value.series.length }) });
}
fs.mkdirSync(path.join(root, 'artifacts'), { recursive: true });
fs.writeFileSync(path.join(root, 'artifacts/catalog-planning.json'), JSON.stringify({ measurement: 'Pure fixture only; no visual certification', checks }, null, 2));
const failures = checks.filter(c => c.status === 'invalid');
console.log(JSON.stringify({ variants: checks.length, invalid: failures.length, failures }));
if (failures.length) process.exitCode = 1;
