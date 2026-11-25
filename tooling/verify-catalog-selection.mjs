import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { openInstrumentedPage } from './browser-modules.mjs';

const catalogPath = resolve(process.env.NEURAL_CHARTS_CATALOG ??
  resolve(import.meta.dirname, '../../charts-showcase-canonical/catalog/recipes.json'));
const catalogue = JSON.parse(await readFile(catalogPath, 'utf8'));
const basics = catalogue.filter(item => item.id === 'basic');
assert(basics.length > 60);

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 430, height: 850 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const writeCoverage = await openInstrumentedPage(page, '<main style="width:390px"><div id="case"></div></main>');
  await page.evaluate(async () => { window.createCase = (await import('/web/index.js')).createChart; });
  const results = [];
  for (const [index, item] of basics.entries()) {
    results.push(await page.evaluate(({ item, index }) => {
      const host = document.querySelector('#case');
      const title = item.title;
      const instanceId = 'selection-case-' + index;
      const events = [];
      const options = {
        ...item.options, title, width: 375, locale: 'es', direction: 'rtl',
        animation: { enabled: false }, tooltip: { enabled: true, content: 'point', placement: 'docked', pinnable: true },
      };
      const result = window.createCase(host, item.data, options, {
        instanceId, onPointActivate: event => events.push({ id: event.id, source: event.source }),
      });
      const verify = (condition, reason) => {
        if (!condition) throw Error(item.family + ': ' + reason);
      };
      verify(result.status === 'ok', JSON.stringify(result.diagnostic));
      const chart = result.value;
      const same = (a, b) => a?.seriesId === b?.seriesId && a?.pointId === b?.pointId;
      try {
        const chartRoot = host.querySelector('[data-nc-web]');
        const observations = chart.getFrame().observations;
        verify(chartRoot.getAttribute('aria-label') === title, 'the chart title must be its accessible name');
        verify(chartRoot.getAttribute('dir') === 'rtl' && chartRoot.lang === 'es', 'language or direction not applied');
        const press = (key, ctrlKey = false) =>
          chartRoot.dispatchEvent(new KeyboardEvent('keydown', { key, ctrlKey, bubbles: true, cancelable: true }));
        if (observations.length) {
          press('Home');
          press('Enter');
          verify(same(chart.getSelection()[0], observations[0].id), 'Home then Enter must select the first source datum');
          verify(same(events[0]?.id, observations[0].id) && events[0].source === 'keyboard', 'first activation must retain its source identity');
          const tooltip = chartRoot.querySelector('[role="tooltip"]');
          verify(!tooltip.hidden && tooltip.textContent.trim().length > 0, 'the selected datum must have visible details');
          press('End', true);
          press('Enter');
          const last = observations.at(-1);
          if (observations.length > 1) {
            verify(same(chart.getSelection()[0], last.id), 'Control+End must select the last source datum');
          } else {
            verify(chart.getSelection().length === 0, 'repeating selection must clear the single datum');
            press('Home');
          }
          const pin = chartRoot.querySelector('[data-action="tooltip-pin"]');
          verify(!pin.hidden, 'the selected observation must make pinning available');
          pin.click();
          verify(pin.getAttribute('aria-pressed') === 'true', 'pin must expose the pressed state');
          press('Escape');
          verify(pin.getAttribute('aria-pressed') === 'false', 'Escape must unpin without trapping focus');
        }
        const svg = new DOMParser().parseFromString(chart.exportSvg({ composition: 'chart' }), 'image/svg+xml');
        verify(!svg.querySelector('parsererror') && svg.querySelector('title').textContent === title, 'the chart SVG must remain valid after selection');
        return { family: item.family, count: observations.length, activations: events.length };
      } finally {
        chart.destroy();
        verify(host.childElementCount === 0, 'the owner retained DOM after destroy');
      }
    }, { item, index }));
  }
  assert.equal(results.length, basics.length);
  assert(results.filter(result => result.activations === 2).length > 55);
  for (const family of ['pie', 'treemap']) {
    const item = basics.find(candidate => candidate.family === family);
    assert(item);
    const state = await page.evaluate(item => {
      const host = document.querySelector('#case');
      const data = item.data;
      const options = { ...item.options, locale: 'en', accessibility: { announceDataChanges: true } };
      const mounted = createCase(host, data, options, { instanceId: 'source-refresh' });
      if (mounted.status !== 'ok') throw Error(JSON.stringify(mounted.diagnostic));
      const chart = mounted.value;
      const root = host.querySelector('[data-nc-web]');
      const press = (key, ctrlKey = false) => root.dispatchEvent(new KeyboardEvent('keydown', { key, ctrlKey, bubbles: true, cancelable: true }));
      try {
        if (item.family === 'treemap') press('End', true);
        else press('Home');
        press('Enter');
        const id = chart.getSelection()[0];
        if (!id) throw Error('The original datum was not selected');
        const modify = (node, remove) => {
          if (node.id === id.pointId) return remove ? null : { ...node, label: 'Renamed original' };
          if (node.children) return { ...node, children: node.children.map(child => modify(child, remove)).filter(Boolean) };
          return node;
        };
        const refresh = remove => chart.update(item.family === 'pie'
          ? { ...data, data: data.data.map(node => modify(node, remove)).filter(Boolean) }
          : { ...data, root: modify(data.root, remove) });
        const update = refresh(false);
        const retained = chart.getSelection();
        const label = chart.getFrame().observations.find(point => point.id.pointId === id.pointId)?.label;
        const notice = root.querySelector('[role="status"]').textContent;
        const removal = refresh(true);
        return { id, retained, label, notice, update: update.status, removal: removal.status,
          removalDiagnostic: removal.diagnostic, after: chart.getSelection() };
      } finally {
        chart.destroy();
      }
    }, item);
    assert.equal(state.update, 'ok');
    assert.deepEqual(state.retained, [state.id]);
    assert.equal(state.label, 'Renamed original');
    assert.match(state.notice, /updated/i);
    assert.equal(state.removal, 'ok', family + ' ' + JSON.stringify(state));
    assert.deepEqual(state.after, []);
  }
  await page.evaluate(() => {
    const data = {
      type: 'line',
      axes: { x: { type: 'category', values: [{ id: 'a', label: 'North' }, { id: 'b', label: 'South' }] }, y: { type: 'linear' } },
      series: [
        { id: 'actual', name: 'Actual', data: [{ id: 'zero', x: 'a', y: 0 }, { id: 'south', x: 'b', y: 4 }] },
        { id: 'forecast', name: 'Forecast', data: [{ id: 'estimate', x: 'b', y: 7 }] },
      ],
    };
    const options = { locale: 'en', height: 230, tooltip: { content: 'shared', placement: 'below', pinnable: true } };
    const mounted = createCase(document.querySelector('#case'), data, options, { instanceId: 'grouped-keyboard' });
    if (mounted.status !== 'ok') throw Error(JSON.stringify(mounted.diagnostic));
    window.keyboardChart = mounted.value;
  });
  const grouped = page.locator('#case [data-nc-web]');
  const detail = grouped.getByRole('tooltip');
  await grouped.press('ArrowDown');
  assert.match(await detail.innerText(), /North[\s\S]*Actual: 0[\s\S]*Forecast: Missing measurement/);
  await grouped.press('ArrowDown');
  assert.match(await detail.innerText(), /South[\s\S]*Actual: 4[\s\S]*Forecast: 7/);
  await grouped.press('Enter');
  assert.deepEqual(await page.evaluate(() => keyboardChart.getSelection()), [{ seriesId: 'forecast', pointId: 'estimate' }]);
  await grouped.press('ArrowUp');
  await grouped.press('Enter');
  assert.deepEqual(await page.evaluate(() => keyboardChart.getSelection()), [{ seriesId: 'actual', pointId: 'south' }]);
  await grouped.press('ArrowLeft');
  await grouped.evaluate(node => node.blur());
  await detail.evaluate(node => {
    const drawing = node.closest('[data-nc-web]').querySelector('svg').parentElement;
    drawing.dispatchEvent(new PointerEvent('pointerleave', { relatedTarget: node }));
  });
  assert.match(await detail.innerText(), /North/);
  await detail.evaluate(node => node.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  await detail.waitFor({ state: 'hidden' });
  assert.equal(await grouped.evaluate(node => node === document.activeElement), true);
  await page.evaluate(() => keyboardChart.destroy());
  assert.deepEqual(errors, []);
  await writeCoverage();
  console.log('Chromium · narrow RTL catalogue, exact keyboard selection, tooltip pinning and SVG export for ' + results.length + ' recipes');
} finally {
  await browser.close();
}
