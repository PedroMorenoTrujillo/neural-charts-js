import test from 'node:test';
import assert from 'node:assert/strict';
import {describeChartData, exportChartCsv} from '../dist/index.js';
import {catalog} from '../tooling/catalog.mjs';

test('every paged table preserves complete columns and exactly the corresponding original rows', () => {
  for (const recipe of catalog) {
    const full = describeChartData(recipe.data, [], 'es'); assert.equal(full.status, 'ok', recipe.family + '/' + recipe.id);
    for (const offset of [0, Math.floor(full.value.rows.length / 2), full.value.rows.length + 1]) {
      const page = describeChartData(recipe.data, [], 'es', {offset, limit: 7}); assert.equal(page.status, 'ok');
      assert.deepEqual(page.value.columns, full.value.columns); assert.deepEqual(page.value.rows, full.value.rows.slice(offset, offset + 7)); assert.equal(page.value.totalRows, full.value.rows.length);
    }
  }
  const data = catalog[0].data;
  for (const page of [null, false, 0, '', [], {limit: 0}, {limit: 1001}, {limit: 1.5}, {limit: 1, offset: -1}, {limit: 1, unknown: true}]) assert.equal(describeChartData(data, [], 'en', page).status, 'invalid');
});

test('contour tables and CSV expose each original sample ID, coordinate and null, not an opaque grid JSON cell', () => {
  const data = {type: 'contour', axes: {x: {type: 'linear'}, y: {type: 'linear'}}, grid: {id: 'grid', x: [1, 3], y: [2, 5], ids: ['a', 'b', 'c', 'd'], values: [1.0000000000000002, null, -2, 0], unit: '°C'}};
  const table = describeChartData(data); assert.equal(table.status, 'ok'); assert.equal(table.value.rows.length, 4);
  assert(table.value.rows[0].includes('a')); assert(table.value.rows[0].includes('1.0000000000000002')); assert(table.value.rows[1].includes('Missing measurement')); assert(table.value.rows[2].includes('-2')); assert(table.value.rows[3].includes('0'));
  const csv = exportChartCsv(data); assert.equal(csv.status, 'ok'); assert(csv.value.includes('"d","3","5","0","°C"'));
  assert.equal(describeChartData({...data, grid: {...data.grid, values: [1]}}).status, 'invalid');
});
