import test from 'node:test';
import assert from 'node:assert/strict';
import { ChartDownloadFormat, ChartDownloadMenuPosition, ChartToolbarAction, ChartToolbarPosition, ChartZoomPosition, planWebChart, describeChartData, chartTypes } from '../dist/index.js';
import { chartSvg } from '../dist/svg.js';
import { catalog, nativeCatalog } from '../tooling/catalog.mjs';
import { displayNumber } from '../dist/format.js';
import fs from 'node:fs';
import { detailPosition } from '../dist/tooltip.js';
import { textColorOnSurface } from '../dist/text-contrast.js';
import { validateOptions } from '../dist/planning.js';

test('download menu accepts an ordered subset of unique formats', () => {
  const formats = Object.freeze(['svg', 'csv']);
  assert.deepEqual(validateOptions({downloadMenu:formats}).value.downloadMenu, formats);
  assert.equal(validateOptions({downloadMenu:[ChartDownloadFormat.Svg],downloadMenuPosition:ChartDownloadMenuPosition.Top}).status, 'ok');
  assert.equal(validateOptions({downloadMenuPosition:'inside'}).diagnostic.reason, 'INVALID_DOWNLOAD_MENU_POSITION');
  assert.equal(validateOptions({downloadMenu:[]}).status, 'ok');
  for (const downloadMenu of ['png', ['pdf'], ['svg', 'svg'], ['csv', 'png', 'svg', 'csv']]) {
    const result = validateOptions({downloadMenu});
    assert.equal(result.status, 'invalid');
    assert.equal(result.diagnostic.reason, 'INVALID_DOWNLOAD_MENU');
  }
});

test('toolbar preserves mixed action order and rejects duplicates and unknown actions', () => {
  const actions = [ChartToolbarAction.Zoom, ChartToolbarAction.Svg];
  assert.deepEqual(validateOptions({toolbar:{actions, position:ChartToolbarPosition.Top}}).value.toolbar.actions, actions);
  assert.equal(validateOptions({toolbar:{actions:[]}}).status, 'ok');
  for (const invalid of [['unsupported'], [ChartToolbarAction.ZoomIn, ChartToolbarAction.ZoomIn]]) {
    assert.equal(validateOptions({toolbar:{actions:invalid}}).diagnostic.reason, 'INVALID_TOOLBAR_ACTIONS');
  }
});

test('zoom increment accepts a custom range and label and rejects zero', () => {
  const zoom = {showSlider:true, position:ChartZoomPosition.Below, min:0.1, max:50, step:0.1, increment:1, label:'Magnification'};
  assert.deepEqual(validateOptions({viewport:{axes:'x', zoom}}).value.viewport.zoom, zoom);
  assert.equal(validateOptions({viewport:{axes:'x', zoom:{showSlider:'true'}}}).status, 'invalid');
  assert.equal(validateOptions({viewport:{axes:'x', zoom:{position:'left'}}}).diagnostic.reason, 'INVALID_ZOOM_POSITION');
  for (const invalid of [{min:0}, {max:0}, {step:0}, {increment:0}, {min:5, max:2}]) {
    assert.equal(validateOptions({viewport:{axes:'x', zoom:invalid}}).diagnostic.reason, 'INVALID_ZOOM_RANGE');
  }
});

test('word ink keeps readable colors and adapts to light, dark and translucent surfaces', () => {
  assert.equal(textColorOnSurface('#000', '#fff', false), '#000');
  assert.equal(textColorOnSurface('#fff', '#000', true), '#fff');
  for (const [ink, surface, dark] of [['#ffffff', '#ffffff', false], ['#000000', '#000000', true], ['#ffffff01', '#ffffff00', false]]) {
    const adjusted = textColorOnSurface(ink, surface, dark);
    assert.notEqual(adjusted, ink);
    assert.match(adjusted, /^#[\da-f]{6}$/);
  }
});

test('tooltips stay inside the visible plot near points, including edges and constrained layouts', () => {
  const plot = {left: 60, right: 360, top: 88, bottom: 268};
  assert.deepEqual(detailPosition(60, 90, 160, 42, plot), {left: 60, top: 98, height: 42});
  assert.deepEqual(detailPosition(360, 266, 160, 42, plot), {left: 200, top: 216, height: 42});
  assert.deepEqual(detailPosition(100, 180, 160, 150, plot), {left: 108, top: 105, height: 150});
  assert.deepEqual(detailPosition(300, 180, 280, 150, plot), {left: 80, top: 88, height: 84});
  assert.deepEqual(detailPosition(110, 120, 160, 22, plot, true), {left: 60, top: 128, height: 22});
  assert.deepEqual(detailPosition(500, 270, 160, 42, plot), {left: 200, top: 218, height: 42});
});

test('the reference inventory of 2D series has real planning examples', () => {
  const reference = JSON.parse(fs.readFileSync(new URL('../docs/series-reference.json', import.meta.url)));
  assert.equal(reference.target.length, 50);
  for (const family of reference.target) assert(catalog.some(c => c.family === (family === 'solidgauge' ? 'gauge' : family)), family);
  assert(catalog.some(c => c.family === 'gauge' && c.options.layout?.style === 'solid'));
  assert(catalog.some(c => c.family === 'bar' && c.data.type === 'column' && c.options.layout?.orientation === 'horizontal'));
});

test('display rounding removes floating noise without changing original observations', () => {
  assert.equal(displayNumber(125.00000000000001), '125');
  assert.equal(displayNumber(1e-100), '1e-100');
  const item = catalog.find(c => c.family === 'treemap' && c.id === 'basic');
  const result = planWebChart(item.data, { ...item.options, appearance: { dataLabels: true } }, { width: 600, height: 380 });
  assert.equal(result.status, 'ok');
  const svg = chartSvg(result.value, { appearance: { dataLabels: true } }, 'contrast');
  assert(!svg.includes('125.00000000000001</text>'), 'No overlapping subtotal value label');
  assert(result.value.observations.some(o => o.subtotal), 'Original subtotal remains accessible');
});

test('Native and financial recipes plan through the public Core contract without mutation', () => {
  assert.equal(nativeCatalog.length, 319); assert.equal(catalog.length, 604); assert.equal(chartTypes.length, 117);
  assert.equal(new Set(catalog.map(item => item.family + '/' + item.id)).size, 604);
  for (const item of catalog) {
    const before = JSON.stringify(item);
    const r = planWebChart(item.data, item.options, { width: 640, height: 320 }, [], { measureWords: requests => requests.map(q => ({ ...q, width: q.text.length * q.fontSize * .65, height: q.fontSize * 1.4 })) });
    assert.equal(r.status, 'ok', `${item.family}/${item.id}: ${JSON.stringify(r)}`);
    assert.equal(JSON.stringify(item), before);
    for (const o of r.value.observations) assert(Number.isFinite(o.x) && Number.isFinite(o.y));
  }
});
test('Timeline event titles stay original domain data', () => {
  const item = catalog.find(c => c.family === 'timeline' && c.id === 'basic');
  const table = describeChartData(item.data); assert.equal(table.status, 'ok'); assert(table.value.columns.includes('title'));
  const titles = item.data.series.flatMap(s => s.data.map(p => p.title)); assert(titles.every(title => table.value.rows.some(row => row.includes(title))));
});
test('Gauge band colors move through presentation without erasing numeric thresholds', () => {
  const item = catalog.find(c => c.family === 'gauge' && c.id === 'bands');
  assert(item.options.appearance.bandColors.length); assert(item.data.bands.every(b => !Object.hasOwn(b, 'color')));
  const result = planWebChart(item.data, item.options, { width: 500, height: 320 }); assert.equal(result.status, 'ok');
  assert(chartSvg(result.value, item.options, 'bands').toLowerCase().includes(item.options.appearance.bandColors[0].toLowerCase()));
});
test('original data tables include distributions, words and graph relationships', () => {
  for (const family of ['histogram', 'bellcurve', 'wordcloud', 'violin', 'networkgraph', 'sankey']) {
    const item = catalog.find(c => c.family === family && c.id === 'basic'), result = describeChartData(item.data);
    assert.equal(result.status, 'ok'); assert(result.value.rows.length > 0, family);
  }
});
test('invalid accessors, cyclic data and wrong-family options are contained', () => {
  let reads = 0; const getter = Object.defineProperty({}, 'type', { enumerable: true, get() { reads++; return 'line'; } });
  assert.equal(planWebChart(getter, {}, { width: 300, height: 200 }).status, 'invalid'); assert.equal(reads, 0);
  const item = catalog.find(c => c.family === 'line'); const cycle = { ...item.data }; cycle.self = cycle;
  assert.equal(planWebChart(cycle, {}, { width: 300, height: 200 }).status, 'invalid');
  assert.equal(planWebChart(item.data, { layout: { neckWidth: .3 } }, { width: 300, height: 200 }).status, 'invalid');
});
test('sparse arrays cannot bypass bounded input validation or silently drop missing positions', () => {
  const item = catalog.find(c => c.family === 'line');
  for (const length of [4, 1000000000]) {
    const sparse = Array(length); sparse[length - 1] = { id: 'last', x: 1, y: 1 };
    const data = { ...item.data, series: [{ id: 'sparse', name: 'Sparse', data: sparse }] };
    assert.equal(planWebChart(data, {}, { width: 300, height: 200 }).status, 'invalid');
    assert.equal(describeChartData(data).status, 'invalid');
  }
});
test('standalone SVG escapes source labels and titles', () => {
  const item = catalog.find(c => c.family === 'line'), result = planWebChart(item.data, { title: '<script>alert(1)</script>' }, { width: 500, height: 300 });
  assert.equal(result.status, 'ok'); const svg = chartSvg(result.value, {}, 'escape'); assert(svg.includes('&lt;script&gt;')); assert(!svg.includes('<script>'));
});
