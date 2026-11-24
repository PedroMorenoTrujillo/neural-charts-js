import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
const root = path.resolve(import.meta.dirname, '..'), base = path.dirname(root), angular = path.join(base, 'neural-charts-angular'), showcase = path.join(base, 'neural-charts-showcase');
const env = { ...process.env, CI: 'true', NG_CLI_ANALYTICS: 'false', NG_BUILD_MAX_WORKERS: '2' }, steps = [];
fs.mkdirSync(path.join(root, 'artifacts'), { recursive: true });
for (const directory of [root, angular, showcase]) if (!JSON.parse(fs.readFileSync(path.join(directory, 'package.json'))).private) throw Error('Private local repository required: ' + directory);
function run(name, command, args, cwd) {
  const log = path.join(root, 'artifacts/sync-' + name + '.log'), fd = fs.openSync(log, 'w');
  const result = spawnSync(command, args, { cwd, env, stdio: ['ignore', fd, fd], timeout: 600000 }); fs.closeSync(fd);
  steps.push({ name, status: result.status, log }); fs.writeFileSync(path.join(root, 'artifacts/local-sync.json'), JSON.stringify({ steps }, null, 2));
  if (result.status !== 0) throw Error('Failed ' + name + '; inspect ' + log);
  console.log('PASS: ' + name);
}
function deliver(file, destination) {
  const bytes = fs.readFileSync(file), hash = createHash('sha256').update(bytes).digest('hex'), name = path.basename(file, '.tgz') + '-' + hash.slice(0,12) + '.tgz';
  fs.mkdirSync(path.join(destination, 'vendor'), { recursive: true }); fs.writeFileSync(path.join(destination, 'vendor', name), bytes); return './vendor/' + name;
}
run('web-tests', 'npm', ['test'], root);
const candidate = JSON.parse(fs.readFileSync(path.join(root, 'docs/core-candidate.json')));
const coreForAngular = deliver(path.join(root, candidate.archive), angular), coreForShowcase = deliver(path.join(root, candidate.archive), showcase);
fs.writeFileSync(path.join(showcase,'catalog/core-candidate.json'),JSON.stringify({...candidate,archive:coreForShowcase.replace(/^\.\//,'')},null,2)+'\n');
run('web-catalog', process.execPath, ['tooling/verify-catalog.mjs'], root);
run('web-recipes', process.execPath, ['tooling/catalog.mjs'], root);
run('web-pack', process.execPath, ['tooling/pack-web.mjs'], root);
const webArchive = path.join(root, 'artifacts/neural-charts-web-0.0.0.tgz'), webForAngular = deliver(webArchive, angular), webForShowcase = deliver(webArchive, showcase);
run('angular-web-install', 'npm', ['install', coreForAngular, webForAngular, '--ignore-scripts', '--no-audit', '--no-fund'], angular);
run('angular-package', 'npm', ['run', 'build'], angular);
const angularForShowcase = deliver(path.join(angular, 'artifacts/neural-charts-angular-0.0.0.tgz'), showcase);
run('showcase-packages-install', 'npm', ['install', coreForShowcase, webForShowcase, angularForShowcase, '--ignore-scripts', '--no-audit', '--no-fund'], showcase);
const cataloguePath = path.join(showcase, 'catalog/recipes.json');
const generated = JSON.parse(fs.readFileSync(path.join(root, 'examples/web-catalog.json')));
const recipeKey = recipe => recipe.family + '/' + recipe.id;
const pending = new Map(generated.map(recipe => [recipeKey(recipe), recipe]));
const existing = JSON.parse(fs.readFileSync(cataloguePath));
const merged = existing.map(recipe => {
  const key = recipeKey(recipe);
  const replacement = pending.get(key);
  pending.delete(key);
  return replacement ?? recipe;
});
fs.writeFileSync(cataloguePath, JSON.stringify([...merged, ...pending.values()], null, 2));
const native = JSON.parse(fs.readFileSync(path.join(root, 'examples/native-recipes.json'))), financial = JSON.parse(fs.readFileSync(path.join(root, 'examples/financial-metadata.json')));
fs.writeFileSync(path.join(showcase, 'catalog/metadata.json'), JSON.stringify({ groups: [...native.groups, ...financial.groups], capabilities: { ...native.capabilities, ...financial.capabilities }, familyCopy: { ...native.familyCopy, ...financial.familyCopy }, financialParameters: financial.parameters }, null, 2));
run('showcase-catalog', process.execPath, ['tooling/prepare-catalog.mjs'], showcase);
console.log('Updated only hashed local archives and generated examples; no publish or source links.');
