import test from 'node:test';
import assert from 'node:assert/strict';
import { MANIFEST, SIZES, KINDS, PALETTE_NAMES, SILHOUETTES } from '../src/placeholders/manifest.js';
import { renderSvg } from '../src/placeholders/draw.js';
import { ASSET_SEEDS, ASSET_GROUP, buildAssetSeeds, assetId } from '../src/seed/assets.js';

const CURRENT = ['artura', 'artura-spider', '750s', '750s-spider', 'gts', 'w1', 'artura-gt4'];
const CURRENT_PURPOSES = ['hero', 'card', 'overview-1', 'overview-2', 'exterior', 'interior', 'mso'];
const LEGACY = ['720s', '765lt', 'p1', 'f1'];
const LEGACY_PURPOSES = ['hero', 'card'];
const STORIES = ['750s-facts', 'artura-spider', 'w1', 'mso'];

const REQUIRED_IDS = [
  ...CURRENT.flatMap((slug) => CURRENT_PURPOSES.map((purpose) => `img-${slug}-${purpose}`)),
  ...LEGACY.flatMap((slug) => LEGACY_PURPOSES.map((purpose) => `img-${slug}-${purpose}`)),
  'img-lineage-765lt',
  'img-lineage-720s',
  'img-lineage-f1',
  'img-lineage-p1',
  'img-cat-supercars',
  'img-cat-grand-tourer',
  'img-cat-ultimate',
  'img-cat-motorsport',
  'img-home-hero',
  'img-legacy-hero',
  'img-legacy-2010s-hero',
  'img-legacy-1990s-hero',
  'img-ownership-hero',
  'img-experiences-hero',
  'img-mso-hero',
  'img-mso-banner',
  'img-mcl-6gt-banner',
  'img-experience-winter-ball',
  'img-experience-arctic',
  'img-experience-track-day',
  ...STORIES.flatMap((slug) => [`img-story-${slug}-hero`, `img-story-${slug}-inline`]),
  'img-og-default',
];

const MAX_BYTES = 20 * 1024;

test('manifest IDs are unique and well-formed', () => {
  const ids = MANIFEST.map((entry) => entry.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate manifest IDs');
  for (const id of ids) {
    assert.match(id, /^img-[a-z0-9-]+$/, `bad ID ${id}`);
  }
});

test('manifest entries use known kinds, palettes, and silhouettes', () => {
  for (const entry of MANIFEST) {
    assert.ok(KINDS.includes(entry.kind), `${entry.id}: unknown kind ${entry.kind}`);
    assert.ok(PALETTE_NAMES.includes(entry.palette), `${entry.id}: unknown palette ${entry.palette}`);
    assert.ok(SILHOUETTES.includes(entry.silhouette), `${entry.id}: unknown silhouette ${entry.silhouette}`);
    assert.ok(entry.label && typeof entry.label === 'string', `${entry.id}: missing label`);
  }
});

test('manifest covers the minimum set from the plan', () => {
  const ids = new Set(MANIFEST.map((entry) => entry.id));
  const missing = REQUIRED_IDS.filter((id) => !ids.has(id));
  assert.deepEqual(missing, [], `missing required IDs: ${missing.join(', ')}`);
  assert.equal(new Set(REQUIRED_IDS).size, REQUIRED_IDS.length);
});

test('required kinds match the plan', () => {
  const byId = new Map(MANIFEST.map((entry) => [entry.id, entry]));
  assert.equal(byId.get('img-og-default').kind, 'card');
  for (const slug of LEGACY) assert.equal(byId.get(`img-lineage-${slug}`).kind, 'portrait');
  for (const slug of ['supercars', 'grand-tourer', 'ultimate', 'motorsport']) {
    assert.equal(byId.get(`img-cat-${slug}`).kind, 'hero');
  }
  for (const slug of CURRENT) {
    assert.equal(byId.get(`img-${slug}-hero`).kind, 'hero');
    assert.equal(byId.get(`img-${slug}-card`).kind, 'card');
  }
  assert.deepEqual(SIZES.hero, { width: 1920, height: 1080 });
  assert.deepEqual(SIZES.card, { width: 1200, height: 900 });
  assert.deepEqual(SIZES.portrait, { width: 900, height: 1200 });
  assert.deepEqual(SIZES.detail, { width: 1600, height: 1000 });
});

test('renderSvg produces a self-contained SVG under 20 KB for every entry', () => {
  for (const entry of MANIFEST) {
    const svg = renderSvg(entry);
    const { width, height } = SIZES[entry.kind];
    assert.ok(svg.startsWith('<svg'), `${entry.id}: does not start with <svg`);
    assert.ok(svg.trimEnd().endsWith('</svg>'), `${entry.id}: does not end with </svg>`);
    assert.ok(svg.includes(`width="${width}" height="${height}"`), `${entry.id}: wrong size`);
    assert.ok(svg.includes(entry.label.toUpperCase()), `${entry.id}: label missing`);
    assert.ok(svg.includes('PLACEHOLDER'), `${entry.id}: tag missing`);
    assert.ok(svg.includes('font-family="system-ui, sans-serif"'), `${entry.id}: font stack missing`);
    assert.ok(!/<(script|image|style)\b/.test(svg), `${entry.id}: contains script, image, or style`);
    assert.ok(!/https?:\/\/(?!www\.w3\.org\/2000\/svg)/.test(svg), `${entry.id}: external reference`);
    assert.ok(Buffer.byteLength(svg) < MAX_BYTES, `${entry.id}: ${Buffer.byteLength(svg)} bytes`);
  }
});

test('renderSvg escapes label text', () => {
  const svg = renderSvg({ id: 'img-x', label: 'A & B <C>', kind: 'card', palette: 'white', silhouette: 'none' });
  assert.ok(svg.includes('A &amp; B &lt;C&gt;'));
  assert.ok(!svg.includes('<C>'));
});

test('asset seeds mirror the manifest', () => {
  // without any photo on disk every slot keeps its SVG placeholder
  const seeds = buildAssetSeeds({ fileExists: () => false });
  assert.equal(seeds.length, MANIFEST.length);
  assert.equal(ASSET_SEEDS.length, MANIFEST.length);
  for (const [index, seed] of seeds.entries()) {
    const entry = MANIFEST[index];
    assert.equal(seed.id, entry.id);
    assert.equal(seed.title, entry.label);
    assert.equal(seed.file, `assets/placeholders/${entry.id}.svg`);
    assert.equal(seed.contentType, 'image/svg+xml');
    // short alt text: just the label, no boilerplate sentence
    assert.equal(seed.description, entry.label);
    assert.ok(seed.description.length < 60);
  }
  assert.equal(ASSET_GROUP.name, 'assets');
  assert.equal(ASSET_GROUP.assets, ASSET_SEEDS);
  assert.deepEqual(ASSET_GROUP.entries, []);
  assert.equal(assetId('750s', 'hero'), 'img-750s-hero');
  assert.equal(assetId('artura-spider', 'interior'), 'img-artura-spider-interior');
});
