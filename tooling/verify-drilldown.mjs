import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium } from '@playwright/test';

const bundle = await build({
  absWorkingDir: new URL('../', import.meta.url).pathname,
  entryPoints: ['src/drilldown.ts'], bundle: true, write: false, format: 'iife',
  platform: 'browser', globalName: 'drilldown',
});
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setContent('<main id="host" style="width:720px"></main>');
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const result = await page.evaluate(() => {
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
    return {
      resolved: resolved.status === 'ok' && resolved.value.data.type,
      invalid: invalid.status, emptyAfterInvalid, categoriesBefore, categoriesZoomed,
      passive, eligible, detail, restored, malformed: malformed.status, retained, destroyed, navigated, diagnostics,
    };
  });
  assert.equal(result.resolved, 'column');
  assert.equal(result.invalid, 'invalid');
  assert(result.emptyAfterInvalid && result.passive && result.eligible, JSON.stringify(result));
  assert.notDeepEqual(result.categoriesBefore, result.categoriesZoomed);
  assert.deepEqual(result.detail, { node: 'detail', type: 'pie', focused: true, online: true, charts: 1 });
  assert.deepEqual(result.restored, { node: 'overview', type: 'column', focused: true, hidden: 'false', categories: result.categoriesZoomed });
  assert.deepEqual(result.navigated, ['detail', 'overview']);
  assert.equal(result.malformed, 'invalid');
  assert(result.retained && result.destroyed);
  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(errors, []);
  console.log('Drilldown selection, view restoration, focus, export, validation and teardown passed in Chromium.');
} finally {
  await browser.close();
}
