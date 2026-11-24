import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { gzipSync, brotliCompressSync } from 'node:zlib';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium, firefox, webkit } from '@playwright/test';
import { catalog } from './catalog.mjs';
import {packWeb} from './pack-web.mjs';

const root = path.resolve(import.meta.dirname, '..'), out = path.resolve(root,process.env.NEURAL_REVIEW_ARTIFACTS??'artifacts'), temp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'nc-js-consumer-')));
fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(path.join(temp, '.owner'), 'neural-charts-js-verify');
function run(command, args, cwd = root) { const result = spawnSync(command, args, { cwd, encoding: 'utf8', timeout: 300000, maxBuffer: 4 * 1024 * 1024 }); if (result.status !== 0) throw Error(command + ' failed: ' + result.stdout + result.stderr); return result.stdout; }
try {
  const archive = packWeb(), candidate = JSON.parse(fs.readFileSync(path.join(root, 'docs/core-candidate.json'))), coreArchive = path.join(root, candidate.archive);
  assert.equal(createHash('sha256').update(fs.readFileSync(coreArchive)).digest('hex'), candidate.sha256, 'Pinned owner candidate, not source-linked Core');
  fs.writeFileSync(path.join(temp, 'package.json'), JSON.stringify({ name: 'private-js-consumer', private: true, type: 'module' }));
  run('npm', ['install', archive, coreArchive, '--offline', '--ignore-scripts', '--no-audit', '--no-fund', '--cache', path.join(temp, 'empty-cache')], temp);
  for (const name of ['web', 'core']) assert(!fs.lstatSync(path.join(temp, 'node_modules/@neural-charts', name)).isSymbolicLink());
  const req = createRequire(path.join(temp, 'package.json')), core = JSON.parse(fs.readFileSync(req.resolve('@neural-charts/core/package.json')));
  assert.equal(core.version, candidate.version); for (const field of ['dependencies', 'optionalDependencies', 'peerDependencies']) assert.equal(Object.keys(core[field] ?? {}).length, 0);
  assert.throws(() => req.resolve('@neural-charts/web/src/owner'), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' });
  fs.writeFileSync(path.join(temp, 'types.ts'), `import type{ChartData,ChartOptions,ChartMountOptions}from'@neural-charts/web';\n${catalog.map((r, i) => `const data${i}=${JSON.stringify(r.data)} as const satisfies ChartData;\nconst options${i}=${JSON.stringify(r.options)} as const satisfies ChartOptions;`).join('\n')}\n// @ts-expect-error excluded family\nconst forbidden:ChartData={type:'gantt'};\n// @ts-expect-error style in data\nconst title:ChartData={type:'line',title:'No'};\n// @ts-expect-error business outputs are not DOM Events\nconst callback:ChartMountOptions={instanceId:'x',onPointActivate:(e:MouseEvent)=>{}};`);
  run(process.execPath, [path.join(root, 'node_modules/typescript/bin/tsc'), '--noEmit', '--strict', '--exactOptionalPropertyTypes', '--skipLibCheck', 'false', '--target', 'ES2022', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', 'types.ts'], temp);
  fs.writeFileSync(path.join(temp, 'pure.mjs'), `let reads=0;for(const key of['window','document','ResizeObserver','requestAnimationFrame'])Object.defineProperty(globalThis,key,{get(){reads++;throw Error(key)}});const m=await import('@neural-charts/web');if(m.chartTypes.length!==117||reads!==0)throw Error('Import safety');console.log(JSON.stringify({browserGlobalReads:reads,types:m.chartTypes.length}));`);
  const pure = JSON.parse(run(process.execPath, [path.join(temp, 'pure.mjs')], temp));
  const entry = path.join(temp, 'entry.js'); fs.writeFileSync(entry, `import{createChart}from'@neural-charts/web';globalThis.NC={createChart,cases:${JSON.stringify(catalog)}};`);
  const bundle = await build({ entryPoints: [entry], bundle: true, write: false, minify: true, platform: 'browser', format: 'iife', metafile: true, target: 'es2022' });
  assert(Object.keys(bundle.metafile.inputs).every(f => path.resolve(f).startsWith(temp + path.sep)), 'Only installed archives and local fixture entry');
  const browsers = [];
  for (const [name, engine] of Object.entries({ chromium, firefox, webkit })) {
    const browser = await engine.launch();
    try {
      const page = await browser.newPage({ viewport: { width: 1100, height: 1000 }, reducedMotion: 'reduce' }); const errors = [];
      page.on('pageerror', e => errors.push(e.message)); await page.setContent('<!doctype html><html lang="es"><title>Charts Web</title><body><main><h1>Web consumer</h1><div id="host" style="width:768px"><span id="foreign">Contenido del consumidor</span></div></main></body></html>');
      await page.addScriptTag({ content: bundle.outputFiles[0].text });
      const checks = [];
      for (const item of catalog) {
        const check = await page.evaluate(key => {
          const item = NC.cases.find(c => c.family + '/' + c.id === key), host = document.getElementById('host'), events = [], assert = (v, reason) => { if (!v) throw Error(key + ': ' + reason); };
          const before = JSON.stringify(item), mounted = NC.createChart(host, item.data, item.options, { instanceId: 'consumer', onPointActivate: e => events.push(e) });
          assert(mounted.status === 'ok', JSON.stringify(mounted));
          const chart = mounted.value, frame = chart.getFrame();
          const charts = host.querySelectorAll('[data-nc-web]');
          assert(charts.length === 1, 'One mounted chart');
          const [node] = charts;
          const plots = host.querySelectorAll('svg[role="img"][viewBox]');
          assert(plots.length === 1 && node.contains(plots[0]), 'One plot SVG owned by the chart');
          const [svg] = plots;
          assert(!/NaN|Infinity/.test(svg.outerHTML), 'Finite geometry');
          const zoomActions = ['zoom-in', 'zoom-out', 'reset'];
          const toolbarZoom = item.options.toolbar?.actions.some(action => action === 'zoom' || zoomActions.includes(action));
          const zoom = !!frame.viewport && (item.options.viewport?.controls !== false || toolbarZoom);
          const zoomGroups = node.querySelectorAll('[data-zoom-position]');
          assert(zoomGroups.length === (zoom ? 1 : 0), 'One zoom group when enabled');
          if (zoom) {
            const [zoomGroup] = zoomGroups;
            const controls = [...zoomGroup.querySelectorAll('button')];
            const position = item.options.viewport?.zoom?.position ?? 'toolbar';
            assert(zoomGroup.dataset.zoomPosition === position, 'Zoom group uses the configured position');
            assert(controls.length === zoomActions.length && controls.every((control, index) =>
              control.dataset.action === zoomActions[index] && control.getAttribute('aria-label')), 'All zoom actions have accessible names');
          }
          assert(!node.querySelector('[data-action^="pan-"]'), 'No standalone pan buttons');
          const primitives = frame.series.reduce((n, s) => n + (s.commands?.length ?? 0) + (s.areaCommands?.length ?? 0) + (s.bars?.length ?? 0) + (s.circles?.length ?? 0) + (s.cells?.length ?? 0) + (s.pictorialFills?.length ?? 0) + (s.textGlyphs?.length ?? 0) + (s.parts?.reduce((m,p)=>m+(p.commands?.length??0)+(p.bars?.length??0),0)??0), 0);
          const ink = svg.querySelectorAll('[data-layer="marks"] :is(path, rect, circle, polygon, text)').length;
          assert(!primitives || ink > 0, 'Actual projected primitives are painted');
          if (frame.observations.length) { node.focus(); node.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); node.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); assert(events.length === 1, 'Keyboard output exactly once'); const tooltip = node.querySelector('[role="tooltip"]'); if (!tooltip.hidden) { const heading = node.querySelector('h2'), description = heading.nextElementSibling; assert(tooltip.getBoundingClientRect().top >= Math.max(heading.getBoundingClientRect().bottom, description.hidden ? 0 : description.getBoundingClientRect().bottom), 'Detail protects title and description'); } }
          if (key === 'treegraph/basic' && !item.data.groups?.some(group => group.id === 'nodes')) {
            for (const [locale, name] of [['en', 'Nodes'], ['es', 'Nodos'], ['en', 'Nodes']]) {
              assert(chart.updateOptions({ ...item.options, locale }).status === 'ok', 'Graph locale update');
              assert(chart.getFrame().legend.some(group => group.id === 'nodes' && group.name === name), 'Implicit group follows the current locale');
            }
          }
          assert(chart.update(item.data, { ...item.options, theme: 'dark' }).status === 'ok', 'Immutable presentation update');
          assert(JSON.stringify(item) === before, 'Consumer data unchanged');
          const invalid = chart.update(item.data, { ...item.options, theme: 'bad' }); assert(invalid.status === 'invalid', 'Invalid input contained');
          assert(!new DOMParser().parseFromString(chart.exportSvg(), 'image/svg+xml').querySelector('parsererror'), 'Valid export');
          globalThis.current = chart; return { key, observations: frame.observations.length, ink, keyboard: !!frame.observations.length, wordcloud: frame.wordcloudLayout?.displayedWords ?? null };
        }, item.family + '/' + item.id);
        if (item.id === 'basic') { const directory = path.join(out, 'visual', name); fs.mkdirSync(directory, { recursive: true }); await page.locator('[data-nc-web]').screenshot({ path: path.join(directory, item.family + '-dark.png') }); }
        await page.evaluate(() => { current.destroy(); current.destroy(); if (document.querySelector('[data-nc-web]') || !document.getElementById('foreign')) throw Error('Ownership cleanup'); });
        checks.push(check);
      }
      const resources = await page.evaluate(() => {
        const host = document.getElementById('host'), item = NC.cases.find(c => c.family === 'line' && c.id === 'basic'), NativeRO = window.ResizeObserver, request = window.requestAnimationFrame, cancel = window.cancelAnimationFrame;
        let observers = 0, late = 0; const frames = new Set();
        window.ResizeObserver = class { constructor(fn) { this.ro = new NativeRO(fn); this.active = false; } observe(el) { if (!this.active) { observers++; this.active = true; } this.ro.observe(el); } disconnect() { if (this.active) { observers--; this.active = false; } this.ro.disconnect(); } };
        window.requestAnimationFrame = fn => { const id = request.call(window, t => { frames.delete(id); fn(t); }); frames.add(id); return id; }; window.cancelAnimationFrame = id => { frames.delete(id); cancel.call(window, id); };
        try { for (let i = 0; i < 100; i++) { const r = NC.createChart(host, item.data, item.options, { instanceId: 'cycle', onPointActivate: () => late++ }); if (r.status !== 'ok') throw Error('Cycle create'); const stale = host.querySelector('[data-nc-web]'); stale.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); r.value.destroy(); stale.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); } if (observers || frames.size || late) throw Error('Retained resources or late event'); return { cycles: 100, observers, frames: frames.size, late }; }
        finally { window.ResizeObserver = NativeRO; window.requestAnimationFrame = request; window.cancelAnimationFrame = cancel; }
      });
      assert.deepEqual(errors, []); browsers.push({ name, version: browser.version(), checks, resources }); console.log('PASS: ' + name + ' ' + checks.length + ' actual SVG variants and100 resource cycles');
    } finally { await browser.close(); }
  }
  const sizes = [];
  for (const [name, contents] of [
    ['unused', "import{createChart}from'@neural-charts/web';globalThis.marker=1"],
    ['factory', "export{createChart}from'@neural-charts/web'"],
    ['line', "export{createLineChart}from'@neural-charts/web/cartesian'"],
    ['column', "export{createColumnChart}from'@neural-charts/web/cartesian'"],
    ['bar', "export{createBarChart}from'@neural-charts/web/cartesian'"],
    ['cartesian', "export{createCartesianChart}from'@neural-charts/web/cartesian'"],
    ['line-column', "export{createLineChart,createColumnChart}from'@neural-charts/web/cartesian'"],
    ['line-bar', "export{createLineChart,createBarChart}from'@neural-charts/web/cartesian'"],
    ['spline-area', "export{createCartesianChart}from'@neural-charts/web/cartesian'"],
    ['pie-donut-scatter', "export{createChart}from'@neural-charts/web'"],
    ['full-api', "export*from'@neural-charts/web'"],
    ['financial', "export{createFinancialChart}from'@neural-charts/web/financial'"],
    ['core-cartesian', "export{planCartesianChart}from'@neural-charts/core/cartesian'"],
    ['core-financial', "export{planFinancialChart}from'@neural-charts/core/financial'"],
    ['core-combined', "export{planChart}from'@neural-charts/core'"],
    ['server-export', "export{renderChartSvg,exportChartCsv}from'@neural-charts/web'"],
  ]) {
    const b = await build({ stdin: { contents, resolveDir: temp }, bundle: true, minify: true, write: false, metafile: true, platform: 'browser', format: 'esm', target: 'es2022' }), bytes = b.outputFiles[0].contents;
    if (['line', 'column', 'bar', 'cartesian'].includes(name)) assert(!Object.values(b.metafile.outputs).some(output => Object.entries(output.inputs).some(([file, contribution]) => contribution.bytesInOutput > 0 && /(?:plan\/(?:financial|radial|wordcloud(?:-source)?|networkgraph|log-scatter-source)\.|scatter\/(?:data|validate)\.)/.test(file))), 'Granular Cartesian import excludes unrelated engines, scatter validation and text preparation');
    fs.writeFileSync(path.join(out, 'bundle-' + name + '.json'), JSON.stringify(b.metafile, null, 2));
    if (name === 'unused') assert(bytes.length < 100); sizes.push({ name, raw: bytes.length, gzip: gzipSync(bytes).length, brotli: brotliCompressSync(bytes).length });
  }
  fs.writeFileSync(path.join(out, 'verification.json'), JSON.stringify({ status: 'PASS', core: core.version, archiveSha256: createHash('sha256').update(fs.readFileSync(archive)).digest('hex'), pure, typedRecipes: catalog.length, negativeTypes: 3, browsers, sizes, budgets: 'PENDING; generic Core retention remains visible', humanVisual: 'PENDING' }, null, 2));
} finally { assert.equal(fs.readFileSync(path.join(temp, '.owner'), 'utf8'), 'neural-charts-js-verify'); fs.rmSync(temp, { recursive: true, force: true }); }
