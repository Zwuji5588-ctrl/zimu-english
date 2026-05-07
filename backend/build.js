// Cross-platform build script — inlines content.js into index.html
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

// Read sources
let html = readFileSync(join(srcDir, 'index.html'), 'utf-8');
const contentScript = readFileSync(join(srcDir, 'content.js'), 'utf-8');

// Inline content.js
const date = new Date().toISOString().slice(0, 10);
html = html.replace(
  '<script src="content.js"></script>',
  `<script>\n// content.js - generated ${date}\n${contentScript}\n</script>`
);

// Version injection
const version = process.env.npm_package_version || '1.0.0';
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
const assets = ['content.js', 'manifest.json', 'sw.js', 'icon-192.png', 'icon-512.png', 'icon-192.svg', 'icon-512.svg'];
for (const asset of assets) {
  const src = join(srcDir, asset);
  if (existsSync(src)) {
    copyFileSync(src, join(distDir, asset));
  }
}

const size = (html.length / 1024).toFixed(1);
console.log(`Build complete: ${size}KB -> dist/index.html`);
