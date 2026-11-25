import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium } from '@playwright/test';
import { openInstrumentedPage } from './browser-modules.mjs';

const bundle = process.env.NODE_V8_COVERAGE ? undefined : await build({
  absWorkingDir: new URL('../', import.meta.url).pathname,
  entryPoints: ['src/drilldown.ts'], bundle: true, write: false, format: 'iife',
  platform: 'browser', globalName: 'drilldown',
});
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const markup = '<main id="host" style="width:720px"></main>';
  let writeCoverage;
  if (bundle) {
    await page.setContent(markup);
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
  } else {
    writeCoverage = await openInstrumentedPage(page, markup);
    await page.evaluate(async () => { globalThis.drilldown = await import('/web/drilldown.js'); });
  }
  const result = await page.evaluate(async () => {
    const host = document.getElementById('host');
    const values = ['a', 'b', 'c', 'd'].map(id => ({ id, label: id.toUpperCase() }));
    const data = {
      rootId: 'overview',
      nodes: [
        { id: 'overview', data: { type: 'column', axes: { x: { type: 'category', values }, y: { type: 'linear' } }, series: [
          { id: 'sales', name: 'Sales', data: values.map(({ id }, index) => ({ id, x: id, y: index === 1 ? 0 : 20 + index })) },
          { id: 'target', name: 'Target', data: values.map(({ id }) => ({ id, x: id, y: 20 })) },
        ] } },
        { id: 'detail', data: { type: 'pie', data: [{ id: 'online', label: 'Online', value: 20 }, { id: 'store', label: 'Store', value: 10 }] } },
      ],
      links: [{ fromNodeId: 'overview', datumId: { seriesId: 'sales', pointId: 'b' }, toNodeId: 'detail' }],
    };
    const options = {
      chart: { animation: { enabled: false }, width: 640, height: 360 },
      nodes: { overview: { title: 'Overview', viewport: { axes: 'x' } }, detail: { title: 'Detail' } },
    };
    const navigated = [], diagnostics = [];
    const resolved = drilldown.resolveChartDrilldownRoot(data, options);
    const invalid = drilldown.createChartDrilldown(host, { ...data, rootId: 'unknown' }, options, { instanceId: 'invalid' });
    const emptyAfterInvalid = host.children.length === 0;
    const mounted = drilldown.createChartDrilldown(host, data, options, {
      instanceId: 'drilldown-test',
      onNavigationChange: event => navigated.push(event.nodeId),
      onDiagnostic: error => diagnostics.push(error.reason),
    });
    if (mounted.status === 'invalid') throw Error(mounted.diagnostic.reason);
    const controller = mounted.value;
    const owner = () => host.querySelector('[data-nc-web]');
    const action = name => host.querySelector('[data-action="' + name + '"]');
    const legend = () => host.querySelector('[data-series="target"][data-action="legend"]');
    const enter = host.querySelector('[data-drilldown-enter]');
    const back = host.querySelector('[data-drilldown-back]');
    const key = value => owner().dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true }));
    const categoryLabels = () => [...owner().querySelectorAll('svg [data-axis-label] title')].map(node => node.textContent);
    const categoriesBefore = categoryLabels();
    legend().click();
    action('zoom-in').click();
    const categoriesZoomed = categoryLabels();
    owner().focus();
    key('Home');
    if (!owner().querySelector('[role=tooltip]').textContent.includes('B · Sales')) key('ArrowRight');
    const passive = enter.disabled && controller.getTrail().length === 1;
    key('Enter');
    const eligible = !enter.disabled && owner().querySelector('[role=tooltip]').textContent.includes(': 0');
    enter.click();
    const detail = {
      node: controller.getTrail().at(-1), type: owner().dataset.type,
      focused: document.activeElement === owner(), online: controller.exportCsv().value.includes('Online'),
      charts: host.querySelectorAll('[data-nc-web]').length,
    };
    const updated = controller.update(data, { ...options, nodes: { ...options.nodes, detail: { title: 'Updated detail' } } });
    const exportedSvg = controller.exportSvg();
    const exportedPng = await controller.exportPng({ pixelRatio: 1 });
    const png = [...new Uint8Array(await exportedPng.slice(0, 8).arrayBuffer())];
    back.click();
    const restored = {
      node: controller.getTrail().at(-1), type: owner().dataset.type, focused: document.activeElement === owner(),
      hidden: legend().getAttribute('aria-pressed'), categories: categoryLabels(),
    };
    const previous = owner();
    const malformed = controller.update(data, { ...options, nodes: { unknown: { title: 'No' } } });
    const retained = owner() === previous;
    controller.destroy();
    const destroyed = host.children.length === 0 && controller.back() === false;
    let destroyedSvg, destroyedPng;
    try { controller.exportSvg(); } catch (error) { destroyedSvg = error.message; }
    try { await controller.exportPng(); } catch (error) { destroyedPng = error.message; }
    return {
      resolved: resolved.status === 'ok' && resolved.value.data.type,
      invalid: invalid.status, emptyAfterInvalid, categoriesBefore, categoriesZoomed,
      passive, eligible, detail, restored, malformed: malformed.status, retained, destroyed, navigated, diagnostics,
      updated: updated.status, exportedSvg, png, destroyedSvg, destroyedPng,
      destroyedCsv: controller.exportCsv().diagnostic.reason,
      destroyedUpdate: controller.update(data).diagnostic.reason,
    };
  });
  assert.equal(result.resolved, 'column');
  assert.equal(result.invalid, 'invalid');
  assert(result.emptyAfterInvalid && result.passive && result.eligible, JSON.stringify(result));
  assert.notDeepEqual(result.categoriesBefore, result.categoriesZoomed);
  assert.deepEqual(result.detail, { node: 'detail', type: 'pie', focused: true, online: true, charts: 1 });
  assert.equal(result.updated, 'ok');
  assert.match(result.exportedSvg, /Updated detail/);
  assert.deepEqual(result.png, [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.deepEqual(result.restored, { node: 'overview', type: 'column', focused: true, hidden: 'false', categories: result.categoriesZoomed });
  assert.deepEqual(result.navigated, ['detail', 'overview']);
  assert.equal(result.malformed, 'invalid');
  assert(result.retained && result.destroyed);
  for (const diagnostic of [result.destroyedSvg, result.destroyedPng, result.destroyedCsv, result.destroyedUpdate]) {
    assert.equal(diagnostic, 'DESTROYED');
  }
  assert.deepEqual(result.diagnostics, []);
  const boundary = await page.evaluate(() => {
    const host = document.getElementById('host');
    const rootData = {
      type: 'column', axes: { x: { type: 'category', values: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }] }, y: { type: 'linear' } },
      series: [{ id: 's', name: 'Source', data: [{ id: 'first', x: 'a', y: 0 }, { id: 'last', x: 'b', y: 10 }] }],
    };
    const invalid = { ...rootData, series: [{ ...rootData.series[0], data: [{ id: 'first', x: 'a', y: 'invalid' }] }] };
    const child = { type: 'pie', data: [{ id: 'item', label: 'Item', value: 4 }] };
    const data = {
      rootId: 'root',
      nodes: [{ id: 'root', data: rootData }, { id: 'child', data: invalid }],
      links: [{ fromNodeId: 'root', datumId: { seriesId: 's', pointId: 'first' }, toNodeId: 'child' }],
    };
    const badRoot = { ...data, nodes: [{ id: 'root', data: invalid }, { id: 'child', data: child }] };
    const initialFailure = drilldown.createChartDrilldown(host, badRoot, {}, { instanceId: 'invalid-visible-root' });
    const emptyAfterFailure = host.childElementCount === 0;
    const notices = [], navigated = [];
    const mounted = drilldown.createChartDrilldown(host, data, {}, {
      instanceId: 'atomic-drilldown',
      onDiagnostic: notice => notices.push(notice),
      onNavigationChange: event => navigated.push(event.nodeId),
    });
    if (mounted.status !== 'ok') throw Error(JSON.stringify(mounted.diagnostic));
    const controller = mounted.value;
    const root = host.querySelector('[data-nc-web]');
    const enter = host.querySelector('[data-drilldown-enter]');
    const selectFirst = () => {
      const active = host.querySelector('[data-nc-web]');
      for (const key of ['Home', 'Enter']) active.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    };
    selectFirst();
    const childFailure = controller.enter();
    const retained = root === host.querySelector('[data-nc-web]');
    const repaired = controller.update({ ...data, nodes: [data.nodes[0], { id: 'child', data: child }] });
    if (enter.disabled) selectFirst();
    const available = !enter.disabled;
    const success = controller.enter();
    const childType = host.querySelector('[data-nc-web]').dataset.type;
    const removed = controller.update({ ...data, nodes: [data.nodes[0]], links: [] });
    const fallback = controller.getTrail();
    const nothingToEnter = controller.enter();
    controller.destroy();
    controller.destroy();
    return { initialFailure: initialFailure.status, emptyAfterFailure, childFailure, retained, notices,
      repaired: repaired.status, available, success, childType, removed: removed.status, fallback, nothingToEnter, navigated };
  });
  assert.equal(boundary.initialFailure, 'invalid');
  assert(boundary.emptyAfterFailure && boundary.retained);
  assert.equal(boundary.childFailure, false);
  assert.equal(boundary.notices.length, 1);
  assert.equal(boundary.repaired, 'ok');
  assert(boundary.available && boundary.success);
  assert.equal(boundary.childType, 'pie');
  assert.equal(boundary.removed, 'ok');
  assert.deepEqual(boundary.fallback, ['root']);
  assert.equal(boundary.nothingToEnter, false);
  assert.deepEqual(boundary.navigated, ['child', 'root']);
  assert.deepEqual(errors, []);
  await writeCoverage?.('drilldown.js');
  console.log('Drilldown selection, view restoration, focus, export, validation and teardown passed in Chromium.');
} finally {
  await browser.close();
}
