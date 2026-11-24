import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export function writeCoreVersion(root) {
  const installed = JSON.parse(readFileSync(path.join(root, 'node_modules/@neural-charts/core/package.json'), 'utf8'));
  const output = path.join(root, 'src/core-version.ts');
  const content = '/** Generated from the installed Core package. */\nexport const coreVersion = ' +
    JSON.stringify(installed.version) + ';\n';
  if (!existsSync(output) || readFileSync(output, 'utf8') !== content) writeFileSync(output, content);
}

if (process.argv[1] === import.meta.filename) writeCoreVersion(path.resolve(import.meta.dirname, '..'));
