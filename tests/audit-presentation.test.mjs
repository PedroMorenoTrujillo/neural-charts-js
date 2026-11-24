import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {renderChartSvg} from '../dist/index.js';
import {escapeXml} from '../dist/svg.js';

const catalogue = JSON.parse(readFileSync(new URL('../examples/web-catalog.json', import.meta.url)));
const data = catalogue.find(recipe => recipe.family === 'waterfall' && recipe.id === 'basic').data;
const settings = {instanceId: 'waterfall', composition: 'chart'};

test('SVG escaping preserves valid Unicode and replaces invalid XML characters', () => {
  assert.equal(escapeXml('𝄞🙂ñ\t\n\r<&"\'\u0000\ud800\uffff'),
    '𝄞🙂ñ\t\n\r&lt;&amp;&quot;&apos;\ufffd\ufffd\ufffd');
});

test('waterfall styles and expanded width survive server export', () => {
  const options = {
    width: 320,
    title: 'Balances',
    appearance: {
      minPlotWidth: 800,
      titleStyle: {align: 'center', fontSize: 26, color: '#334455', fontWeight: 700},
      waterfall: {positiveColor: '#006633', negativeColor: '#aa0033', totalColor: '#223355', connectorColor: '#556677'},
    },
    axes: {x: {title: 'Period', titleStyle: {fontSize: 19, color: '#443322'}}},
  };
  const result = renderChartSvg(data, options, settings);
  assert.equal(result.status, 'ok');
  assert.match(result.value, /viewBox="0 0 928 /);
  assert.match(result.value, /font-size="26" font-weight="700" fill="#334455" text-anchor="middle"/);
  assert.match(result.value, /fill="#443322" font-size="19"/);
  for (const color of ['#006633', '#aa0033', '#223355']) assert.ok(result.value.includes('fill="' + color + '"'));
  assert.ok(result.value.includes('stroke="#556677"'));
});
