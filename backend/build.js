// Cross-platform build script — copies src/ to dist/ with version & cache injection
// Run: node build.js [--minify]

import { readFileSync, writeFileSync, copyFileSync, existsSync, mkdirSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDir = join(__dirname, '..', 'src');
const distDir = join(__dirname, '..', 'dist');
const minify = process.argv.includes('--minify');

// Clean dist
if (existsSync(distDir)) {
  rmSync(distDir, { recursive: true, force: true });
}
mkdirSync(distDir, { recursive: true });

// Read index.html (already has all JS inline)
let html = readFileSync(join(srcDir, 'index.html'), 'utf-8');

// Version & cache injection
const version = process.env.npm_package_version || '1.0.0';
const buildTime = Date.now().toString(36);
html = html.replace(/(<!--.*?-->)?\s*<html/i, `<!-- zimu-english v${version} -->\n<html`);

// Minify (optional)
if (minify) {
  html = html
    .replace(/\/\/.*?[\r\n]/g, '\n')
    .replace(/^\s+/gm, '')
    .replace(/\s+$/gm, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/>\s+</g, '><');
}

// Write dist/index.html
writeFileSync(join(distDir, 'index.html'), html, 'utf-8');

// Copy assets
const assets = ['manifest.json', 'sw.js', 'icon-192.png', 'icon-512.png'];
for (const asset of assets) {
  const src = join(srcDir, asset);
  if (existsSync(src)) {
    copyFileSync(src, join(distDir, asset));
  }
}

// Inject cache version into dist/sw.js (after it's been copied)
const swPath = join(distDir, 'sw.js');
if (existsSync(swPath)) {
  let sw = readFileSync(swPath, 'utf-8');
  sw = sw.replace(/__CACHE_VERSION__/g, `v${version.replace(/\./g,'-')}-${buildTime}`);
  writeFileSync(swPath, sw, 'utf-8');
}

const size = (html.length / 1024).toFixed(1);
console.log(`Build complete: ${size}KB -> dist/index.html`);
