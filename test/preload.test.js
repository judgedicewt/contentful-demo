import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const site = join(here, '..', 'site');

function modulesUnder(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...modulesUnder(path));
    else if (name.endsWith('.js') && !/^config.*\.js$/.test(name)) out.push(relative(site, path).split('\\').join('/'));
  }
  return out.sort();
}

test('index.html preloads every module under site/ and nothing else', () => {
  const html = readFileSync(join(site, 'index.html'), 'utf8');
  const preloaded = [...html.matchAll(/<link rel="modulepreload" href="([^"]+)">/g)].map((m) => m[1]).sort();
  assert.deepEqual(preloaded, modulesUnder(site));
  assert.doesNotMatch(html, /modulepreload" href="config/);
});

test('index.html preconnects to the Contentful API and image hosts', () => {
  const html = readFileSync(join(site, 'index.html'), 'utf8');
  assert.match(html, /<link rel="preconnect" href="https:\/\/cdn\.contentful\.com">/);
  assert.match(html, /<link rel="preconnect" href="https:\/\/images\.ctfassets\.net">/);
});
