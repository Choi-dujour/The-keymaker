// Build step: copies the static site into dist/, minifying inline <script>
// blocks and shared.js with terser. No bundling — file layout/URLs stay
// identical, just smaller and harder to read casually.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { minify } from 'terser';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const distDir = path.join(root, 'dist');

const SKIP_TOP_LEVEL = new Set([
  '.git', '.github', 'node_modules', 'api', 'scripts', 'dist', '.vercel',
  'package.json', 'package-lock.json', '.gitignore', 'vercel.json',
]);

const SCRIPT_TAG_RE = /<script((?:(?!src=)[^>])*)>([\s\S]*?)<\/script>/g;

async function minifyInlineScripts(html) {
  const matches = [...html.matchAll(SCRIPT_TAG_RE)];
  let out = html;
  for (const m of matches) {
    const [full, attrs, code] = m;
    if (!code.trim()) continue;
    // importmap/JSON blocks are not JavaScript — terser would fail on them
    if (/type\s*=\s*["']?(importmap|application\/(ld\+)?json)/i.test(attrs)) continue;
    const isModule = /type\s*=\s*["']?module/i.test(attrs);
    const result = await minify(code, { mangle: true, compress: true, module: isModule });
    if (result.error) throw result.error;
    out = out.replace(full, `<script${attrs}>${result.code}</script>`);
  }
  return out;
}

async function buildFile(srcPath, destPath) {
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  if (srcPath.endsWith('.html')) {
    const html = fs.readFileSync(srcPath, 'utf8');
    fs.writeFileSync(destPath, await minifyInlineScripts(html));
  } else if (srcPath.endsWith('.min.js')) {
    // vendored libraries are already minified — copy verbatim
    fs.copyFileSync(srcPath, destPath);
  } else if (srcPath.endsWith('.js')) {
    const code = fs.readFileSync(srcPath, 'utf8');
    const isModule = /^\s*(import|export)\b/m.test(code);
    const result = await minify(code, { mangle: true, compress: true, module: isModule });
    if (result.error) throw result.error;
    fs.writeFileSync(destPath, result.code);
  } else {
    fs.copyFileSync(srcPath, destPath);
  }
}

async function walk(dir, relDir = '') {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (relDir === '' && SKIP_TOP_LEVEL.has(entry.name)) continue;
    const srcPath = path.join(dir, entry.name);
    const relPath = path.join(relDir, entry.name);
    if (entry.isDirectory()) {
      await walk(srcPath, relPath);
    } else {
      await buildFile(srcPath, path.join(distDir, relPath));
    }
  }
}

fs.rmSync(distDir, { recursive: true, force: true });
await walk(root);
console.log('Build complete: dist/');
