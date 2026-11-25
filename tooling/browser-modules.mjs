import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const origin = 'http://charts-coverage.invalid';
const root = resolve(import.meta.dirname, '..');

async function collectModules(directory, prefix, target) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const file = resolve(directory, item.name);
    const route = prefix + '/' + item.name;
    if (item.isDirectory()) await collectModules(file, route, target);
    if (item.isFile() && item.name.endsWith('.js')) target.set(route, file);
  }
}

export async function openInstrumentedPage(page, markup, language = 'es') {
  const directory = process.env.NODE_V8_COVERAGE;
  assert.ok(directory, 'Run the browser collector under c8.');
  const production = new Map();
  const dependencies = new Map();
  const core = resolve(root, 'node_modules/@neural-charts/core');
  await collectModules(resolve(root, 'dist'), '/web', production);
  await collectModules(resolve(core, 'dist/runtime'), '/core/dist/runtime', dependencies);
  const corePackage = JSON.parse(await readFile(resolve(core, 'package.json'), 'utf8'));
  const imports = {};
  for (const [key, conditions] of Object.entries(corePackage.exports)) {
    const path = typeof conditions === 'string' ? conditions : conditions.import ?? conditions.default;
    if (!path?.endsWith('.js')) continue;
    const specifier = key === '.' ? '@neural-charts/core' : '@neural-charts/core/' + key.slice(2);
    imports[specifier] = '/core/' + path.replace(/^\.\//, '');
  }
  const html = `<!doctype html><html lang="${language}"><meta charset="utf-8"><title>Medición de cobertura</title>
    <script type="importmap">${JSON.stringify({ imports })}</script><body>${markup}</body></html>`;

  await page.route(origin + '/**', async route => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === '/') {
      await route.fulfill({ status: 200, contentType: 'text/html', body: html });
      return;
    }
    const file = production.get(pathname) ?? dependencies.get(pathname);
    if (!file) {
      await route.fulfill({ status: 404 });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'text/javascript', path: file });
  });
  await page.coverage.startJSCoverage({ resetOnNavigation: false });
  await page.goto(origin);

  return async function writeCoverage(entrypoint = 'owner.js') {
    const entries = await page.coverage.stopJSCoverage();
    const result = [];
    for (const entry of entries) {
      const url = new URL(entry.url, origin);
      if (url.origin !== origin) continue;
      const source = production.get(url.pathname);
      if (!source) continue;
      assert.equal(entry.source, await readFile(source, 'utf8'), 'Browser source matches the installed JS exactly');
      result.push({ url: pathToFileURL(source).href, scriptId: entry.scriptId, functions: entry.functions });
    }
    assert.ok(result.some(entry => entry.url.endsWith('/' + entrypoint)), 'Missing Web coverage for ' + entrypoint);
    await writeFile(resolve(directory, 'coverage-chromium-' + randomUUID() + '.json'), JSON.stringify({ result }));
  };
}
