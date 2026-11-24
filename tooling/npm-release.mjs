import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const [command, kind] = process.argv.slice(2);
const name = '@neural-charts/' + kind;
const tag = process.env.RELEASE_TAG ?? process.env.GITHUB_REF_NAME ?? '';
assert.ok(kind === 'web' || kind === 'angular', 'Select web or angular');
assert.match(tag, /^v[1-9]\d*\.\d+\.\d+$/, 'Use a stable version tag such as v1.0.0');
const version = tag.slice(1);
const out = path.resolve('release');
const archive = path.join(out, 'neural-charts-' + kind + '-' + version + '.tgz');
const receiptFile = path.join(out, 'receipt.json');
const registry = 'https://registry.npmjs.org';
const homepage = 'https://charts.neuralui.org/';
const digest = bytes => 'sha512-' + createHash('sha512').update(bytes).digest('base64');

async function metadata(packageName, versionOrTag) {
  const url = registry + '/' + encodeURIComponent(packageName) + '/' + versionOrTag;
  const response = await fetch(url, {cache:'no-store', signal:AbortSignal.timeout(12000)});
  if (response.status === 404) return;
  assert.ok(response.ok, 'Registry returned ' + response.status + ' for ' + packageName);
  return response.json();
}

function readManifest(file) {
  return JSON.parse(execFileSync('tar', ['-xOzf', file, 'package/package.json'], {encoding:'utf8'}));
}

function releaseDocs(root) {
  const file = path.join(root, 'README.md');
  let readme = fs.readFileSync(file, 'utf8');
  readme = readme.replace(/^(# Neural Charts[^\n]+)\n/, '$1\n\n[Documentation and examples](' + homepage + ')\n');
  if (kind === 'web') {
    readme = readme.replace('Private TypeScript-source, JavaScript-distribution', 'TypeScript-source, JavaScript-distribution')
      .replace(/^The independent repositories.*\n\n/m, '')
      .replace(/^The package is not published.*$/m, 'Install with `npm install @neural-charts/web`. npm installs `@neural-charts/core` as a dependency.')
      .replace(/^The catalogue groups.*$/m, 'Explore the [showcase](' + homepage + ') or see [Web API](./docs/WEB-API.md) and [Custom content](./docs/CUSTOM-CONTENT.md).');
    const api = path.join(root, 'docs/WEB-API.md');
    const source = fs.readFileSync(api, 'utf8')
      .replace(/^This private package.*$/m, 'Neural Charts Web provides ESM JavaScript and TypeScript declarations. It uses @neural-charts/core for scales, layouts and data calculations.')
      .replace(/^Run `npm ci`.*$/m, 'Run `npm install @neural-charts/web` in your application. npm installs Core automatically.');
    fs.writeFileSync(api, source);
  } else {
    readme = readme.replace(/^Private local adapter for Angular22\.2\.3 over @neural-charts\/web\./m, 'Angular 22.2.3 or later within Angular 22, powered by @neural-charts/web.')
      .replace('the only package runtime dependency is Web', 'Web is the renderer peer dependency')
      .replace(/^This package is not authorized.*$/m, 'Install with `npm install @neural-charts/angular`. npm resolves the compatible Web peer and its Core dependency. The application supplies compatible Angular Core and Common versions.');
  }
  fs.writeFileSync(file, readme);
}

function pack() {
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'neural-charts-release-'));
  try {
    fs.mkdirSync(out, {recursive:true});
    const local = JSON.parse(fs.readFileSync(kind === 'web' ? 'package.json' : 'projects/charts/package.json', 'utf8'));
    const input = path.resolve('artifacts', 'neural-charts-' + kind + '-' + local.version + '.tgz');
    execFileSync('tar', ['-xzf', input, '-C', stage]);
    const root = path.join(stage, 'package');
    const file = path.join(root, 'package.json');
    const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(manifest.name, name);
    manifest.version = version;
    manifest.license = 'MIT';
    fs.copyFileSync('LICENSE', path.join(root, 'LICENSE'));
    manifest.homepage = homepage;
    manifest.repository = {type:'git', url:'git+https://github.com/PedroMorenoTrujillo/' + (kind === 'web' ? 'neural-charts-js' : 'neural-charts-angular') + '.git'};
    manifest.publishConfig = {access:'public', registry};
    delete manifest.private;
    delete manifest.scripts;
    if (kind === 'web') {
      assert.match(manifest.dependencies?.['@neural-charts/core'] ?? '', /^\d+\.\d+\.\d+$/);
      manifest.files = manifest.files.filter(file => file !== 'docs/core-candidate.json');
      fs.rmSync(path.join(root, 'docs/core-candidate.json'), {force:true});
    } else {
      const web = process.env.WEB_RELEASE_VERSION ?? version;
      assert.match(web, /^\d+\.\d+\.\d+$/);
      manifest.peerDependencies['@neural-charts/web'] = '^' + web;
    }
    fs.writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n');
    releaseDocs(root);
    const [result] = JSON.parse(execFileSync('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', out], {cwd:root, encoding:'utf8'}));
    assert.equal(path.join(out, result.filename), archive);
    assert.ok(!result.files.some(({path}) => /(^|\/)(vendor|\.npmrc|node_modules)(\/|$)/.test(path)));
    fs.writeFileSync(receiptFile, JSON.stringify({name, version, integrity:digest(fs.readFileSync(archive))}, null, 2) + '\n');
  } finally {
    fs.rmSync(stage, {recursive:true, force:true});
  }
}

async function check() {
  const receipt = JSON.parse(fs.readFileSync(receiptFile, 'utf8'));
  assert.equal(receipt.name, name);
  assert.equal(receipt.version, version);
  assert.equal(receipt.integrity, digest(fs.readFileSync(archive)));
  const manifest = readManifest(archive);
  assert.equal(manifest.name, name);
  assert.equal(manifest.version, version);
  if (kind === 'angular') {
    const required = manifest.peerDependencies['@neural-charts/web'].slice(1);
    assert.ok(await metadata('@neural-charts/web', required), 'Publish Web ' + required + ' first');
  } else {
    assert.ok(await metadata('@neural-charts/core', manifest.dependencies['@neural-charts/core']), 'Publish the Core dependency first');
  }
  return receipt;
}

async function publish() {
  const receipt = await check();
  const existing = await metadata(name, version);
  if (!existing) {
    const latest = await metadata(name, 'latest');
    if (latest?.version) {
      const current = latest.version.split('.').map(Number);
      const next = version.split('.').map(Number);
      const changed = next.findIndex((part, index) => part !== current[index]);
      assert.ok(changed >= 0 && next[changed] > current[changed], 'Refusing to move latest backwards');
    }
    execFileSync('npm', ['publish', archive, '--access', 'public', '--tag', 'latest', '--ignore-scripts'], {stdio:'inherit'});
  }
  for (let attempt = 0; attempt < 30; attempt++) {
    const data = await metadata(name, version);
    if (data) {
      assert.equal(data.dist.integrity, receipt.integrity, 'The existing version has different contents');
      console.log(name + '@' + version + ' verified in npm');
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  throw Error('Release did not appear in npm');
}

if (command === 'pack') pack();
else if (command === 'check') await check();
else if (command === 'publish') await publish();
else throw Error('Use pack, check or publish');
