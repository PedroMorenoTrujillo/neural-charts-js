import test from 'node:test';
import assert from 'node:assert/strict';
import { renderChartSvg, exportChartCsv, describeChartData } from '../dist/index.js';
import { catalog } from '../tooling/catalog.mjs';
const data = { type: 'line', axes: { x: { type: 'linear' }, y: { type: 'linear' } }, series: [{ id: 's', name: '=HYPERLINK("x")', data: [{ id: 'a', x: 0, y: -1.25 }, { id: 'b', x: 1, y: null }] }] };
test('server SVG is real finite escaped chart geometry and never reads browser globals', () => {
  const r = renderChartSvg(data, { title: '<script>unsafe</script>' }, { instanceId: 'server' });
  assert.equal(r.status, 'ok'); assert(r.value.includes('<path')); assert(r.value.includes('&lt;script&gt;')); assert(!r.value.includes('<script>')); assert(!/NaN|Infinity/.test(r.value));
  assert.equal(renderChartSvg(data, {}, { instanceId: 'a'.repeat(96) + '-ssr' }).status, 'ok', 'Static SSR namespace supports every valid mounted owner ID');
});
test('Ichimoku exports the visible component labels and their plotted line patterns', () => {
  const recipe = catalog.find(item => item.family === 'ikh' && item.id === 'basic');
  const options = {...recipe.options,locale:'es',legend:{visible:true}};
  const chart = renderChartSvg(recipe.data,options,{instanceId:'cloud',composition:'chart'});
  assert.equal(chart.status,'ok');
  assert.match(chart.value,/data-part="spanA"[^>]*stroke-dasharray="4 2"/);
  assert.match(chart.value,/data-export-component="spanA"[^]*?stroke-dasharray="4 2"[^]*?Proyección A/);
  assert.match(chart.value,/data-export-component="spanB"/);
  const plot = renderChartSvg(recipe.data,options,{instanceId:'plot',composition:'plot'});
  assert.equal(plot.status,'ok');
  assert.doesNotMatch(plot.value,/data-export-component=/);
});

test('CSV preserves nulls, signs, original precision and safely quotes formula-like names', () => {
  const r = exportChartCsv(data, { bom: true, delimiter: ';' }); assert.equal(r.status, 'ok');
  assert(r.value.startsWith('\ufeff')); assert(r.value.includes("'=HYPERLINK(")); assert(r.value.includes('"-1.25"')); assert(r.value.includes('Missing measurement')); assert(r.value.endsWith('\r\n'));
});
test('all unmeasured catalogue variants serialize on the server and special geometry is preserved', () => {
  for (const item of catalog.filter(item => item.family !== 'wordcloud')) {
    const svg = renderChartSvg(item.data, item.options, { instanceId: 'server-' + item.family });
    assert.equal(svg.status, 'ok', item.family + '/' + item.id + ': ' + JSON.stringify(svg)); assert(!/NaN|Infinity/.test(svg.value));
    if (item.family === 'bullet' && item.id === 'basic') { assert(svg.value.includes('data-bullet-band=')); assert(svg.value.includes('data-bullet-target=')); }
  }
});
test('custom theme and annotation contracts reject incomplete or executable presentation', () => {
  const svg = renderChartSvg(data, { themeTokens: { background: '#18324a', foreground: '#fafafa' }, annotations: [{ id: 'note', point: { seriesId: 's', pointId: 'a' }, text: '<note>' }] }, { instanceId: 'custom' });
  assert.equal(svg.status, 'ok'); assert(svg.value.includes('#18324a')); assert(svg.value.includes('&lt;note&gt;'));
  assert.equal(renderChartSvg(data, { themeTokens: { background: 'url(https://bad)' } }, { instanceId: 'unsafe' }).status, 'invalid');
  assert.equal(renderChartSvg(data, { annotations: [{ point: { seriesId: 's', pointId: 'a' } }] }, { instanceId: 'missing' }).status, 'invalid');
});
test('accessible tables retain category labels, duplicate positions, raw IDs and UTC dates', () => {
  const input = { type: 'line', axes: { x: { type: 'category', values: [{ id: 'a', label: 'Enero' }, { id: 'b', label: 'Enero' }] }, y: { type: 'linear' } }, series: [{ id: 's', name: 'S', data: [{ id: 'first', x: 'a', y: 1 }, { id: 'second', x: 'b', y: null }] }] };
  const table = describeChartData(input, ['s'], 'es'); assert.equal(table.status, 'ok'); assert(table.value.columns.includes('Categoría X')); assert.equal(table.value.rows.length, 2); assert(table.value.rows.every(row => row.includes('Enero'))); assert(table.value.rows[0].includes('a')); assert(table.value.rows[1].includes('b')); assert(table.value.rows[1].includes('Medición ausente'));
  const time = describeChartData({ ...data, axes: { ...data.axes, x: { type: 'time' } } }); assert.equal(time.status, 'ok'); assert(time.value.rows[0].includes('1970-01-01T00:00:00.000Z')); assert(time.value.rows[0].includes('0'));
});
test('long category labels wrap with full accessible text and dense labels remain bounded', () => {
  const item = catalog.find(item => item.family === 'bar' && item.id === 'long-labels');
  const rendered = renderChartSvg(item.data, item.options, { instanceId: 'long-labels' }); assert.equal(rendered.status, 'ok'); assert(rendered.value.includes('<g data-axis-label=')); assert(rendered.value.includes('<title>Recomendaciones y referencias de colaboradores</title>'));
});
test('narrow horizontal value axes keep the true zero label for mixed signs', () => {
  const data = { type: 'column', axes: { x: { type: 'category', values: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }] }, y: { type: 'linear' } }, series: [{ id: 's', name: 'S', data: [{ id: 'one', x: 'a', y: -50 }, { id: 'two', x: 'b', y: 50 }] }] };
  const result = renderChartSvg(data, { width: 375, layout: { orientation: 'horizontal' } }, { instanceId: 'zero' }); assert.equal(result.status, 'ok'); assert(result.value.includes('>0</text>'));
});
