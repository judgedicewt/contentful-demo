import test from 'node:test';
import assert from 'node:assert/strict';
import { PHOTO_SHOTS, SHOT_BY_ID, BASE_PROMPT } from '../src/photos/manifest.js';
import { photoForAsset } from '../src/photos/slots.js';
import { MANIFEST } from '../src/placeholders/manifest.js';

test('PHOTO_SHOTS has 30 shots with unique ids and files under assets/photos/', () => {
  assert.equal(PHOTO_SHOTS.length, 30);
  assert.equal(new Set(PHOTO_SHOTS.map((s) => s.id)).size, 30);
  assert.equal(new Set(PHOTO_SHOTS.map((s) => s.file)).size, 30);
  assert.equal(SHOT_BY_ID.size, 30);
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
    'img-750s-overview-2': 'shot-750s-hero',
    'img-750s-exterior': 'shot-750s-hero',
    'img-750s-card': 'shot-750s-card',
    'img-lineage-f1': 'shot-f1-card',
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
  assert.equal(photoForAsset('img-750s-spider-interior').id, 'shot-750s-spider-hero');
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
