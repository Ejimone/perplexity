/* Copy the Pyodide runtime out of node_modules and into public/.
 *
 * The canvas runs Python entirely offline, so the runtime has to ship inside
 * the installer rather than being fetched from a CDN on first use. public/ is
 * the right home because desktop/prepare.mjs already copies that directory
 * into the standalone build, and desktop/afterPack.cjs stages the result into
 * the packaged app — so landing the files here is the whole delivery story.
 *
 * Only the five runtime files are copied. The package also carries source
 * maps, TypeScript declarations and two demo HTML pages (~1.5 MB) that would
 * otherwise be dead weight in the bundle.
 *
 * Runs from `yarn build:desktop`, and is idempotent: it skips files whose size
 * already matches, so repeated builds do not rewrite 13 MB for nothing.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

const RUNTIME_FILES = [
  'pyodide.mjs',
  'pyodide.asm.mjs',
  'pyodide.asm.wasm',
  'python_stdlib.zip',
  'pyodide-lock.json',
];

const src = path.dirname(require.resolve('pyodide/package.json'));
const dest = path.join(root, 'public', 'pyodide');

fs.mkdirSync(dest, { recursive: true });

let copied = 0;
let skipped = 0;

for (const name of RUNTIME_FILES) {
  const from = path.join(src, name);
  const to = path.join(dest, name);

  if (!fs.existsSync(from)) {
    console.error(`pyodide: missing ${name} in ${src}`);
    process.exit(1);
  }

  const fromStat = fs.statSync(from);
  if (fs.existsSync(to) && fs.statSync(to).size === fromStat.size) {
    skipped++;
    continue;
  }

  fs.copyFileSync(from, to);
  copied++;
}

const version = require('pyodide/package.json').version;
fs.writeFileSync(path.join(dest, 'VERSION'), `${version}\n`);

console.log(
  `pyodide ${version} → public/pyodide (${copied} copied, ${skipped} already current)`,
);
