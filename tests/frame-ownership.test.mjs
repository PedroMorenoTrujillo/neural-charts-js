import test from 'node:test';
import assert from 'node:assert/strict';
import {planWebChart} from '../dist/index.js';
import {catalog} from '../tooling/catalog.mjs';

test('every public Core frame tree is immutable, including the Web unit override', () => {
  for (const recipe of catalog) {
    const planned = planWebChart(recipe.data, {...recipe.options, unit: 'Original unit'}, {width: 640, height: 320}, [], {measureWords: requests => requests.map(r => ({...r, width: r.text.length * r.fontSize * .65, height: r.fontSize * 1.4}))});
    assert.equal(planned.status, 'ok', recipe.family + '/' + recipe.id);
    const visited = new WeakSet();
    function visit(value, path) {
      if (!value || typeof value !== 'object' || visited.has(value)) return;
      visited.add(value); assert(Object.isFrozen(value), recipe.family + '/' + recipe.id + ': mutable frame node ' + path);
      for (const [key, child] of Object.entries(value)) visit(child, path + '.' + key);
    }
    visit(planned.value, 'frame');
  }
});
