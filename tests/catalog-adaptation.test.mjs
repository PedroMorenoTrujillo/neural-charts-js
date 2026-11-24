import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {recipeForWeb, nativeCatalog} from '../tooling/catalog.mjs';

test('Native transport preserves visibility, explicit totals and the four independent-panel examples', () => {
  const raw = JSON.parse(fs.readFileSync(new URL('../examples/native-recipes.json', import.meta.url)));
  let single = 0, totals = 0, panels = 0;
  for (const item of raw.examples) {
    const before = JSON.stringify(item), transported = recipeForWeb(item);
    assert.equal(JSON.stringify(item), before);
    if (['column', 'bar'].includes(item.family) && item.settings.columnLayout === 'single') {
      assert.deepEqual(transported.options.hiddenSeriesIds, item.spec.series.slice(1).map(s => s.id)); single++;
    }
    if (item.settings.showStackLabels === true) { assert.equal(transported.options.appearance.stackLabels, true); totals++; }
    if (item.family === 'mixed' && item.id.startsWith('panels-')) {
      assert.deepEqual(transported.composition, {columns: item.id === 'panels-responsive' ? 'auto' : 1, linkedVisibility: ['panels-linked', 'panels-responsive'].includes(item.id)}); panels++;
    }
    assert.deepEqual(transported, nativeCatalog.find(r => r.family === item.family && r.id === item.id));
  }
  assert.deepEqual({single, totals, panels}, {single: 2, totals: 13, panels: 4});
});
