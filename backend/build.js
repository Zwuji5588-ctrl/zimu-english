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

// Read index.html with external data references
let html = readFileSync(join(srcDir, 'index.html'), 'utf-8');

// Inline data/content.js
const contentJsPath = join(srcDir, 'data', 'content.js');
if (existsSync(contentJsPath)) {
  const contentJs = readFileSync(contentJsPath, 'utf-8');
  const dataDate = new Date().toISOString().slice(0, 10);
  html = html.replace(
    '<script src="data/content.js"></script>',
    `<script>\n// content.js - generated ${dataDate}\n${contentJs}\n</script>`
  );
}

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

// ── Emoji → SVG replacement (build-time, keeps source clean) ──
const EMOJI_SVG = {
  // UI icons
  '🔍': '<svg wf="18" hf="18" vb="0 0 24 24" fill="none" stroke="currentColor" sw="2.5" lc="round" lj="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>',
  '⚙': '<svg wf="16" hf="16" vb="0 0 24 24" fill="none" stroke="currentColor" sw="2" lc="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  '🔊': '<svg wf="18" hf="18" vb="0 0 24 24" fill="none" stroke="currentColor" sw="2.5" lc="round" lj="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>',
  '📖': '<svg wf="18" hf="18" vb="0 0 24 24" fill="none" stroke="currentColor" sw="2.5" lc="round" lj="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
  '🎧': '<svg wf="18" hf="18" vb="0 0 24 24" fill="none" stroke="currentColor" sw="2.5" lc="round" lj="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z"/><path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>',
  '🎤': '<svg wf="18" hf="18" vb="0 0 24 24" fill="none" stroke="currentColor" sw="2.5" lc="round" lj="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0"/><path d="M8 21h8"/><path d="M12 17v4"/></svg>',
  '📝': '<svg wf="16" hf="16" vb="0 0 24 24" fill="none" stroke="currentColor" sw="2" lc="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
  '📊': '<svg wf="16" hf="16" vb="0 0 24 24" fill="none" stroke="currentColor" sw="2" lc="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>',
  '📅': '<svg wf="16" hf="16" vb="0 0 24 24" fill="none" stroke="currentColor" sw="2" lc="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  '✏️': '<svg wf="16" hf="16" vb="0 0 24 24" fill="none" stroke="currentColor" sw="2" lc="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>',
  '✏': '<svg wf="16" hf="16" vb="0 0 24 24" fill="none" stroke="currentColor" sw="2" lc="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>',
  '🗑️': '<svg wf="16" hf="16" vb="0 0 24 24" fill="none" stroke="currentColor" sw="2" lc="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>',
  '🗑': '<svg wf="16" hf="16" vb="0 0 24 24" fill="none" stroke="currentColor" sw="2" lc="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>',
  '✅': '<svg wf="18" hf="18" vb="0 0 24 24" fill="none" stroke="currentColor" sw="2.5" lc="round" lj="round"><polyline points="20 6 9 17 4 12"/></svg>',
  '❌': '<svg wf="18" hf="18" vb="0 0 24 24" fill="none" stroke="currentColor" sw="2.5" lc="round" lj="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
  '🔄': '<svg wf="16" hf="16" vb="0 0 24 24" fill="none" stroke="currentColor" sw="2" lc="round"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>',
  '📋': '<svg wf="16" hf="16" vb="0 0 24 24" fill="none" stroke="currentColor" sw="2" lc="round"><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>',
  '👤': '<svg wf="16" hf="16" vb="0 0 24 24" fill="none" stroke="currentColor" sw="2" lc="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  '⭐': '<svg wf="16" hf="16" vb="0 0 24 24" fill="none" stroke="currentColor" sw="2" lc="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  '☆': '<svg wf="16" hf="16" vb="0 0 24 24" fill="none" stroke="currentColor" sw="2" lc="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  '🎯': '<svg wf="16" hf="16" vb="0 0 24 24" fill="none" stroke="currentColor" sw="2" lc="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
  '📚': '<svg wf="16" hf="16" vb="0 0 24 24" fill="none" stroke="currentColor" sw="2" lc="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><path d="M2 6h4v14H2z"/></svg>',
  '📌': '<svg wf="16" hf="16" vb="0 0 24 24" fill="none" stroke="currentColor" sw="2" lc="round"><path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/><circle cx="12" cy="10" r="3"/></svg>',
  '♾️': '<svg wf="16" hf="16" vb="0 0 24 24" fill="none" stroke="currentColor" sw="2" lc="round"><path d="M12 12c-2-2.67-4-4-6-4a4 4 0 1 0 0 8c2 0 4-1.33 6-4Zm0 0c2 2.67 4 4 6 4a4 4 0 1 1 0-8c-2 0-4 1.33-6 4Z"/></svg>',
  '🏆': '<svg wf="16" hf="16" vb="0 0 24 24" fill="none" stroke="currentColor" sw="2" lc="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5C7 4 9 6 6 9z"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5C17 4 15 6 18 9z"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>',
  '❤️': '<svg wf="16" hf="16" vb="0 0 24 24" fill="none" stroke="currentColor" sw="2" lc="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>',
  '💪': '<svg wf="24" hf="24" vb="0 0 24 24" fill="none" stroke="currentColor" sw="2" lc="round"><path d="M21 14a3.28 3.28 0 0 1-1 9c-2.5 0-5-3-7-7-2 4-4.5 7-7 7a3.28 3.28 0 0 1-1-9c2-1 4-2 4-5V4h4v5c0 3 2 4 4 5Z"/></svg>',
  '🖼️': '<svg wf="16" hf="16" vb="0 0 24 24" fill="none" stroke="currentColor" sw="2" lc="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>',
  '🎉': '<svg wf="16" hf="16" vb="0 0 24 24" fill="none" stroke="currentColor" sw="2" lc="round"><path d="m20 2-4 4 2 2 4-4-2-2z"/><path d="m7 10-3 3 2 2 3-3-2-2z"/><path d="m18 7-4 4 2 2 4-4-2-2z"/><path d="M9 14a5 5 0 0 0 7 7l-7-7z"/><path d="m14 9-5 5 2 2 5-5-2-2z"/><path d="M4 18a5 5 0 0 0 7 7l-7-7z"/></svg>',
  '👍': '<svg wf="16" hf="16" vb="0 0 24 24" fill="none" stroke="currentColor" sw="2" lc="round"><path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z"/></svg>',
  '🔗': '<svg wf="16" hf="16" vb="0 0 24 24" fill="none" stroke="currentColor" sw="2" lc="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
  '🧩': '<svg wf="16" hf="16" vb="0 0 24 24" fill="none" stroke="currentColor" sw="2" lc="round"><path d="M19.44 7.85c-.05.32.06.65.29.88l1.56 1.57c.47.47.71 1.09.71 1.7 0 .62-.24 1.24-.71 1.71l-1.61 1.6a.98.98 0 0 1-.84.28c-.47-.07-.8-.49-.97-.93a2.5 2.5 0 1 0-3.21 3.21c.44.17.86.5.93.97a.98.98 0 0 1-.28.84l-1.6 1.61a2.41 2.41 0 0 1-3.42 0l-1.57-1.57a1.03 1.03 0 0 0-.88-.29c-.49.08-.84.5-1.02.97a2.5 2.5 0 1 1-3.24-3.24c.47-.18.89-.53.97-1.02a1.03 1.03 0 0 0-.29-.88l-1.57-1.57a2.41 2.41 0 0 1 0-3.42l1.6-1.6a.98.98 0 0 1 .84-.28c.47.07.8.49.97.93a2.5 2.5 0 1 0 3.21-3.21c-.44-.17-.86-.5-.93-.97a.98.98 0 0 1 .28-.84l1.6-1.6a2.41 2.41 0 0 1 3.42 0l1.57 1.57c.23.23.56.34.88.29.5-.08.84-.5 1.02-.97a2.5 2.5 0 1 1 3.24 3.24c-.47.18-.89.53-.97 1.02Z"/></svg>',
  // Decorative
  '🌿': '<svg wf="40" hf="40" vb="0 0 24 24" fill="none" stroke="currentColor" sw="1.5" lc="round"><path d="M17 7c0 2.5-1.5 5-4 6-2.5-1-4-3.5-4-6 0-2.5 1.5-5 4-6 2.5 1 4 3.5 4 6Z"/><path d="M9 17c0 2.5 1.5 5 4 6 2.5-1 4-3.5 4-6 0-2.5-1.5-5-4-6-2.5 1-4 3.5-4 6Z"/><path d="M13 13V1"/></svg>',
};

// Normalize SVG attributes for HTML compatibility
// (wf=width, hf=height, vb=viewBox, sw=stroke-width, lc=stroke-linecap)
function normalizeSvg(svg) {
  return svg
    .replace(/ wf="/g, ' width="')
    .replace(/ hf="/g, ' height="')
    .replace(/ vb="/g, ' viewBox="')
    .replace(/ sw="/g, ' stroke-width="')
    .replace(/ lc="/g, ' stroke-linecap="')
    .replace(/ lj="/g, ' stroke-linejoin="');
}

// Apply emoji→SVG replacement (skip <style> blocks)
let emojiCount = 0;
const parts = html.split(/(<style[\s\S]*?<\/style>)/g);
for (let i = 0; i < parts.length; i++) {
  if (parts[i].startsWith('<style')) continue; // skip CSS blocks
  Object.keys(EMOJI_SVG).forEach(emoji => {
    const regex = new RegExp(emoji.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    parts[i] = parts[i].replace(regex, () => {
      emojiCount++;
      return normalizeSvg(EMOJI_SVG[emoji]);
    });
  });
}
html = parts.join('');
if (emojiCount > 0) console.log(`Emoji → SVG: ${emojiCount} replacements`);

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
