import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { openInstrumentedPage } from './browser-modules.mjs';

const root = resolve(import.meta.dirname, '..');
const catalogPath = resolve(process.env.NEURAL_CHARTS_CATALOG ??
  resolve(root, '../charts-showcase-canonical/catalog/recipes.json'));
const recipes = JSON.parse(await readFile(catalogPath, 'utf8'));
assert.ok(Array.isArray(recipes) && recipes.length > 0, 'Expected the showcase catalogue.');

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1024, height: 800 }, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const writeCoverage = await openInstrumentedPage(page, '<main style="width:768px"></main>');
  for (let offset = 0; offset < recipes.length; offset += 30) {
    const batch = recipes.slice(offset, offset + 30);
    const failures = await page.evaluate(async batch => {
      const { createChart } = await import('/web/index.js');
      const host = document.querySelector('main');
      const errors = [];
      for (const [index, recipe] of batch.entries()) {
        const id = recipe.family + '/' + recipe.id;
        const chart = createChart(host, recipe.data, recipe.options, { instanceId: 'coverage-' + index });
        if (chart.status === 'invalid') {
          errors.push({ id, diagnostic: chart.diagnostic });
          continue;
        }
        try {
          const svg = host.querySelector('[data-nc-web] svg');
          if (!svg?.getAttribute('viewBox')) errors.push({ id, diagnostic: 'Missing SVG viewport' });
        } finally {
          chart.value.destroy();
          if (host.childElementCount) errors.push({ id, diagnostic: 'Chart DOM leaked after destroy' });
        }
      }
      return errors;
    }, batch);
    assert.deepEqual(failures, [], 'Catalogue mount and teardown');
  }

  const line = recipes.find(recipe => recipe.family === 'line' && recipe.id === 'basic');
  assert.ok(line, 'The line example is required for the browser interaction checks.');
  await page.evaluate(async line => {
    const { createChart } = await import('/web/index.js');
    const result = createChart(document.querySelector('main'), line.data, line.options, { instanceId: 'coverage-interaction' });
    if (result.status === 'invalid') throw Error(result.diagnostic.reason);
    window.testChart = result.value;
  }, line);

  const chart = page.locator('[data-nc-web]');
  await chart.press('Home');
  await chart.getByRole('tooltip').waitFor({ state: 'visible' });
  await chart.press('Enter');
  const legend = chart.locator('button[data-action="legend"][aria-pressed="true"]').first();
  const seriesId = await legend.getAttribute('data-series');
  assert.ok(seriesId);
  await legend.click();
  assert.equal(await chart.locator('button[data-action="legend"][data-series=' + JSON.stringify(seriesId) + ']').getAttribute('aria-pressed'), 'false');
  const exports = await page.evaluate(async () => {
    const chart = window.testChart;
    const svg = chart.exportSvg({ composition: 'chart' });
    const csv = chart.exportCsv();
    const png = await chart.exportPng({ width: 400 });
    chart.destroy();
    return { svg: svg.includes('<svg'), csv: csv.status, png: png.type };
  });
  assert.deepEqual(exports, { svg: true, csv: 'ok', png: 'image/png' });
  assert.deepEqual(errors, []);

  await writeCoverage();
  console.log(`Chromium · ${recipes.length} recipes, keyboard, tooltip, legend and SVG/CSV/PNG export`);
} finally {
  await browser.close();
}
