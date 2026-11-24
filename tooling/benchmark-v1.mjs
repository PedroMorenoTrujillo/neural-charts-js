import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';
import { chromium, firefox, webkit } from '@playwright/test';
import { catalog } from './catalog.mjs';
import assert from 'node:assert/strict';
import os from 'node:os';
import {createHash} from 'node:crypto';

const root = path.resolve(import.meta.dirname, '..'), results = [], samples = 10;
const scenarios = catalog.filter(item => item.id === 'basic').map(item => ({ ...item, options: { ...item.options, animation: { enabled: false } } }));
for (const [type, count, seriesCount] of [['line', 1000, 1], ['line', 10000, 1], ['line', 50000, 1], ['scatter', 10000, 1], ['column', 1000, 3], ['column', 1000, 5]]) {
  const category = type === 'column';
  const data = { type, axes: { x: category ? { type: 'category', values: Array.from({ length: count }, (_, i) => ({ id: 'p' + i, label: 'Category ' + i })) } : { type: 'linear' }, y: { type: 'linear' } }, series: Array.from({ length: seriesCount }, (_, s) => ({ id: 's' + s, name: 'Series ' + s, data: Array.from({ length: count }, (_, i) => ({ id: 'p' + i, x: category ? 'p' + i : i, y: Math.sin(i / 17 + s) * 40 + 50 })) })) };
  scenarios.push({ family: type, id: 'capacity-' + count, data, options: { capacity: { points: count * seriesCount, categories: category ? count : 64 }, animation: { enabled: false }, appearance: { markers: false }, viewport: { axes: 'xy' } } });
}
const bundle = await build({ stdin: { contents: "import*as api from'@neural-charts/web';globalThis.NC=api;", resolveDir: root }, bundle: true, write: false, minify: true, format: 'iife', platform: 'browser' });
const provenance={bundleSha256:createHash('sha256').update(bundle.outputFiles[0].contents).digest('hex'),core:JSON.parse(fs.readFileSync(path.join(root,'docs/core-candidate.json'))),environment:{node:process.version,os:os.platform(),arch:os.arch(),cpu:os.cpus()[0]?.model},viewport:{width:1100,height:800}};
provenance.webArchiveSha256 = JSON.parse(fs.readFileSync(path.join(root, 'artifacts/verification.json'))).archiveSha256;
for (const [name, engine] of Object.entries({ chromium, firefox, webkit })) {
  const browser = await engine.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 800 }, reducedMotion: 'reduce' });
    await page.setContent('<!doctype html><html lang="en"><title>Chart performance</title><body><div id="host" style="width:960px"></div></body></html>');
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    for (const scenario of scenarios) {
      const result = await page.evaluate(({ item, samples }) => {
        const host = document.getElementById('host'), times = { initial: [], update: [], resize: [], selection: [], zoom: [], pan: [], svg: [], csv: [] };
        let nodes = 0, observations = 0;
        for (let sample = -2; sample < samples; sample++) {
          const measure = (key, action) => { const start = performance.now(); action(); host.getBoundingClientRect(); if (sample >= 0) times[key].push(performance.now() - start); };
          let chart;
          measure('initial', () => { const result = NC.createChart(host, item.data, item.options, { instanceId: 'benchmark' }); if (result.status !== 'ok') throw Error(JSON.stringify(result)); chart = result.value; });
          observations = chart.getFrame().observations.length; nodes = host.querySelectorAll('svg *').length;
          measure('update', () => { const result = chart.update(structuredClone(item.data), item.options); if (result.status !== 'ok') throw Error(JSON.stringify(result)); });
          measure('resize', () => { const result = chart.update(item.data, { ...item.options, width: 760 }); if (result.status !== 'ok') throw Error(JSON.stringify(result)); });
          const node = host.querySelector('[data-nc-web]');
          measure('selection', () => { node.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); node.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); });
          if (item.options.viewport) { measure('zoom', () => node.dispatchEvent(new KeyboardEvent('keydown', { key: '+', bubbles: true }))); measure('pan', () => node.dispatchEvent(new KeyboardEvent('keydown', {key:'ArrowRight', shiftKey:true, bubbles:true}))); }
          measure('svg', () => chart.exportSvg()); measure('csv', () => chart.exportCsv()); chart.destroy();
          if (host.querySelector('[data-nc-web]')) throw Error('Retained owner');
        }
        const q = (values, p) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * p) - 1];
        return { nodes, observations, milliseconds: Object.fromEntries(Object.entries(times).filter(([, values]) => values.length).map(([phase, values]) => [phase, { p50: q(values, .5), p95: q(values, .95), samples: values.length }])) };
      }, { item: scenario, samples });
      assert(result.nodes > 0); results.push({ browser: name, browserVersion:browser.version(), family: scenario.family, variant: scenario.id, ...result });
    }
    console.log('Measured ' + name + ': ' + scenarios.length + ' real-browser scenarios, including 50,000 logical points.');
  } finally { await browser.close(); }
}
const output = path.join(root, 'artifacts/performance-v1.json');
if (fs.existsSync(output)) {
  const prior = JSON.parse(fs.readFileSync(output));
  const checkpoint = path.join(root, 'artifacts/performance-checkpoints', prior.core.sha256 + '-' + prior.bundleSha256.slice(0, 12));
  fs.mkdirSync(checkpoint, { recursive: true });
  const file = path.join(checkpoint, 'performance-v1.json');
  if (!fs.existsSync(file)) fs.copyFileSync(output, file);
}
fs.writeFileSync(output, JSON.stringify({ recordedAt: new Date().toISOString(), ...provenance, samples, scope: 'Synchronous API plus forced layout; not a claim about sustained frame rate or retained heap. Separate historical sine-wave baseline is unchanged.', results }, null, 2));
