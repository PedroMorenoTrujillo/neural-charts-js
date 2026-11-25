import assert from 'node:assert/strict';
import test from 'node:test';
import { pathData, plotInsets } from '../dist/svg.js';
import { renderChartSvg } from '../dist/index.js';
import { catalog } from '../tooling/catalog.mjs';

const compact = { notation: 'compact', minimumFractionDigits: 0, maximumFractionDigits: 0 };
const currency = { ...compact, style: 'currency', currency: 'EUR', currencyDisplay: 'name' };
const unit = { ...compact, style: 'unit', unit: 'liter', unitDisplay: 'long' };

test('Axis insets account for formatter width and honor explicit single-line budgets', () => {
  const yAxis = y => plotInsets('line', 'vertical', { axes: { y } });
  assert.equal(yAxis({ numberFormat: compact }).left, 88);
  assert.equal(yAxis({ numberFormat: { ...compact, maximumFractionDigits: 2 } }).left, 128);
  assert.equal(yAxis({ numberFormat: { ...compact, minimumFractionDigits: 1 } }).left, 128);
  assert.equal(yAxis({ numberFormat: currency }).left, 128);
  assert.equal(yAxis({ numberFormat: unit }).left, 128);
  assert.equal(yAxis({ numberFormat: compact, title: 'Total' }).left, 128);
  const label = maxCharacters => ({ numberFormat: currency, labels: { maxLines: 1, maxCharacters } });
  assert.equal(yAxis(label(2)).left, 64);
  assert.equal(yAxis(label(9)).left, 84);
  assert.equal(yAxis(label(40)).left, 128);
  assert.equal(yAxis({ ...label(9), title: 'Amount' }).left, 108);
  assert.equal(yAxis({ ...label(9), labels: { ...label(9).labels, rotation: 30 } }).left, 128);
  assert.equal(plotInsets('column', 'vertical', { layout: { stacking: 'percent' }, formatting: { number: compact } }).left, 60);
});

test('Rotated text, time captions and row labels reserve their plot boundaries', () => {
  const horizontal = plotInsets('bullet', 'horizontal', {
    axes: { x: { title: 'Teams', titleStyle: { fontSize: 16 }, labels: { style: { fontSize: 18 } } } },
  });
  assert.equal(horizontal.left, 158);
  assert.equal(plotInsets('bullet', 'vertical').left, 60);
  const hidden = plotInsets('bar', 'horizontal', { axes: { x: { title: 'Hidden', visible: false } } });
  assert.equal(hidden.left, 112);
  const base = plotInsets('line', 'vertical');
  const dated = plotInsets('line', 'vertical', { formatting: { date: { dateStyle: 'full' } } });
  assert.equal(dated.bottom, 80);
  const rotated = plotInsets('line', 'vertical', {
    formatting: { date: { dateStyle: 'full' } },
    axes: { x: { titleStyle: { fontSize: 18 }, labels: { rotation: -40, maxLines: 3, maxCharacters: 18, style: { fontSize: 18 } } } },
  });
  assert(rotated.bottom > dated.bottom + 24);
  assert.equal(plotInsets('xrange').left, 112);
  assert.equal(plotInsets('timeline').left, 112);
  assert.equal(plotInsets('heatmap').bottom, 108);
  assert.equal(plotInsets('contour').bottom, 108);
  assert.equal(plotInsets('pareto').right, 58);
  assert.equal(plotInsets('tilemap').bottom, base.bottom);
  assert.equal(plotInsets('tilemap', undefined, { colorAxis: { type: 'classes' } }).bottom, 84);
  assert.deepEqual(plotInsets('pie'), { left: 0, right: 0, top: 0, bottom: 0 });
});

test('Secondary axes reserve their own format and styled title without moving the primary axis', () => {
  const defaultMixed = plotInsets('mixed');
  const mixed = secondaryY => plotInsets('mixed', undefined, { axes: { secondaryY } });
  assert.equal(defaultMixed.right, 64);
  assert.equal(mixed({ numberFormat: currency }).right, 128);
  const styled = mixed({
    title: 'Balance', titleStyle: { fontSize: 20 }, labels: { style: { fontSize: 16 } },
  });
  assert.equal(styled.right, 108);
  assert.equal(styled.left, defaultMixed.left);
  assert.equal(mixed({ title: 'Hidden', visible: false }).right, 64);
});

test('SVG paths preserve eccentric arc radii and reuse only immutable dense command arrays', () => {
  const parts = [
    { type: 'M', x: -0, y: 0 }, { type: 'A', x: 9, y: 12, radius: 10, radiusY: 4, largeArc: 1, sweep: 0 },
    { type: 'Q', cx: 2, cy: 8, x: 3, y: 2 }, { type: 'Z' },
  ];
  assert.equal(pathData(parts), 'M0,0 A10,4 0 1,0 9,12 Q2,8 3,2 Z');
  const dense = Array.from({ length: 256 }, (_, x) => ({ type: x ? 'L' : 'M', x, y: x % 5 }));
  const immutable = Object.freeze(dense.map(point => Object.freeze({ ...point })));
  const original = pathData(immutable);
  assert.equal(pathData(immutable), original);
  assert.equal(pathData(dense), original);
  dense[255].y = 18;
  assert(pathData(dense).endsWith('L255,18'));
  assert(original.endsWith('L255,0'));
  assert.throws(() => pathData([{ type: 'L', x: Infinity, y: 0 }]), /NONFINITE_FRAME/);
});

function render(data, options) {
  const result = renderChartSvg(data, options, { instanceId: 'portable-geometry', composition: 'plot' });
  assert.equal(result.status, 'ok', JSON.stringify(result.diagnostic));
  assert.doesNotMatch(result.value, /NaN|Infinity/);
  return result.value;
}

test('A dense strip represents every visible flag with an observation marker', () => {
  const data = {
    type: 'flags',
    axes: { x: { type: 'linear' }, y: { type: 'linear' } },
    series: [{
      id: 'sessions', name: 'Sessions',
      data: Array.from({ length: 64 }, (_, x) => ({
        id: 'f' + x, x, open: 105, high: 112, low: 101, close: 110, title: 'Session ' + x,
      })),
    }],
  };
  const dense = render(data, { width: 360, height: 300, appearance: { dataLabels: false } });
  const marks = [...dense.matchAll(/<circle data-observation="(\d+)"[^>]+r="1\.5"/g)].map(match => Number(match[1]));
  assert.deepEqual(marks, Array.from({ length: 64 }, (_, index) => index));
});

test('Time range labels retain the original duration and fit entirely inside the rendered interval', () => {
  const start = Date.UTC(2026, 0, 1);
  const hour = 3600000;
  const data = {
    type: 'xrange',
    axes: {
      x: { type: 'time', domain: [start, start + 12 * hour] },
      y: { type: 'category', values: [{ id: 'load', label: 'Load' }, { id: 'send', label: 'Send' }] },
    },
    series: [{
      id: 'job', name: 'Job',
      data: [
        { id: 'long', rowId: 'load', start, end: start + 6 * hour, completed: 0 },
        { id: 'short', rowId: 'send', start, end: start + 1000, completed: null },
      ],
    }],
  };
  const options = { width: 560, height: 320, appearance: { dataLabels: true }, locale: 'en' };
  for (const completed of [undefined, null, 0, 0.02, 0.5, 1]) {
    const long = { ...data.series[0].data[0], completed };
    if (completed === undefined) delete long.completed;
    const series = [{ ...data.series[0], data: [long, data.series[0].data[1]] }];
    const result = renderChartSvg({ ...data, series }, options, { instanceId: 'time-range' });
    assert.equal(result.status, 'ok', JSON.stringify(result.diagnostic));
    const labels = [...result.value.matchAll(/<g data-label=""[^>]*>(.*?)<\/g>/g)].map(match => match[1]);
    assert.equal(labels.length, 1, String(completed));
    assert.match(labels[0], />6 hr<\/text>/);
    if (completed === undefined || completed === 1) assert.match(labels[0], /fill="#ffffff"/);
    else assert.match(labels[0], /fill="#26364b"/);
    assert.equal(labels[0].includes('paint-order="stroke"'), completed === 0.5);
  }
});

test('A narrow quantitative legend retains complete class names in accessible SVG titles', () => {
  const names = ['Below the measurement threshold', 'Measurements in the accepted range', 'Above the measurement threshold'];
  const data = {
    type: 'heatmap',
    axes: {
      x: { type: 'category', values: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }, { id: 'c', label: 'C' }] },
      y: { type: 'category', values: [{ id: 'source', label: 'Source' }] },
    },
    data: [-1, 0, 8].map((value, index) => ({ id: 'm' + index, rowId: 'source', columnId: ['a', 'b', 'c'][index], value })),
  };
  const classes = [
    { id: 'low', label: names[0], maxExclusive: 0, color: '#224488' },
    { id: 'normal', label: names[1], minInclusive: 0, maxExclusive: 8, color: '#226644' },
    { id: 'high', label: names[2], minInclusive: 8, color: '#882244' },
  ];
  for (const width of [240, 640]) {
    const colorAxis = { type: 'classes', classes, missingColor: '#dddddd', unclassifiedColor: '#eeeeee' };
    const result = renderChartSvg(data, { width, colorAxis }, { instanceId: 'classes-' + width });
    assert.equal(result.status, 'ok', JSON.stringify(result.diagnostic));
    assert(result.value.includes('<g data-color-axis="classes"><title>' + names.join(', ') + '</title>'));
    for (const item of classes) {
      const start = result.value.indexOf('<g><title>' + item.label + '</title>');
      assert(start >= 0);
      const group = result.value.slice(start, result.value.indexOf('</g>', start));
      assert(group.includes('fill="' + item.color + '"'));
    }
  }
});

test('Narrow density axes abbreviate derived ticks and retain their exact accessible text', () => {
  const data = { type: 'bellcurve', samples: [0, 100000, 200000, 300000] };
  const options = { width: 280, height: 310 };
  const render = options => {
    const result = renderChartSvg(data, options, { instanceId: 'density-ticks' });
    assert.equal(result.status, 'ok', JSON.stringify(result.diagnostic));
    return result.value;
  };
  const scientific = render(options);
  assert(scientific.includes('<title>0.000001</title>1e-6</text>'));
  assert(scientific.includes('<title>0.000004</title>4e-6</text>'));
  const formatted = render({ ...options, axes: { y: { numberFormat: { maximumFractionDigits: 8, suffix: ' /s' } } } });
  assert(formatted.includes('<title>0.000001 /s</title>'));
  assert(!formatted.includes('>1e-6</text>'));
});

test('Explicit axes place their titles at opposite edges with physical RTL anchoring', () => {
  const { data, options: original } = catalog.find(item => item.family === 'line' && item.id === 'basic');
  const axes = {
    x: { title: 'Elapsed time', titleStyle: { align: 'left', color: '#445577', fontSize: 16 } },
    y: { title: 'Recorded values', titleStyle: { align: 'right', color: '#224455', fontSize: 14 } },
  };
  const titleAttributes = (svg, title) => [...svg.matchAll(/<text([^>]*)>([^<]+)<\/text>/g)].find(match => match[2] === title)?.[1];
  const ltr = render(data, { ...original, direction: 'ltr', axes });
  const rtl = render(data, { ...original, direction: 'rtl', axes });
  for (const [svg, xAnchor, yAnchor] of [[ltr, 'start', 'end'], [rtl, 'end', 'start']]) {
    const left = titleAttributes(svg, 'Elapsed time');
    const right = titleAttributes(svg, 'Recorded values');
    assert.match(left, /fill="#445577" font-size="16"/);
    assert.match(right, /fill="#224455" font-size="14"/);
    assert(left.includes('text-anchor="' + xAnchor + '"'));
    assert(right.includes('text-anchor="' + yAnchor + '"'));
  }
});
