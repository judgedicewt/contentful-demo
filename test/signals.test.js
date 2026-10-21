import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSignals, campaignFromLocation, readQueryParam, regionFromLanguage, effectiveRegion, viewFrom } from '../site/js/signals.js';

const store = (seed = {}) => {
  const map = new Map(Object.entries(seed));
  return { map, getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => void map.set(k, String(v)), removeItem: (k) => void map.delete(k) };
};
const blocked = () => { throw new Error('blocked'); };
const brokenStore = { getItem: blocked, setItem: blocked, removeItem: blocked };
const T0 = '2026-10-21T10:00:00.000Z';
const FRESH = {
  version: 1, visits: 0, firstSeen: null, lastSeen: null, viewed: { vehicles: [], categories: {} },
  campaign: null, region: null, overrides: { audiences: null, region: null },
};
const setup = ({ local = store(), session = store(), clock = { iso: T0 } } = {}) => ({
  signals: createSignals({ local: () => local, session: () => session, now: () => new Date(clock.iso) }),
  local, session, clock,
});
const here = (search = '', hash = '#/') => ({ search, hash });
const stored = (local) => JSON.parse(local.map.get('mcl.profile'));

test('a first boot writes the version 1 profile under mcl.profile', () => {
  const { signals, local } = setup();
  signals.recordBoot(here(), { language: 'en-GB' });
  assert.deepEqual(stored(local), {
    version: 1, visits: 1, firstSeen: T0, lastSeen: T0, viewed: { vehicles: [], categories: {} },
    campaign: null, region: 'GB', overrides: { audiences: null, region: null },
  });
});

test('visits count sessions, not boots', () => {
  const { signals, local, session, clock } = setup();
  signals.recordBoot(here(), { language: 'en-GB' });
  signals.recordBoot(here(), { language: 'en-GB' });
  assert.equal(stored(local).visits, 1);
  assert.equal(session.map.has('mcl.session'), true);
  clock.iso = '2026-10-21T10:05:00.000Z';
  const next = setup({ local, session: store(), clock }).signals.recordBoot(here(), { language: 'en-GB' });
  assert.equal(next.visits, 2);
  assert.equal(next.firstSeen, T0);
  assert.equal(next.lastSeen, '2026-10-21T10:05:00.000Z');
});

test('recordView keeps vehicles most recent first without duplicates and counts categories', () => {
  const { signals } = setup();
  signals.recordView({ vehicleSlug: '750s', categorySlug: 'supercars' });
  signals.recordView({ vehicleSlug: '750s-spider', categorySlug: 'supercars' });
  signals.recordView({ categorySlug: 'gt' });
  signals.recordView({ vehicleSlug: 'w1' });
  let viewed = signals.load().viewed;
  assert.deepEqual(viewed.vehicles, ['w1', '750s-spider', '750s']);
  assert.deepEqual(viewed.categories, { supercars: 2, gt: 1 }, 'a view without a category adds no key');
  signals.recordView({ vehicleSlug: '750s' });
  viewed = signals.load().viewed;
  assert.deepEqual(viewed.vehicles, ['750s', 'w1', '750s-spider'], 'a revisit moves to the front');
});

test('viewed vehicles are capped at 20 entries', () => {
  const { signals } = setup();
  for (let i = 0; i < 25; i += 1) signals.recordView({ vehicleSlug: `v${i}` });
  const { vehicles } = signals.load().viewed;
  assert.equal(vehicles.length, 20);
  assert.equal(vehicles[0], 'v24');
  assert.equal(vehicles[19], 'v5');
});

test('campaignFromLocation prefers utm_campaign, then the real query string, and normalises', () => {
  const cases = [
    [here('?utm_campaign=trackday', '#/750s'), 'trackday'],
    [here('', '#/750s?audience=trackday'), 'trackday'],
    [here('?audience=a', '#/x?utm_campaign=b'), 'b'],
    [here('?utm_campaign=a', '#/x?utm_campaign=b'), 'a'],
    [here('?utm_campaign=&audience=%20TrackDay%20', '#/'), 'trackday'],
    [here('?utm_campaign=%20%20', '#/'), null],
    [here('', '#/'), null],
  ];
  for (const [location, expected] of cases) assert.equal(campaignFromLocation(location), expected, JSON.stringify(location));
});

test('readQueryParam reads the real query first, then the hash query, trimmed or null', () => {
  assert.equal(readQueryParam(here('?x=%20a%20'), 'x'), 'a');
  assert.equal(readQueryParam(here('?x=  ', '#/p?x=b'), 'x'), 'b');
  assert.equal(readQueryParam(here('', '#/p?x=&y=1'), 'x'), null);
  assert.equal(readQueryParam(here('', '#/p'), 'x'), null);
});

test('a later boot without a campaign keeps the stored one', () => {
  const { signals, local } = setup();
  signals.recordBoot(here('?utm_campaign=TrackDay'), { language: 'en-GB' });
  signals.recordBoot(here(), { language: 'en-GB' });
  assert.equal(stored(local).campaign, 'trackday');
});

test('regionFromLanguage reads the region subtag only', () => {
  const cases = [['en-GB', 'GB'], ['en-gb', 'GB'], ['zh-Hans-CN', 'CN'], ['en_GB', 'GB'],
    ['en', null], ['es-419', null], ['en-u-ca-gregory', null], ['', null], [undefined, null]];
  for (const [tag, expected] of cases) assert.equal(regionFromLanguage(tag), expected, String(tag));
});

test('boot derives the region once and the override wins', () => {
  const { signals } = setup();
  signals.recordBoot(here(), { language: 'en-GB' });
  assert.equal(signals.recordBoot(here(), { language: 'fr-FR' }).region, 'GB', 'derived only while unset');
  assert.equal(effectiveRegion(signals.load()), 'GB');
  assert.equal(effectiveRegion(signals.setOverrides({ region: 'fr' })), 'FR');
});

test('setOverrides normalises, leaves absent keys alone and clears on null', () => {
  const { signals, local } = setup();
  signals.setOverrides({ audiences: ['returning', 'returning', 'uk'], region: ' gb ' });
  assert.deepEqual(stored(local).overrides, { audiences: ['returning', 'uk'], region: 'GB' });
  assert.deepEqual(signals.setOverrides({ region: 'GBR' }).overrides, { audiences: ['returning', 'uk'], region: null });
  assert.deepEqual(signals.setOverrides({ audiences: null }).overrides, { audiences: null, region: null });
});

test('setEnabled(false) stops writes but keeps reads, and true resumes writes', () => {
  const seeded = { ...FRESH, visits: 3, firstSeen: T0, lastSeen: T0 };
  const { signals, local, session } = setup({ local: store({ 'mcl.profile': JSON.stringify(seeded) }) });
  const before = local.map.get('mcl.profile');
  signals.setEnabled(false);
  assert.deepEqual(signals.recordBoot(here('?utm_campaign=x'), { language: 'fr-FR' }), seeded);
  signals.recordView({ vehicleSlug: '750s' });
  signals.setOverrides({ region: 'FR' });
  assert.equal(local.map.get('mcl.profile'), before, 'no profile write while disabled');
  assert.equal(session.map.size, 0, 'no session marker while disabled');
  assert.deepEqual(signals.load(), seeded, 'reads still work while disabled');
  signals.setEnabled(true);
  signals.recordBoot(here(), { language: 'en-GB' });
  assert.equal(stored(local).visits, 4);
});

test('reset removes the profile and the session marker', () => {
  const { signals, local, session } = setup();
  signals.recordBoot(here(), { language: 'en-GB' });
  signals.reset();
  assert.equal(local.map.has('mcl.profile'), false);
  assert.equal(session.map.has('mcl.session'), false);
  assert.deepEqual(signals.load(), FRESH);
});

test('blocked storage keeps an in-memory first-time profile for the page lifetime', () => {
  const now = () => new Date(T0);
  for (const stores of [{ local: () => brokenStore, session: () => brokenStore }, { local: blocked, session: blocked }]) {
    const signals = createSignals({ ...stores, now });
    assert.doesNotThrow(() => signals.recordBoot(here(), { language: 'en-GB' }));
    signals.recordView({ vehicleSlug: '750s', categorySlug: 'supercars' });
    const profile = signals.load();
    assert.equal(profile.visits, 1);
    assert.deepEqual(profile.viewed.vehicles, ['750s']);
    assert.doesNotThrow(() => signals.reset());
  }
});

test('an older version or malformed JSON is discarded and started fresh', () => {
  for (const raw of ['{"version":0,"visits":9}', '{not json', 'null', '[]']) {
    const { signals, local } = setup({ local: store({ 'mcl.profile': raw }) });
    assert.deepEqual(signals.load(), FRESH, raw);
    assert.equal(signals.recordBoot(here(), { language: 'en-GB' }).visits, 1);
    assert.equal(stored(local).version, 1);
  }
});

test('load normalises a version 1 profile with wrong-shaped fields', () => {
  const bad = { version: 1, visits: '3', firstSeen: 5, lastSeen: {}, viewed: null, campaign: 7, region: 'gbr', overrides: 'x' };
  assert.deepEqual(setup({ local: store({ 'mcl.profile': JSON.stringify(bad) }) }).signals.load(), FRESH);
  const partial = { ...FRESH, visits: 2, viewed: { vehicles: ['750s', 3, null], categories: { supercars: 2, gt: 'x', bad: -1 } } };
  const { viewed, visits } = setup({ local: store({ 'mcl.profile': JSON.stringify(partial) }) }).signals.load();
  assert.equal(visits, 2);
  assert.deepEqual(viewed, { vehicles: ['750s'], categories: { supercars: 2 } });
});

test('viewFrom maps vehicle and category views and ignores every other route', () => {
  const vehicle = { entry: { fields: { slug: '750s', category: { fields: { slug: 'supercars' } } } } };
  assert.deepEqual(viewFrom('vehicle', vehicle), { vehicleSlug: '750s', categorySlug: 'supercars' });
  assert.deepEqual(viewFrom('vehicle', { entry: { fields: { slug: 'x', category: null } } }), { vehicleSlug: 'x' });
  assert.deepEqual(viewFrom('vehicleCategory', { entry: { fields: { slug: 'gt' } } }), { categorySlug: 'gt' });
  for (const view of ['home', 'page', 'story', 'retailers', 'enquire', 'placeholder', 'notFound']) {
    assert.equal(viewFrom(view, vehicle), null, view);
  }
  assert.equal(viewFrom('vehicle', null), null);
});
