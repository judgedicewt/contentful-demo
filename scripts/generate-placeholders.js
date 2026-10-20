/**
 * Writes one SVG per manifest entry to assets/placeholders/<id>.svg and
 * removes stale files there that are no longer in the manifest.
 * Usage: npm run placeholders
 */
import { mkdirSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { MANIFEST } from '../src/placeholders/manifest.js';
import { renderSvg } from '../src/placeholders/draw.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'assets', 'placeholders');
mkdirSync(outDir, { recursive: true });

const wanted = new Set();
let largest = 0;
for (const entry of MANIFEST) {
  const svg = renderSvg(entry);
  const file = `${entry.id}.svg`;
  writeFileSync(join(outDir, file), svg);
  wanted.add(file);
  largest = Math.max(largest, Buffer.byteLength(svg));
}

let removed = 0;
for (const file of readdirSync(outDir)) {
  if (!wanted.has(file)) {
    unlinkSync(join(outDir, file));
    removed += 1;
  }
}

console.log(
  `Wrote ${wanted.size} placeholder SVGs to assets/placeholders (largest ${(largest / 1024).toFixed(1)} KB)` +
    (removed > 0 ? `, removed ${removed} stale file${removed === 1 ? '' : 's'}` : ''),
);
