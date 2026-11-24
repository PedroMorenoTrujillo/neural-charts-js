import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium } from '@playwright/test';

const bundle = await build({
  absWorkingDir: fileURLToPath(new URL('../', import.meta.url)),
  entryPoints: ['src/panels.ts'], bundle: true, write: false, format: 'iife',
  platform: 'browser', globalName: 'panels',
});
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setContent('<main id="host" style="width:960px"></main>');
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const results = await page.evaluate(() => {
    const host = document.getElementById('host');
    const found = [];
    for (const type of ['category', 'linear', 'time']) {
      const from = type === 'time' ? Date.UTC(2025, 0, 1) : 0;
      const step = type === 'time' ? 86400000 : 10;
      const ids = ['a', 'b', 'c', 'd', 'e'];
      const x = type === 'category' ? { type, values: ids.map(id => ({ id, label: id.toUpperCase() })) }
        : { type, domain: [from, from + step * 4], nice: false };
      const chart = {
        type: 'line', axes: { x, y: { type: 'linear', domain: [0, 100] } },
        series: ['sales', 'target'].map((id, series) => ({ id, name: id, data: ids.map((point, i) => ({
          id: point, x: type === 'category' ? point : from + step * i, y: 10 + i * 12 + series * 3,
        })) })),
      };
      const data = {
        panels: ['left', 'right', 'separate'].map(id => ({ id, data: chart })),
        viewportLinks: [{ id: 'shared', axis: 'x', panelIds: ['left', 'right'] }],
      };
      const options = {
        chart: { animation: { enabled: false }, height: 240, viewport: { axes: 'xy' } },
        panels: { right: { viewport: { axes: 'xy', value: { y: [10, 80] } } } },
      };
      const events = [], visibility = [], diagnostics = [];
      const result = panels.createChartPanels(host, data, options, {
        instanceId: 'panels-' + type,
        onViewportChange: event => events.push(event),
        onHiddenSeriesChange: event => visibility.push(event),
        onDiagnostic: event => diagnostics.push(event),
      });
      if (result.status === 'invalid') throw Error(type + ': ' + result.diagnostic.reason);
      const controller = result.value;
      const action = (id, name) => host.querySelector('[data-nc-panel="' + id + '"] [data-action="' + name + '"]');
      const rightY = controller.getViewport('right').y;
      const separateBefore = controller.getViewport('separate');
      const requestedX = type === 'category' ? { firstId: 'b', lastId: 'd' } : [from + step, from + step * 3];
      const changed = controller.setViewport('left', { x: requestedX });
      const linked = [controller.getViewport('left').x, controller.getViewport('right').x];
      const independent = controller.getViewport('separate');
      const rightYAfter = controller.getViewport('right').y;
      host.querySelector('[data-nc-panel="left"] [data-series="target"][data-action="legend"]').click();
      const hidden = ['left', 'right', 'separate'].map(id => controller.getHiddenSeriesIds(id));
      const refreshed = controller.update({
        ...data,
        panels: data.panels.map(panel => ({
          ...panel,
          data: { ...panel.data, series: panel.data.series.map(series => ({
            ...series, data: series.data.map(point => ({ ...point, y: point.y + 1 })),
          })) },
        })),
      }).status;
      const refreshedX = ['left', 'right'].map(id => controller.getViewport(id).x);
      const refreshedHidden = ['left', 'right'].map(id => controller.getHiddenSeriesIds(id));
      action('left', 'reset').click();
      const reset = [controller.getViewport('left').x, controller.getViewport('right').x];
      const resetY = controller.getViewport('right').y;
      const invalidGraph = { ...data, viewportLinks: [{ id: 'shared', axis: 'x', panelIds: ['left', 'missing'] }] };
      const rejected = controller.update(invalidGraph).status;
      const badX = type === 'category' ? { type, values: [...x.values].reverse() } : { ...x, domain: [from, from + step * 5] };
      const incompatible = panels.resolveChartPanels({
        ...data,
        panels: data.panels.map(panel => panel.id === 'right' ? { ...panel, data: { ...chart, axes: { ...chart.axes, x: badX } } } : panel),
      }, options);
      const stillMounted = host.querySelectorAll('[data-nc-web]').length;
      controller.destroy();
      found.push({
        type, changed: changed.status, linked, independent, separateBefore, rightY, rightYAfter, hidden, reset, resetY,
        refreshed, refreshedX, refreshedHidden, rejected, incompatible: incompatible.status === 'invalid' && incompatible.diagnostic.reason, stillMounted,
        destroyed: host.children.length === 0 && controller.getViewport('left') === undefined,
        requestedX, events, visibility, diagnostics,
      });
    }
    return found;
  });
  for (const result of results) {
    assert.equal(result.changed, 'ok');
    assert.deepEqual(result.linked, [result.requestedX, result.requestedX]);
    assert.deepEqual(result.independent, result.separateBefore);
    assert.deepEqual(result.rightY, [10, 80]);
    assert.deepEqual(result.rightYAfter, result.rightY);
    assert.deepEqual(result.resetY, result.rightY);
    assert.deepEqual(result.hidden, [['target'], [], []]);
    assert.equal(result.refreshed, 'ok');
    assert.deepEqual(result.refreshedX, [result.requestedX, result.requestedX]);
    assert.deepEqual(result.refreshedHidden, [['target'], []]);
    assert.deepEqual(result.reset[0], result.reset[1]);
    assert.equal(result.rejected, 'invalid');
    assert.equal(result.incompatible, 'INCOMPATIBLE_PANEL_VIEWPORT');
    assert.equal(result.stillMounted, 3);
    assert(result.destroyed);
    assert.deepEqual(result.events.map(event => [event.panelId, event.linkId]), [['left', 'shared'], ['left', 'shared']]);
    assert.deepEqual(result.visibility, [{ panelId: 'left', hiddenSeriesIds: ['target'] }]);
    assert.deepEqual(result.diagnostics, []);
  }
  assert.deepEqual(errors, []);
  console.log('Category, numeric and time panel linkage, independent visibility/Y, validation and teardown passed in Chromium.');
} finally {
  await browser.close();
}
