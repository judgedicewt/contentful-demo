import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLocalProvider, createResolver } from '../site/js/audience.js';

const aud = (key, fields = {}) => ({ sys: { id: `aud-${key}` }, fields: { name: key, key, ...fields } });
const cat = (slug) => ({ sys: { id: `cat-${slug}` }, fields: { slug } });
const veh = (slug) => ({ sys: { id: `veh-${slug}` }, fields: { slug } });
const profile = (over = {}) => ({
  version: 1, visits: 1, firstSeen: null, lastSeen: null, viewed: { vehicles: [], categories: {} },
  campaign: null, region: null, overrides: { audiences: null, region: null }, ...over,
});
const keys = (audiences, p) => [...createLocalProvider(audiences).resolve(p)].sort();

test('each rule matches alone', () => {
  const cases = [
    [aud('a', { interestCategories: [cat('supercars')] }), profile({ viewed: { vehicles: [], categories: { supercars: 2 } } }), true],
    [aud('a', { interestCategories: [cat('supercars')] }), profile({ viewed: { vehicles: [], categories: { supercars: 0, gt: 1 } } }), false],
    [aud('a', { interestVehicles: [veh('750s')] }), profile({ viewed: { vehicles: ['750s'], categories: {} } }), true],
    [aud('a', { interestVehicles: [veh('750s')] }), profile({ viewed: { vehicles: ['artura'], categories: {} } }), false],
    [aud('a', { visitorType: 'first-time' }), profile({ visits: 1 }), true],
    [aud('a', { visitorType: 'first-time' }), profile({ visits: 0 }), true],
    [aud('a', { visitorType: 'first-time' }), profile({ visits: 2 }), false],
    [aud('a', { visitorType: 'returning' }), profile({ visits: 2 }), true],
    [aud('a', { visitorType: 'returning' }), profile({ visits: 1 }), false],
    [aud('a', { minVisits: 3 }), profile({ visits: 3 }), true],
    [aud('a', { minVisits: 3 }), profile({ visits: 2 }), false],
    [aud('a', { campaigns: ['TrackDay'] }), profile({ campaign: 'trackday' }), true],
    [aud('a', { campaigns: ['trackday'] }), profile({ campaign: null }), false],
    [aud('a', { regions: ['GB'] }), profile({ region: 'gb' }), true],
    [aud('a', { regions: ['GB'] }), profile({ region: 'FR', overrides: { audiences: null, region: 'GB' } }), true],
    [aud('a', { regions: ['GB'] }), profile({ region: 'GB', overrides: { audiences: null, region: 'FR' } }), false],
  ];
  for (const [audience, p, matches] of cases) assert.deepEqual(keys([audience], p), matches ? ['a'] : [], JSON.stringify(audience.fields));
});

test('matchMode all needs every populated rule and any needs one; unknown values use the defaults', () => {
  const rules = { visitorType: 'returning', campaigns: ['trackday'] };
  const returningOnly = profile({ visits: 2 });
  assert.deepEqual(keys([aud('a', { ...rules, matchMode: 'all' })], returningOnly), []);
  assert.deepEqual(keys([aud('a', { ...rules, matchMode: 'any' })], returningOnly), ['a']);
  assert.deepEqual(keys([aud('a', rules)], returningOnly), [], 'the default is all');
  assert.deepEqual(keys([aud('a', { ...rules, matchMode: 'sometimes' })], returningOnly), [], 'unknown matchMode is all');
  assert.deepEqual(keys([aud('a', { visitorType: 'weekly' })], profile({ visits: 5 })), [], 'unknown visitorType is any, so no rule is populated');
});

test('an audience with no populated rules, or an external source, never matches locally', () => {
  const busy = profile({ visits: 9, campaign: 'trackday', region: 'GB' });
  assert.deepEqual(keys([aud('none'), aud('empty', { interestCategories: [], visitorType: 'any', campaigns: [] })], busy), []);
  assert.deepEqual(keys([aud('vip', { source: 'external', visitorType: 'returning' })], busy), []);
});

test('unresolved rule links are ignored', () => {
  const seen = profile({ viewed: { vehicles: [], categories: { supercars: 1 } } });
  assert.deepEqual(keys([aud('a', { interestCategories: [null] })], seen), [], 'a rule of only unresolved links is empty');
  assert.deepEqual(keys([aud('a', { interestCategories: [null, cat('supercars')] })], seen), ['a']);
});

test('the local provider tolerates a profile with missing or wrong-shaped fields', () => {
  const audiences = [null, {}, aud('a', { visitorType: 'returning' }), aud('b', { interestCategories: [cat('supercars')] })];
  for (const bad of [{}, { visits: 'x', viewed: null }, { viewed: { vehicles: 'no', categories: [] }, campaign: 7 }]) {
    assert.doesNotThrow(() => createLocalProvider(audiences).resolve(bad));
    assert.deepEqual([...createLocalProvider(audiences).resolve(bad)], []);
  }
  assert.deepEqual([...createLocalProvider(undefined).resolve(profile())], []);
});

test('the resolver unions providers and an override replaces the computed set', () => {
  const fixed = (...found) => ({ resolve: () => new Set(found) });
  const resolver = createResolver({ providers: [fixed('uk'), fixed('uk', 'vip')] });
  assert.deepEqual([...resolver.audiencesFor(profile())].sort(), ['uk', 'vip']);
  const forced = (audiences) => profile({ overrides: { audiences, region: null } });
  assert.deepEqual([...resolver.audiencesFor(forced(['returning']))], ['returning'], 'replaced, not added to');
  assert.deepEqual([...resolver.audiencesFor(forced([]))], [], 'an empty array forces the defaults');
  assert.deepEqual([...resolver.audiencesFor(forced(null))].sort(), ['uk', 'vip']);
  assert.deepEqual([...createResolver().audiencesFor(profile())], []);
});

test('a provider that throws is skipped with one warning', () => {
  const warnings = [];
  const resolver = createResolver({
    providers: [{ resolve: () => { throw new Error('cdp down'); } }, { resolve: () => new Set(['uk']) }],
    warn: (message) => warnings.push(message),
  });
  assert.deepEqual([...resolver.audiencesFor(profile())], ['uk']);
  assert.equal(warnings.length, 1);
});
