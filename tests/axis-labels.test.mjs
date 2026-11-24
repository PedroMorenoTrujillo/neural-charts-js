import test from 'node:test';
import assert from 'node:assert/strict';
import { axisLabelIndices, axisLabelLines } from '../dist/axis-labels.js';
test('narrow axis labels preserve evenly spaced endpoints and use remaining line space', () => {
  assert.deepEqual([...axisLabelIndices(5, 3)], [0, 2, 4]); assert.deepEqual([...axisLabelIndices(0, 3)], []); assert.deepEqual([...axisLabelIndices(1, 3)], [0]);
  assert.deepEqual([...axisLabelIndices(5, 4)], [0, 2, 4], 'Numeric labels retain a uniform interval instead of skipping only the middle tick');
  const lines = axisLabelLines('Recomendaciones y referencias de colaboradores', 14, 3); assert.equal(lines.length, 3); assert(lines[2].startsWith('de co')); assert(lines[2].endsWith('…'));
});
