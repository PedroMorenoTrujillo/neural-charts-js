import test from 'node:test';
import assert from 'node:assert/strict';
import { createCartesianChart, createBarChart } from '../dist/cartesian.js';
import { createFinancialChart } from '../dist/financial.js';

test('granular JavaScript entrypoints contain malformed input instead of throwing or coercing options', () => {
  assert.equal(createCartesianChart(null, null, {}, { instanceId: 'invalid' }).status, 'invalid');
  assert.equal(createBarChart(null, { type: 'column' }, null, { instanceId: 'invalid' }).status, 'invalid');
  assert.equal(createFinancialChart(null, null, {}, { instanceId: 'invalid' }).status, 'invalid');
});
