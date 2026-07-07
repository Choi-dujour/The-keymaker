// One-off vendoring tool: downloads a pinned three.js release from the npm
// registry into /vendor/ for map.html. Not part of the build — run manually
// (`node scripts/fetch-vendor.mjs`) to bump the pinned version, then commit.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { minify } from 'terser';

const VERSION = '0.178.0';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const vendorDir = path.join(root, 'vendor');
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'three-'));

console.log(`downloading three@${VERSION}…`);
const meta = await fetch(`https://registry.npmjs.org/three/${VERSION}`).then(r => r.json());
const buf = Buffer.from(await fetch(meta.dist.tarball).then(r => r.arrayBuffer()));
const tgz = path.join(work, 'three.tgz');
fs.writeFileSync(tgz, buf);
execFileSync('tar', ['-xzf', tgz, '-C', work,
  'package/build/three.module.min.js',
  'package/build/three.core.min.js',
  'package/examples/jsm/controls/OrbitControls.js']);

fs.mkdirSync(vendorDir, { recursive: true });

// Core: already minified, copy verbatim (build.mjs also copies *.min.js verbatim).
// Since r167 three ships as two files: three.module.min.js imports ./three.core.min.js.
fs.copyFileSync(path.join(work, 'package/build/three.module.min.js'),
  path.join(vendorDir, 'three.module.min.js'));
fs.copyFileSync(path.join(work, 'package/build/three.core.min.js'),
  path.join(vendorDir, 'three.core.min.js'));

// OrbitControls: ships unminified — minify here so it lands as .min.js.
// Its `import ... from 'three'` resolves through map.html's import map.
const oc = fs.readFileSync(path.join(work, 'package/examples/jsm/controls/OrbitControls.js'), 'utf8');
const result = await minify(oc, { module: true, mangle: true, compress: true });
if (result.error) throw result.error;
fs.writeFileSync(path.join(vendorDir, 'OrbitControls.min.js'),
  `// three.js OrbitControls v${VERSION} (MIT) — vendored by scripts/fetch-vendor.mjs\n` + result.code);

fs.rmSync(work, { recursive: true, force: true });
for (const f of fs.readdirSync(vendorDir)) {
  console.log(`vendor/${f}: ${(fs.statSync(path.join(vendorDir, f)).size / 1024).toFixed(0)} KB`);
}
