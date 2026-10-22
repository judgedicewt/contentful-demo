import test from 'node:test';
import assert from 'node:assert/strict';
import { PHOTO_SHOTS, SHOT_BY_ID, BASE_PROMPT } from '../src/photos/manifest.js';
import { photoForAsset } from '../src/photos/slots.js';
import { MANIFEST } from '../src/placeholders/manifest.js';
import { buildAssetSeeds, ASSET_SEEDS, ASSET_GROUP, assetId } from '../src/seed/assets.js';
import { planPhotos, convertPhoto, parseArgs, unknownForceIds, processShots } from '../scripts/generate-photos.js';

test('PHOTO_SHOTS has 35 shots with unique ids and files under assets/photos/', () => {
  assert.equal(PHOTO_SHOTS.length, 35);
  assert.equal(new Set(PHOTO_SHOTS.map((s) => s.id)).size, 35);
  assert.equal(new Set(PHOTO_SHOTS.map((s) => s.file)).size, 35);
  assert.equal(SHOT_BY_ID.size, 35);
  for (const shot of PHOTO_SHOTS) {
    assert.equal(shot.file, `assets/photos/${shot.id}.webp`);
    assert.ok(shot.file.startsWith('assets/photos/'));
    assert.ok(['16:9', '4:3'].includes(shot.aspect));
    assert.equal(shot.aspect === '16:9' ? shot.width * 9 : shot.width * 3, shot.height * (shot.aspect === '16:9' ? 16 : 4));
  }
  for (const id of [
    'shot-story-750s-facts-hero',
    'shot-story-artura-spider-hero',
    'shot-story-w1-hero',
    'shot-story-mso-hero',
    'shot-home-hero',
    'shot-legacy-hero',
    'shot-experiences-hero',
    'shot-mso-hero',
  ]) {
    assert.ok(SHOT_BY_ID.has(id), `missing ${id}`);
  }
});

test('every shot prompt contains BASE_PROMPT and none mention "McLaren"', () => {
  for (const shot of PHOTO_SHOTS) {
    assert.ok(shot.prompt.includes(BASE_PROMPT), `${shot.id} lacks BASE_PROMPT`);
    assert.ok(!/mclaren/i.test(shot.prompt), `${shot.id} mentions McLaren`);
    const withoutNegation = shot.prompt.replace(/no badges/gi, '');
    assert.ok(!/badge/i.test(withoutNegation), `${shot.id} mentions badge without "no badges"`);
  }
});

test('photoForAsset maps every manifest asset id', () => {
  for (const { id } of MANIFEST) {
    const shot = photoForAsset(id);
    assert.ok(shot === null || SHOT_BY_ID.get(shot.id) === shot, `${id} -> ${shot && shot.id}`);
  }
  const expected = {
    'img-750s-hero': 'shot-750s-hero',
    'img-750s-overview-2': 'shot-750s-card',
    'img-750s-exterior': 'shot-750s-hero',
    'img-750s-card': 'shot-750s-card',
    'img-lineage-f1': 'shot-f1-hero',
    'img-story-w1-hero': 'shot-story-w1-hero',
    'img-story-w1-inline': 'shot-story-w1-hero',
    'img-home-hero': 'shot-home-hero',
    'img-cat-supercars': 'shot-750s-hero',
    'img-og-default': null,
  };
  for (const [id, shotId] of Object.entries(expected)) {
    const shot = photoForAsset(id);
    assert.equal(shot ? shot.id : null, shotId, id);
  }
  // Longest slug wins, and unknown ids are null.
  assert.equal(photoForAsset('img-artura-spider-hero').id, 'shot-artura-spider-hero');
  assert.equal(photoForAsset('img-750s-spider-interior').id, 'shot-750s-spider-card');
  assert.equal(photoForAsset('img-nope-hero'), null);
  // Only og-default is unmapped in the manifest.
  const unmapped = MANIFEST.filter(({ id }) => photoForAsset(id) === null).map(({ id }) => id);
  assert.deepEqual(unmapped, ['img-og-default']);
});

test('legacy vehicles are flagged', () => {
  assert.equal(SHOT_BY_ID.get('shot-f1-hero').legacy, true);
  assert.equal(SHOT_BY_ID.get('shot-f1-card').legacy, true);
  assert.notEqual(SHOT_BY_ID.get('shot-750s-hero').legacy, true);
  assert.notEqual(SHOT_BY_ID.get('shot-artura-gt4-hero').legacy, true);
});

test('buildAssetSeeds uses a webp when the shot file exists', () => {
  const seeds = buildAssetSeeds({ fileExists: (p) => p.endsWith('shot-750s-hero.webp') });
  const byId = new Map(seeds.map((seed) => [seed.id, seed]));
  assert.equal(seeds.length, MANIFEST.length);
  const hero = byId.get('img-750s-hero');
  assert.equal(hero.file, 'assets/photos/shot-750s-hero.webp');
  assert.equal(hero.contentType, 'image/webp');
  // Slots sharing the shot switch too; title and description are unchanged.
  assert.equal(byId.get('img-750s-exterior').file, 'assets/photos/shot-750s-hero.webp');
  assert.equal(hero.title, MANIFEST.find((e) => e.id === 'img-750s-hero').label);
  const artura = byId.get('img-artura-hero');
  assert.equal(artura.file, 'assets/placeholders/img-artura-hero.svg');
  assert.equal(artura.contentType, 'image/svg+xml');
  const og = byId.get('img-og-default');
  assert.equal(og.file, 'assets/placeholders/img-og-default.svg');
  assert.equal(og.contentType, 'image/svg+xml');
});

test('buildAssetSeeds falls back to SVG for every slot when no photo exists', () => {
  const seeds = buildAssetSeeds({ fileExists: () => false });
  for (const seed of seeds) {
    assert.equal(seed.file, `assets/placeholders/${seed.id}.svg`);
    assert.equal(seed.contentType, 'image/svg+xml');
  }
});

test('asset seed exports keep working', () => {
  assert.equal(ASSET_SEEDS.length, MANIFEST.length);
  assert.equal(ASSET_GROUP.assets, ASSET_SEEDS);
  assert.equal(assetId('750s', 'hero'), 'img-750s-hero');
});

test('planPhotos skips existing files unless forced', () => {
  const fileExists = (p) => p.endsWith('shot-750s-hero.webp');
  const plan = planPhotos({ shots: PHOTO_SHOTS, fileExists, force: [] });
  assert.equal(plan.length, 35);
  for (const { shot, status } of plan) {
    assert.equal(status, shot.id === 'shot-750s-hero' ? 'kept' : 'missing', shot.id);
  }
  const forced = planPhotos({ shots: PHOTO_SHOTS, fileExists, force: ['shot-750s-hero'] });
  assert.equal(forced.find(({ shot }) => shot.id === 'shot-750s-hero').status, 'missing');
});

function runConvert({ shotId, inputWidth, inputHeight, sizes }) {
  const calls = [];
  const queue = [...sizes];
  const output = '/out/x.webp';
  convertPhoto({
    shot: SHOT_BY_ID.get(shotId),
    input: '/in/x.png',
    output,
    inputWidth,
    inputHeight,
    convert: (args) => calls.push(args),
    statSize: () => queue.shift(),
  });
  return calls;
}

test('convertPhoto builds the ImageMagick command and never upscales', () => {
  const [call] = runConvert({ shotId: 'shot-750s-hero', inputWidth: 1920, inputHeight: 1080, sizes: [100000] });
  assert.deepEqual(call, [
    '/in/x.png', '-resize', '1920x1080^', '-gravity', 'center', '-extent', '1920x1080',
    '-auto-orient', '-strip', '-quality', '82', '/out/x.webp',
  ]);

  // 1376x768 input for a 1920x1080 shot: width is capped at 1376, which would need 774 rows,
  // more than the 768 available, so the height wins and the width is recomputed (1365).
  const [wide] = runConvert({ shotId: 'shot-750s-hero', inputWidth: 1376, inputHeight: 768, sizes: [100000] });
  assert.ok(wide.includes('1365x768^'));
  assert.equal(wide[wide.indexOf('-extent') + 1], '1365x768');
  assert.equal(wide[wide.indexOf('-quality') + 1], '82');
  assert.equal(wide[wide.length - 1], '/out/x.webp');

  // Input taller than the aspect ratio needs: width caps, height follows (1376x900 input).
  const [tall] = runConvert({ shotId: 'shot-750s-hero', inputWidth: 1376, inputHeight: 900, sizes: [100000] });
  assert.equal(tall[tall.indexOf('-extent') + 1], '1376x774');

  // 1200x896 input for a 1200x900 shot: height is capped, width follows.
  const [card] = runConvert({ shotId: 'shot-750s-card', inputWidth: 1200, inputHeight: 896, sizes: [100000] });
  assert.ok(card.includes('1195x896^'));
  assert.equal(card[card.indexOf('-extent') + 1], '1195x896');
});

test('convertPhoto re-runs at quality 75 when the output is over 600000 bytes', () => {
  const calls = runConvert({ shotId: 'shot-750s-hero', inputWidth: 1920, inputHeight: 1080, sizes: [600001, 400000] });
  assert.equal(calls.length, 2);
  assert.equal(calls[0][calls[0].indexOf('-quality') + 1], '82');
  assert.equal(calls[1][calls[1].indexOf('-quality') + 1], '75');
  const exact = runConvert({ shotId: 'shot-750s-hero', inputWidth: 1920, inputHeight: 1080, sizes: [600000] });
  assert.equal(exact.length, 1);
});

test('convertPhoto applies EXIF orientation before stripping metadata', () => {
  const [call] = runConvert({ shotId: 'shot-750s-hero', inputWidth: 1920, inputHeight: 1080, sizes: [1] });
  assert.equal(call.indexOf('-auto-orient') + 1, call.indexOf('-strip'));
});

test('parseArgs accepts = and space forms for --input and --force', () => {
  assert.deepEqual(parseArgs(['--input=/in', '--force=a,b', '--prompts']), { input: '/in', force: ['a', 'b'], prompts: true });
  assert.deepEqual(parseArgs(['--input', '/in dir', '--force', 'a,b']), { input: '/in dir', force: ['a', 'b'], prompts: false });
  assert.equal(parseArgs(['--input=/a=b']).input, '/a=b');
  assert.throws(() => parseArgs(['--input']), /--input needs a value/);
  assert.throws(() => parseArgs(['--force', '--prompts']), /--force needs a value/);
  assert.throws(() => parseArgs(['--nope']), /Unknown argument/);
});

test('unknownForceIds reports ids missing from the manifest', () => {
  assert.deepEqual(unknownForceIds({ shots: PHOTO_SHOTS, force: ['shot-750s-hero', 'shot-nope'] }), ['shot-nope']);
  assert.deepEqual(unknownForceIds({ shots: PHOTO_SHOTS }), []);
});

function shotsFixture({ existing = [], inputs = {}, identifyFails = [], force = [] }) {
  const shots = ['shot-750s-hero', 'shot-750s-card', 'shot-w1-hero'].map((id) => SHOT_BY_ID.get(id));
  const exists = new Set(existing.map((id) => SHOT_BY_ID.get(id).file));
  const converted = [];
  const result = processShots({
    plan: planPhotos({ shots, fileExists: (file) => exists.has(file), force }),
    findInput: (id) => inputs[id] || null,
    identify: (input) => {
      if (identifyFails.some((id) => input.includes(id))) throw new Error('identify: no decode delegate');
      return { width: 1920, height: 1080 };
    },
    convert: (args) => converted.push(args[args.length - 1]),
    statSize: () => 2048,
    fileExists: (file) => exists.has(file),
    formatSize: (bytes) => `${bytes / 1024} KB`,
  });
  return { ...result, converted };
}

test('processShots reports an identify failure as error and continues', () => {
  const { rows, converted, stillMissing } = shotsFixture({
    inputs: { 'shot-750s-hero': '/in/shot-750s-hero.png', 'shot-w1-hero': '/in/shot-w1-hero.png' },
    identifyFails: ['shot-750s-hero'],
  });
  const byId = Object.fromEntries(rows.map(([id, status, detail]) => [id, { status, detail }]));
  assert.equal(byId['shot-750s-hero'].status, 'error');
  assert.match(byId['shot-750s-hero'].detail, /no decode delegate/);
  assert.equal(byId['shot-750s-card'].status, 'missing');
  assert.equal(byId['shot-w1-hero'].status, 'new', 'later shots still convert');
  assert.equal(converted.length, 1);
  assert.deepEqual(stillMissing.map((shot) => shot.id), ['shot-750s-hero', 'shot-750s-card']);
});

test('processShots counts a forced shot with no input as kept, not missing', () => {
  const { rows, converted } = shotsFixture({ existing: ['shot-750s-hero'], force: ['shot-750s-hero'] });
  const forced = rows.find(([id]) => id === 'shot-750s-hero');
  assert.equal(forced[1], 'kept');
  assert.match(forced[2], /forced, no input found/);
  assert.equal(converted.length, 0);
  assert.equal(rows.find(([id]) => id === 'shot-750s-card')[1], 'missing', 'unforced absent shots stay missing');
});
