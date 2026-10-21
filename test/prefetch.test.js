import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { siblingSlugs, prefetchFamily, warmHeroImages } from '../site/js/prefetch.js';

const vehicles = JSON.parse(readFileSync(new URL('./fixtures/render-vehicle.json', import.meta.url), 'utf8'));

test('siblingSlugs lists the rest of the family, root first, without the current entry', () => {
  assert.deepEqual(siblingSlugs({ entry: vehicles.full, variants: vehicles.variants }), ['750s-spider']);
  assert.deepEqual(siblingSlugs({ entry: vehicles.spider, variants: vehicles.variants }), ['750s']);
  assert.deepEqual(siblingSlugs({ entry: vehicles.spider, variants: [] }), ['750s']);
  assert.deepEqual(siblingSlugs({ entry: vehicles.legacy, variants: [] }), []);
  assert.deepEqual(siblingSlugs(null), []);
});

test('prefetchFamily fetches each sibling at include depth 6 through the scheduler and can be cancelled', async () => {
  const calls = [];
  const cda = { getBySlug: async (...args) => { calls.push(args); return null; } };
  let run;
  const cancelled = [];
  const schedule = (fn) => { run = fn; return () => cancelled.push(true); };
  const cancel = prefetchFamily(cda, { entry: vehicles.spider, variants: vehicles.variants }, { schedule });
  assert.deepEqual(calls, [], 'nothing fetched before the scheduler fires');
  run();
  await Promise.resolve();
  assert.deepEqual(calls, [['vehicle', '750s', 6]]);
  cancel();
  assert.equal(cancelled.length, 1);
  assert.equal(typeof prefetchFamily(cda, { entry: vehicles.legacy, variants: [] }, { schedule }), 'function', 'no siblings still returns a cancel');
});

test('prefetchFamily swallows fetch failures', async () => {
  const cda = { getBySlug: async () => { throw new Error('offline'); } };
  let run;
  prefetchFamily(cda, { entry: vehicles.full, variants: vehicles.variants }, { schedule: (fn) => { run = fn; return () => {}; } });
  run();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.ok(true, 'no unhandled rejection');
});

test('warmHeroImages creates one image per non-current link with srcset, sizes and src', () => {
  const link = (attrs, current = false) => ({
    hasAttribute: (name) => name === 'aria-current' && current,
    dataset: attrs,
  });
  const menu = { querySelectorAll: () => [link({ heroSrcset: 'a 800w, b 1920w', heroSrc: 'b' }), link({ heroSrcset: 'x 800w', heroSrc: 'x' }, true)] };
  const images = [];
  warmHeroImages(menu, { createImage: () => { const img = {}; images.push(img); return img; } });
  assert.deepEqual(images, [{ sizes: '100vw', srcset: 'a 800w, b 1920w', src: 'b' }]);
  assert.doesNotThrow(() => warmHeroImages(null));
});
