import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { openInstrumentedPage } from './browser-modules.mjs';

const catalogPath = resolve(process.env.NEURAL_CHARTS_CATALOG ??
  resolve(import.meta.dirname, '../../charts-showcase-canonical/catalog/recipes.json'));
const recipes = JSON.parse(await readFile(catalogPath, 'utf8'));
const contour = recipes.find(item => item.family === 'contour' && item.id === 'basic');
assert.ok(contour);

const categories = Array.from({ length: 36 }, (_, i) => ({ id: 'period-' + i, label: 'Month ' + (i + 1) }));
const data = {
  type: 'line',
  axes: { x: { type: 'category', values: categories }, y: { type: 'linear' } },
  series: [{ id: 'usage', name: 'Usage', data: categories.map(({ id }, i) => ({ id, x: id, y: i })) }],
};
const viewport = { axes: 'x', zoom: { showSlider: true, position: 'below', label: 'Zoom view', min: 0.5, max: 4, step: 0.5, increment: 1.5 } };
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 900, height: 820 }, acceptDownloads: true });
  page.setDefaultTimeout(7000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const writeCoverage = await openInstrumentedPage(page,
    '<main style="width:640px;max-height:700px;overflow:auto"><div id="chart"></div></main>', 'en');
  await page.evaluate(async ({ data, viewport }) => {
    const { createLineChart } = await import('/web/cartesian.js');
    window.diagnostics = [];
    const result = createLineChart(document.querySelector('#chart'), data, {
      locale: 'en', height: 320, viewport, downloadMenu: ['csv', 'svg', 'png'],
      tooltip: { placement: 'below', pinnable: true, maxWidth: 240, maxHeight: 120 },
    }, { instanceId: 'chart-controls', onDiagnostic: diagnostic => window.diagnostics.push(diagnostic.reason) });
    if (result.status !== 'ok') throw Error(JSON.stringify(result.diagnostic));
    window.chart = result.value;
  }, { data, viewport });
  const root = page.locator('[data-nc-web]');
  const slider = root.locator('[data-zoom-level]');
  const zoomState = () => page.evaluate(() => chart.getFrame().viewport.value.x);
  const initialViewport = await zoomState();
  assert.equal(await slider.getAttribute('aria-valuetext'), '1.5×');
  await slider.press('ArrowRight');
  assert.equal(await slider.getAttribute('aria-valuetext'), '2×');
  await root.locator('[data-action="zoom-in"]').click();
  const zoomed = await zoomState();
  assert.ok(zoomed.firstId !== categories[0].id || zoomed.lastId !== categories.at(-1).id);

  await page.evaluate(() => {
    const set = chart.setViewport({ x: { firstId: 'period-2', lastId: 'period-7' } });
    if (set.status !== 'ok') throw Error(JSON.stringify(set.diagnostic));
  });
  const scroll = root.locator('[data-viewport-scroll]');
  await scroll.waitFor();
  await scroll.press('End');
  await page.waitForFunction(() => chart.getFrame().viewport.value.x.lastId === 'period-35');
  await root.press('Shift+ArrowLeft');
  assert.notEqual((await zoomState()).lastId, 'period-35');
  assert.equal(await page.evaluate(() => chart.resetViewport().status), 'ok');
  assert.deepEqual(await zoomState(), initialViewport);
  assert.equal(await page.evaluate(() => chart.zoomBy(2).status), 'ok');
  assert.ok((await zoomState()).firstId !== categories[0].id);
  assert.equal(await page.evaluate(() => chart.resetViewport().status), 'ok');

  await root.press('Home');
  const tip = root.getByRole('tooltip');
  assert.match(await tip.innerText(), /Month 1.*Usage: 0/);
  assert.equal(await tip.evaluate(node => getComputedStyle(node).position), 'relative');
  assert.equal(await tip.evaluate(node => node.style.maxHeight), '120px');
  await root.locator('[data-action="tooltip-pin"]').click();
  await page.keyboard.press('Escape');
  await tip.waitFor();
  await page.evaluate(() => {
    const changed = chart.updateOptions({ locale: 'en', viewport: { axes: 'x' }, downloadMenu: ['csv', 'svg', 'png'],
      tooltip: { placement: 'auto', maxWidth: 180, maxHeight: 150 } });
    if (changed.status !== 'ok') throw Error(JSON.stringify(changed.diagnostic));
  });
  await root.press('Home');
  const clipped = await tip.boundingBox();
  const container = await page.locator('main').boundingBox();
  assert.ok(clipped && container && clipped.x >= container.x - 1 && clipped.x + clipped.width <= container.x + container.width + 1);

  for (const format of ['csv', 'svg', 'png']) {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      root.locator('[data-action="download-' + format + '"]').click(),
    ]);
    assert.equal(download.suggestedFilename(), 'chart-controls.' + format);
    const bytes = await readFile(await download.path());
    if (format === 'csv') assert.equal(bytes.toString().split('\r\n')[1], '"Usage","Month 1","period-0","period-0","0","Yes"');
    else if (format === 'svg') assert.match(bytes.toString(), /<svg\b/);
    else assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(await download.failure(), null);
  }
  const aborted = await page.evaluate(async () => {
    const controller = new AbortController();
    const pending = chart.exportPng({ signal: controller.signal });
    controller.abort();
    try { await pending; return 'resolved'; }
    catch (error) { return error.message; }
  });
  assert.equal(aborted, 'EXPORT_ABORTED');
  assert.deepEqual(await page.evaluate(() => diagnostics), []);

  await page.evaluate(async data => {
    chart.destroy();
    const host = document.querySelector('#chart');
    const { createBarChart, createColumnChart } = await import('/web/cartesian.js');
    const columnData = { ...data, type: 'column' };
    const options = { locale: 'en', height: 320 };
    const bounds = [];
    for (const [kind, mount] of [['column', createColumnChart], ['bar', createBarChart]]) {
      const result = mount(host, columnData, options, { instanceId: kind });
      if (result.status !== 'ok') throw Error(JSON.stringify(result.diagnostic));
      const rects = [...host.querySelectorAll('[data-layer="geometry"] rect')].map(rect => rect.getBBox());
      const longest = rects.sort((a, b) => (b.width * b.height) - (a.width * a.height))[0];
      if (!longest) throw Error('Expected rendered bars for ' + kind);
      bounds.push({ width: longest.width, height: longest.height });
      result.value.destroy();
    }
    if (!(bounds[0].height > bounds[0].width && bounds[1].width > bounds[1].height)) {
      throw Error('Unexpected chart orientation: ' + JSON.stringify(bounds));
    }
  }, data);

  await page.evaluate(async recipe => {
    const { createChart } = await import('/web/index.js');
    const mounted = createChart(document.querySelector('#chart'), recipe.data, recipe.options, {
      instanceId: 'contour-controls', onPointActivate: event => { window.contourId = event.id; },
    });
    if (mounted.status !== 'ok') throw Error(JSON.stringify(mounted.diagnostic));
    window.chart = mounted.value;
  }, contour);
  const coordinate = await root.locator('[data-layer="geometry"] path').first().evaluate(path => {
    const point = path.getPointAtLength(path.getTotalLength() / 2);
    const pixel = point.matrixTransform(path.getScreenCTM());
    return { x: pixel.x, y: pixel.y };
  });
  await page.mouse.move(coordinate.x, coordinate.y);
  await root.getByRole('tooltip').waitFor();
  await page.mouse.click(coordinate.x, coordinate.y);
  const activeContour = await page.evaluate(() => ({
    id: window.contourId,
    found: chart.getFrame().observations.some(item => item.contour && JSON.stringify(item.id) === JSON.stringify(window.contourId)),
  }));
  assert.ok(activeContour.id && activeContour.found);

  const tooltipCases = [
    ['timeline', /Primera compilación[\s\S]*El primer paquete/],
    ['timeline', /^Inicio\s+0$/, undefined, 'numeric'],
    ['xrange', /Duration: .+[\s\S]*Start: .+[\s\S]*End: .+/],
    ['xrange', /Duration: 3 hr[\s\S]*Start: .+[\s\S]*End: .+[\s\S]*Completed: 85%/, undefined, 'time'],
    ['flame', /Duration: .+[\s\S]*Self duration: .+/],
    ['boxplot', /Median: .+[\s\S]*Q1: .+[\s\S]*Q3: .+/],
    ['violin', /Median: .+[\s\S]*Samples: \d+/],
    ['arearange', /: -?\d+(?:[.,]\d+)? – -?\d+/],
    ['bubble', /X: 22[\s\S]*Size: 18/],
    ['bullet', /Target: \d+/],
    ['vector', /ΔX: 2[\s\S]*ΔY: -2/],
    ['windbarb', /Direction: 30°/, 'ArrowRight'],
    ['candlestick', /Open: 100[\s\S]*High: 101[.,]6[\s\S]*Low: 99[\s\S]*Close: 100[.,]6[\s\S]*Volume: 1,000/],
    ['ikh', /(?:Conversion line|Base line|Leading span A|Leading span B|Lagging span): /],
  ];
  for (const [family, expected, next, example = 'basic'] of tooltipCases) {
    const recipe = recipes.find(item => item.family === family && item.id === example);
    assert.ok(recipe, family);
    await page.evaluate(async item => {
      chart.destroy();
      const { createChart } = await import('/web/index.js');
      const mounted = createChart(document.querySelector('#chart'), item.data, {
        ...item.options, locale: 'en', tooltip: { enabled: true, content: 'point', placement: 'below' },
      }, { instanceId: 'detail-' + item.family });
      if (mounted.status !== 'ok') throw Error(JSON.stringify(mounted.diagnostic));
      window.chart = mounted.value;
    }, recipe);
    await root.press('Home');
    if (next) await root.press(next);
    assert.match(await root.getByRole('tooltip').innerText(), expected, family + '/' + example);
  }
  const timeRange = recipes.find(item => item.family === 'xrange' && item.id === 'time');
  await page.evaluate(async item => {
    chart.destroy();
    const { createChart } = await import('/web/index.js');
    const series = item.data.series.map(series => ({
      ...series, data: series.data.map((point, index) => index === 0 ? { ...point, end: point.end + 1800000, completed: 0 } : point),
    }));
    const result = createChart(document.querySelector('#chart'), { ...item.data, series }, {
      ...item.options, locale: 'en', appearance: { ...item.options.appearance, dataLabels: true },
      tooltip: { enabled: true, content: 'point', placement: 'below' },
    }, { instanceId: 'range-with-progress' });
    if (result.status !== 'ok') throw Error(JSON.stringify(result.diagnostic));
    window.chart = result.value;
  }, timeRange);
  const rangeLabels = await root.locator('svg [data-label] > text').evaluateAll(nodes =>
    nodes.map(node => ({ text: node.lastChild?.textContent, fill: node.getAttribute('fill') })));
  assert.deepEqual(rangeLabels.filter(label => label.text === '3.5 hr'), [{ text: '3.5 hr', fill: '#26364b' }]);
  await root.press('Home');
  assert.match(await root.getByRole('tooltip').innerText(), /Duration: 3\.5 hr[\s\S]*Completed: 0%/);

  const mixed = recipes.find(item => item.family === 'mixed' && item.id === 'basic');
  assert.ok(mixed);
  const targets = await page.evaluate(async item => {
    chart.destroy();
    const { createChart } = await import('/web/index.js');
    window.mixedActivations = [];
    const mounted = createChart(document.querySelector('#chart'), item.data, {
      ...item.options, locale: 'en', tooltip: { enabled: true, content: 'shared', placement: 'below' },
    }, { instanceId: 'mixed-selection', onPointActivate: event => mixedActivations.push(event.id) });
    if (mounted.status !== 'ok') throw Error(JSON.stringify(mounted.diagnostic));
    window.chart = mounted.value;
    const frame = chart.getFrame();
    const transform = document.querySelector('[data-layer="geometry"]').getScreenCTM();
    const translate = (x, y, id) => {
      const pixel = new DOMPoint(x, y).matrixTransform(transform);
      return { x: pixel.x, y: pixel.y, id };
    };
    const columns = frame.series.find(series => series.bars?.length);
    const bars = columns.bars.filter(bar => bar.width > 0 && bar.height > 0)
      .map(bar => translate(bar.x + bar.width / 2, bar.y + bar.height * .9, { seriesId: columns.id, pointId: bar.pointId }));
    const line = frame.observations.find(point => point.id.seriesId !== columns.id);
    return { bars, line: translate(line.x, line.y, line.id), names: frame.legend.map(series => series.name) };
  }, mixed);
  assert.equal(targets.bars.length, 7);
  for (const bar of targets.bars) {
    await page.mouse.click(bar.x, bar.y);
    assert.deepEqual(await page.evaluate(() => mixedActivations.at(-1)), bar.id);
    const text = await root.getByRole('tooltip').innerText();
    for (const name of targets.names) assert.ok(text.includes(name), name + ' missing from shared tooltip');
  }
  await page.mouse.click(targets.line.x, targets.line.y);
  assert.deepEqual(await page.evaluate(() => mixedActivations.at(-1)), targets.line.id);

  const treemap = recipes.find(item => item.family === 'treemap' && item.id === 'basic');
  assert.ok(treemap);
  await page.evaluate(async item => {
    chart.destroy();
    const { createChart } = await import('/web/index.js');
    const options = { ...item.options, locale: 'en', accessibility: { announceDataChanges: true } };
    const mounted = createChart(document.querySelector('#chart'), item.data, options, { instanceId: 'hierarchy-controls' });
    if (mounted.status !== 'ok') throw Error(JSON.stringify(mounted.diagnostic));
    window.chart = mounted.value;
    window.hierarchy = { data: item.data, options };
  }, treemap);
  await root.press('Control+End');
  await root.press('Enter');
  const tree = await page.evaluate(() => {
    const initial = chart.getSelection();
    if (initial.length !== 1 || initial[0].pointId === hierarchy.data.root.id) {
      throw Error('Expected a selected child: ' + JSON.stringify(initial));
    }
    function prune(node, id) {
      return !node.children ? node :
        { ...node, children: node.children.filter(child => child.id !== id).map(child => prune(child, id)) };
    }
    const retained = { ...hierarchy.data, root: { ...hierarchy.data.root, label: 'Updated portfolio' } };
    const removed = { ...retained, root: prune(retained.root, initial[0].pointId) };
    const kept = chart.update(retained, hierarchy.options);
    const retainedSelection = chart.getSelection();
    const discarded = chart.update(removed, hierarchy.options);
    return { initial, retainedSelection, kept: kept.status, discarded: discarded.status, remaining: chart.getSelection() };
  });
  assert.equal(tree.kept, 'ok');
  assert.equal(tree.discarded, 'ok');
  assert.deepEqual(tree.retainedSelection, tree.initial);
  assert.deepEqual(tree.remaining, []);
  assert.match(await root.getByRole('status').innerText(), /Updated.*visible observations/i);

  const failures = await page.evaluate(async () => {
    const { rasterizeChartSvg } = await import('/web/index.js');
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 6 4" style="background-color:#a17345"><rect x="0" y="0" width="2" height="2" fill="#223344"/></svg>';
    const raster = settings => rasterizeChartSvg(svg, document, settings);
    const message = promise => promise.then(() => 'resolved', error => error.message);
    const withMethod = async (prototype, key, substitute, action) => {
      const original = prototype[key];
      prototype[key] = substitute;
      try { return await action(); }
      finally { prototype[key] = original; }
    };
    const invalid = [];
    for (const settings of [{ width: 0 }, { height: -1 }, { pixelRatio: .1 }, { pixelRatio: 5 }, { width: 9000, height: 9000 }, { background: 'url(bitmap)' }]) {
      invalid.push(await message(raster(settings)));
    }
    const missingDocument = await message(rasterizeChartSvg(svg, document.implementation.createHTMLDocument()));
    const contextUnavailable = await withMethod(HTMLCanvasElement.prototype, 'getContext', () => null, () => message(raster()));
    const encodingFailed = await withMethod(HTMLCanvasElement.prototype, 'toBlob', callback => callback(null), () => message(raster()));
    const imageFailed = await withMethod(URL, 'createObjectURL', () => 'blob:about:blank/missing-chart-export',
      () => message(raster()));
    const creationFailed = await withMethod(URL, 'createObjectURL', () => { throw new Error('TEST_BLOB_URL_ERROR'); },
      () => message(raster()));
    const bitmap = await createImageBitmap(await raster({ width: 12 }));
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    try {
      context.drawImage(bitmap, 0, 0);
      return {
        invalid, missingDocument, contextUnavailable, encodingFailed, imageFailed, creationFailed,
        dimensions: [bitmap.width, bitmap.height],
        pixel: [...context.getImageData(10, 5, 1, 1).data],
      };
    } finally { bitmap.close(); }
  });
  assert.deepEqual(failures.invalid, Array(6).fill('INVALID_PNG_DIMENSIONS'));
  assert.equal(failures.missingDocument, 'BROWSER_DOCUMENT_REQUIRED');
  assert.equal(failures.contextUnavailable, 'CANVAS_CONTEXT_UNAVAILABLE');
  assert.equal(failures.encodingFailed, 'PNG_ENCODING_FAILED');
  assert.equal(failures.imageFailed, 'SVG_IMAGE_DECODE_FAILED');
  assert.equal(failures.creationFailed, 'TEST_BLOB_URL_ERROR');
  assert.deepEqual(failures.dimensions, [12, 8]);
  assert.deepEqual(failures.pixel, [161, 115, 69, 255]);

  for (const [family, id] of [
    ['vector', 'basic'], ['vector', 'zero'], ['windbarb', 'basic'], ['windbarb', 'unknown'],
    ['timeline', 'basic'], ['xrange', 'basic'], ['lollipop', 'basic'], ['dumbbell', 'basic'],
    ['errorbar', 'basic'], ['item', 'basic'],
  ]) {
    const recipe = recipes.find(item => item.family === family && item.id === id);
    assert.ok(recipe, family + '/' + id);
    const points = await page.evaluate(async item => {
      chart.destroy();
      const { createChart } = await import('/web/index.js');
      const result = createChart(document.querySelector('#chart'), item.data, {
        ...item.options, locale: 'es', animation: { enabled: false },
      }, { instanceId: 'glyph-' + item.family });
      if (result.status !== 'ok') throw Error(JSON.stringify(result.diagnostic));
      window.chart = result.value;
      const frame = chart.getFrame();
      const marks = document.querySelector('[data-layer="marks"]');
      return frame.observations.slice(0, 16).map(point => {
        const position = new DOMPoint(point.x, point.y).matrixTransform(marks.getScreenCTM());
        const circle = frame.series.find(series => series.id === point.id.seriesId).circles?.find(mark => mark.pointId === point.id.pointId);
        return { x: position.x, y: position.y, label: point.label, radius: circle?.radius };
      });
    }, recipe);
    const image = root.getByRole('img');
    assert.equal(await image.getAttribute('aria-label'), recipe.options.title);
    assert.equal(await image.locator(':scope > title').count(), 0);
    if (recipe.options.description) assert.match(await image.getAttribute('aria-describedby'), /-svg-desc$/);
    for (const point of points) {
      await page.mouse.move(point.x, point.y);
      const tooltip = root.getByRole('tooltip');
      assert.ok(await tooltip.isVisible(), family + '/' + id + ' ' + point.label);
      assert.ok((await tooltip.innerText()).includes(point.label), family + '/' + id + ' ' + point.label);
      const focus = root.locator('[data-layer="focus"]');
      if (['vector', 'windbarb', 'lollipop', 'dumbbell', 'errorbar'].includes(family)) {
        const endpoints = family === 'lollipop' ? 1 : family === 'dumbbell' ? 2 : 0;
        assert.equal(await focus.locator('circle').count(), endpoints);
        assert.equal(await focus.locator('polygon').count(), 0);
        const path = await focus.locator('[data-stroke-focus]').getAttribute('d');
        assert.match(path, /^M.+[LA]/);
      } else if (family === 'timeline') {
        assert.equal(Number(await focus.locator('circle').first().getAttribute('r')), point.radius);
      } else if (family === 'item') {
        assert.ok(await focus.locator('circle').count() > 1);
      } else {
        const box = await focus.locator('rect').first().getAttribute('width');
        assert.ok(Number(box) > 0);
      }
    }
  }

  for (const family of ['line', 'areasplinerange']) {
    const recipe = recipes.find(item => item.family === family && item.id === 'basic');
    assert.ok(recipe, family);
    const targets = await page.evaluate(async item => {
      chart.destroy();
      const { createChart } = await import('/web/index.js');
      const result = createChart(document.querySelector('#chart'), item.data, {
        ...item.options, locale: 'es', animation: { enabled: false }, height: 380,
      }, { instanceId: 'hover-' + item.family });
      if (result.status !== 'ok') throw Error(JSON.stringify(result.diagnostic));
      window.chart = result.value;
      const frame = chart.getFrame();
      const points = frame.observations.filter(point => point.id.seriesId === frame.observations[0].id.seriesId);
      const point = points[3];
      const along = point.x + (points[4].x - point.x) * .42;
      const matrix = document.querySelector('[data-layer="marks"]').getScreenCTM();
      const target = (x, y) => new DOMPoint(x, y).matrixTransform(matrix).toJSON();
      const edge = frame.series[0].commands.filter(command => 'x' in command && command.x === point.x).map(command => command.y);
      return {
        between: target(along, point.y), far: target(point.x, Math.min(...edge)),
        outside: target(point.x, frame.height + 2), point,
      };
    }, recipe);
    await page.mouse.move(targets.between.x, targets.between.y);
    const tooltip = root.getByRole('tooltip');
    assert.ok(await tooltip.isVisible(), family + ' tooltip between two observations');
    assert.match(await tooltip.innerText(), new RegExp(targets.point.label));
    if (family === 'areasplinerange') {
      await page.mouse.move(targets.far.x, targets.far.y);
      assert.ok(await tooltip.isVisible(), 'Tooltip follows the interval up to its upper limit');
      assert.match(await tooltip.innerText(), new RegExp(String(targets.point.lowValue) + '.*' + targets.point.highValue));
      const marker = root.locator('[data-layer="focus"]');
      assert.equal(await marker.locator('circle').count(), 2, 'Both original interval endpoints are highlighted');
      assert.equal(await marker.locator('[data-range-focus]').count(), 1);
    }
    await page.mouse.move(targets.outside.x, targets.outside.y);
    assert.equal(await tooltip.isVisible(), false, family + ' plot boundary clears hover');
  }

  const animationCases = [
    ['column', 'transform', /^scaleY\(0\)$/],
    ['pie', 'clipPath', /^circle\(0%\)$/],
    ['line', 'clipPath', /^inset\(0(?:px)? 0(?:px)? 0(?:px)? 100%\)$/],
    ['scatter', 'opacity', /^0$/],
  ];
  for (const [family, property, expected] of animationCases) {
    const recipe = recipes.find(item => item.family === family && item.id === 'basic');
    assert.ok(recipe, family);
    const keyframe = await page.evaluate(async ({ item, property }) => {
      chart.destroy();
      const { createChart } = await import('/web/index.js');
      const mounted = createChart(document.querySelector('#chart'), item.data, {
        ...item.options, locale: 'en', direction: 'rtl', animation: { enabled: true, duration: 400 },
      }, { instanceId: 'motion-' + item.family });
      if (mounted.status !== 'ok') throw Error(JSON.stringify(mounted.diagnostic));
      window.chart = mounted.value;
      const geometry = document.querySelector('[data-layer="geometry"]');
      const animations = geometry.getAnimations();
      if (animations.length !== 1) throw Error('Expected one chart animation, got ' + animations.length);
      const animation = animations[0];
      const first = animation.effect.getKeyframes()[0][property];
      animation.finish();
      return String(first);
    }, { item: recipe, property });
    assert.match(keyframe, expected, family + ' entrance animation');
    await page.waitForFunction(() => !document.querySelector('[data-layer="geometry"]').getAnimations().length);
  }

  await page.evaluate(() => chart.destroy());
  assert.equal(await root.count(), 0);
  assert.deepEqual(errors, []);
  await writeCoverage('download.js');
  console.log('Chromium · native zoom and scroll inputs, clipped and below tooltips, CSV/SVG/PNG downloads, contour hit-testing and ' + tooltipCases.length + ' detail formats');
} finally {
  await browser.close();
}
