import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CONTENT_TYPES, DEFAULT_LOCALE, LOCALES } from '../src/content-model.js';
import { assetFields, provisionAssets, sameAssetMetadata } from '../src/provision/assets.js';
import { normaliseContentType, sameContentType } from '../src/provision/content-types.js';
import { sameFields } from '../src/provision/entries.js';
import { isNetworkError, isNotFound, isRateLimited, isRetryable, isServerError, rateLimitResetSeconds } from '../src/provision/errors.js';
import { buildEntryFields, needsTranslation } from '../src/provision/fields.js';
import { ensureLocales } from '../src/provision/locales.js';
import { createRequester, isPublished } from '../src/provision/requests.js';
import { selectGroups, translationCoverage, validateContentModel, validateSeeds } from '../src/provision/validate.js';
import { SEED_GROUPS, TRANSLATIONS } from '../src/seed/index.js';

const richText = {
  nodeType: 'document',
  data: {},
  content: [{ nodeType: 'paragraph', data: {}, content: [{ nodeType: 'text', value: 'Hello', marks: [], data: {} }] }],
};

function sdkError(status, extra = {}) {
  const error = new Error(JSON.stringify({ status, statusText: 'x', message: 'm', details: {}, ...extra }));
  error.name = status === 404 ? 'NotFound' : status === 429 ? 'RateLimitExceeded' : 'Error';
  return error;
}

// Minimal seed groups that satisfy every required field they touch.
function validGroups() {
  return [
    {
      name: 'media',
      assets: [
        { id: 'img-750s-hero', title: '750S hero', description: 'Placeholder', file: 'assets/placeholders/img-750s-hero.svg', contentType: 'image/svg+xml' },
      ],
      entries: [],
    },
    {
      name: 'vehicles',
      assets: [],
      entries: [
        { id: 'cat-supercars', contentType: 'vehicleCategory', fields: { name: 'Supercars', slug: 'supercars', order: 1 } },
        {
          id: 'story-750s-five-key-facts',
          contentType: 'story',
          fields: { title: 'Five facts', slug: '750s-five-key-facts', publishDate: '2026-01-01T00:00:00Z' },
          assets: { heroImage: 'img-750s-hero' },
          links: { relatedVehicles: ['vehicle-750s'] },
        },
        {
          id: 'vehicle-750s',
          contentType: 'vehicle',
          fields: { name: '750S', slug: '750s', status: 'current', bodyStyle: 'coupe', order: 1 },
          links: { category: 'cat-supercars', relatedStories: ['story-750s-five-key-facts'] },
          assets: { heroImage: 'img-750s-hero', downloads: ['img-750s-hero'] },
        },
        {
          id: 'faq-750s-1',
          contentType: 'faqItem',
          fields: { question: 'Is it fast?', answer: richText },
        },
        {
          id: 'retailer-london',
          contentType: 'retailer',
          fields: { name: 'Strada Nova London', city: 'London', country: 'United Kingdom', location: { lat: 51.5, lon: -0.12 }, website: 'https://example.com' },
        },
      ],
    },
  ];
}

test('buildEntryFields localises plain values to en-US', () => {
  const fields = buildEntryFields({ id: 'x', contentType: 'specification', fields: { label: 'Top speed', order: 2, featured: true, skipped: undefined } });
  assert.deepEqual(fields, {
    label: { 'en-US': 'Top speed' },
    order: { 'en-US': 2 },
    featured: { 'en-US': true },
  });
});

test('buildEntryFields passes rich text and Location objects through under the locale', () => {
  const fields = buildEntryFields({ id: 'x', contentType: 'faqItem', fields: { answer: richText, location: { lat: 1, lon: 2 } } });
  assert.equal(fields.answer['en-US'], richText);
  assert.deepEqual(fields.location, { 'en-US': { lat: 1, lon: 2 } });
});

test('buildEntryFields maps links and assets to Link objects', () => {
  const fields = buildEntryFields({
    id: 'x',
    contentType: 'vehicle',
    fields: {},
    links: { category: 'cat-supercars', relatedStories: ['story-a', 'story-b'] },
    assets: { heroImage: 'img-hero', downloads: ['img-a'] },
  });
  assert.deepEqual(fields.category, { 'en-US': { sys: { type: 'Link', linkType: 'Entry', id: 'cat-supercars' } } });
  assert.deepEqual(fields.relatedStories['en-US'], [
    { sys: { type: 'Link', linkType: 'Entry', id: 'story-a' } },
    { sys: { type: 'Link', linkType: 'Entry', id: 'story-b' } },
  ]);
  assert.deepEqual(fields.heroImage, { 'en-US': { sys: { type: 'Link', linkType: 'Asset', id: 'img-hero' } } });
  assert.deepEqual(fields.downloads['en-US'], [{ sys: { type: 'Link', linkType: 'Asset', id: 'img-a' } }]);
});

test('the content model passes its own validation', () => {
  assert.deepEqual(validateContentModel(CONTENT_TYPES), []);
});

test('LOCALES declares ja-JP falling back to en-US', () => {
  assert.equal(DEFAULT_LOCALE, 'en-US');
  assert.deepEqual(LOCALES, [
    { code: 'ja-JP', name: 'Japanese (Japan)', fallbackCode: 'en-US', optional: true, contentDeliveryApi: true, contentManagementApi: true },
  ]);
});

test('exactly the human-readable text fields are localized', () => {
  const EXPECTED = {
    seoMetadata: ['title', 'description'],
    link: ['label'],
    linkGroup: ['heading'],
    bannerButton: ['eyebrow', 'heading', 'body'],
    vehicleCategory: ['name', 'intro'],
    specification: ['label', 'value', 'unit'],
    featureHighlight: ['title', 'body', 'tag'],
    mediaSlide: ['heading', 'body'],
    lineageEntry: ['title', 'body'],
    faqItem: ['question', 'answer'],
    textBlock: ['heading', 'body'],
    imageBlock: ['caption'],
    card: ['title', 'body'],
    cardGrid: ['heading'],
    ctaGroup: ['heading'],
    story: ['title', 'kicker', 'standfirst'],
    vehicle: ['name', 'shortDescription', 'tagline', 'statement', 'performanceHeading', 'performanceBody', 'lineageIntro'],
    vehicleGrid: ['heading'],
    storyGrid: ['heading'],
    page: ['title', 'kicker'],
    retailer: ['name', 'city', 'country', 'address'],
    enquiryForm: ['title', 'intro', 'submitLabel', 'consentText', 'successTitle', 'successBody', 'errorBody'],
    siteSettings: ['siteName', 'newsletterText'],
  };
  const actual = Object.fromEntries(
    CONTENT_TYPES.map((type) => [type.id, type.fields.filter((f) => f.localized).map((f) => f.id)]).filter(([, ids]) => ids.length),
  );
  assert.deepEqual(actual, EXPECTED);
  for (const type of CONTENT_TYPES) for (const field of type.fields) {
    if (!field.localized) continue;
    assert.ok(['Symbol', 'Text', 'RichText'].includes(field.type), `${type.id}.${field.id} is ${field.type}`);
    assert.ok(!(field.validations || []).some((v) => v.in), `${type.id}.${field.id} is an enum`);
  }
});

test('the content model covers every type in the design', () => {
  const ids = CONTENT_TYPES.map((type) => type.id);
  const expected = [
    'siteSettings', 'link', 'linkGroup', 'seoMetadata', 'vehicleCategory', 'vehicle', 'specification',
    'featureHighlight', 'mediaSlide', 'lineageEntry', 'faqItem', 'page', 'story', 'textBlock', 'imageBlock',
    'bannerButton', 'card', 'cardGrid', 'vehicleGrid', 'storyGrid', 'ctaGroup', 'retailer', 'enquiryForm',
    'audience', 'contentVariant', 'personalizedContent',
  ];
  for (const id of expected) assert.ok(ids.includes(id), `missing content type ${id}`);
  assert.equal(ids.length, expected.length);
  const retailer = CONTENT_TYPES.find((type) => type.id === 'retailer');
  assert.equal(retailer.fields.find((field) => field.id === 'location').type, 'Location');
  const vehicle = CONTENT_TYPES.find((type) => type.id === 'vehicle');
  assert.deepEqual(vehicle.fields.find((field) => field.id === 'heroImage').validations, [{ linkMimetypeGroup: ['image'] }]);
});

test('enquiryForm endpoint is https-only and the seed entry satisfies it', () => {
  const type = CONTENT_TYPES.find((t) => t.id === 'enquiryForm');
  const endpoint = type.fields.find((f) => f.id === 'endpoint');
  assert.equal(endpoint.required, true);
  const pattern = new RegExp(endpoint.validations[0].regexp.pattern);
  assert.ok(!pattern.test('http://example.com/hook'));
  const group = SEED_GROUPS.find((g) => g.name === 'enquiry');
  const entry = group.entries.find((e) => e.id === 'enquiry-form');
  assert.equal(entry.contentType, 'enquiryForm');
  assert.ok(pattern.test(entry.fields.endpoint));
  assert.equal(entry.fields.title, 'Enquire');
});

test('validateSeeds accepts a consistent set of groups, including cross-group and cyclic links', () => {
  assert.deepEqual(validateSeeds(validGroups(), CONTENT_TYPES), []);
  assert.deepEqual(validateSeeds([], CONTENT_TYPES), []);
});

test('validateSeeds reports an unknown field', () => {
  const groups = validGroups();
  groups[1].entries[0].fields.colour = 'papaya';
  const problems = validateSeeds(groups, CONTENT_TYPES);
  assert.equal(problems.length, 1);
  assert.equal(problems[0].kind, 'unknown-field');
  assert.equal(problems[0].field, 'colour');
  assert.equal(problems[0].id, 'cat-supercars');
});

test('validateSeeds reports a missing required field', () => {
  const groups = validGroups();
  delete groups[1].entries[2].links.category;
  const problems = validateSeeds(groups, CONTENT_TYPES);
  assert.deepEqual(problems.map((problem) => [problem.kind, problem.id, problem.field]), [['missing-required', 'vehicle-750s', 'category']]);
});

test('validateSeeds reports links to IDs not declared in any group', () => {
  const groups = validGroups();
  groups[1].entries[2].links.relatedStories.push('story-missing');
  groups[1].entries[2].assets.cardImage = 'img-missing';
  const problems = validateSeeds(groups, CONTENT_TYPES);
  assert.deepEqual(
    problems.map((problem) => [problem.kind, problem.field]).sort(),
    [['dangling-link', 'cardImage'], ['dangling-link', 'relatedStories']],
  );
});

test('validateSeeds reports in-list violations, wrong link targets and unknown types', () => {
  const groups = validGroups();
  groups[1].entries[2].fields.status = 'retired';
  groups[1].entries[2].links.category = 'story-750s-five-key-facts';
  groups[1].entries.push({ id: 'oops', contentType: 'blogPost', fields: {} });
  const kinds = validateSeeds(groups, CONTENT_TYPES).map((problem) => problem.kind).sort();
  assert.deepEqual(kinds, ['link-type', 'unknown-type', 'validation']);
});

test('validateSeeds reports duplicate unique values and duplicate ids', () => {
  const groups = validGroups();
  groups[1].entries.push({ id: 'cat-dup', contentType: 'vehicleCategory', fields: { name: 'Dup', slug: 'supercars' } });
  groups[1].entries.push({ id: 'cat-supercars', contentType: 'vehicleCategory', fields: { name: 'Again', slug: 'again' } });
  const kinds = validateSeeds(groups, CONTENT_TYPES).map((problem) => problem.kind).sort();
  assert.deepEqual(kinds, ['duplicate-id', 'validation']);
});

test('validateSeeds honours --only for reporting but resolves links across all groups', () => {
  const groups = validGroups();
  groups[0].assets[0].contentType = 'nope';
  const problems = validateSeeds(groups, CONTENT_TYPES, { only: 'vehicles' });
  assert.deepEqual(problems, []);
  assert.equal(validateSeeds(groups, CONTENT_TYPES, { only: 'nothing' })[0].kind, 'unknown-group');
  assert.deepEqual(selectGroups(groups, 'media,vehicles').map((group) => group.name), ['media', 'vehicles']);
});

test('validateSeeds checks file existence through the injected callback', () => {
  const problems = validateSeeds(validGroups(), CONTENT_TYPES, { fileExists: () => false });
  assert.deepEqual(problems.map((problem) => problem.kind), ['missing-file']);
});

test('error helpers read the SDK JSON message', () => {
  assert.ok(isNotFound(sdkError(404)));
  assert.ok(!isNotFound(sdkError(429)));
  assert.ok(isRateLimited(sdkError(429)));
  assert.equal(rateLimitResetSeconds(sdkError(429)), 2);
  const withHeader = sdkError(429);
  withHeader.response = { status: 429, headers: { 'x-contentful-ratelimit-reset': '3' } };
  assert.equal(rateLimitResetSeconds(withHeader), 3);
  assert.equal(rateLimitResetSeconds(sdkError(429, { details: { reset: 5 } })), 5);
  assert.ok(!isNotFound(new Error('plain')));
});

test('requester retries 429 up to five attempts and serialises calls', async () => {
  const waits = [];
  const request = createRequester({ sleep: async (ms) => waits.push(ms), log: () => {} });
  let calls = 0;
  const value = await request('flaky', async () => {
    calls += 1;
    if (calls < 3) throw sdkError(429);
    return 'ok';
  });
  assert.equal(value, 'ok');
  assert.equal(calls, 3);
  assert.deepEqual(waits, [2000, 2000]);

  let always = 0;
  await assert.rejects(request('always', async () => { always += 1; throw sdkError(429); }), /429/);
  assert.equal(always, 5);

  await assert.rejects(request('other', async () => { throw sdkError(404); }), /404/);

  const order = [];
  const first = request('a', async () => { await new Promise((r) => setTimeout(r, 20)); order.push('a'); });
  const second = request('b', async () => { order.push('b'); });
  await Promise.all([first, second]);
  assert.deepEqual(order, ['a', 'b']);
});

test('error helpers classify 5xx and network failures as retryable', () => {
  assert.ok(isServerError(sdkError(500)));
  assert.ok(isServerError(sdkError(503)));
  assert.ok(!isServerError(sdkError(404)));
  const reset = Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' });
  const timeout = Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' });
  const hangUp = new Error('socket hang up');
  assert.ok(isNetworkError(reset));
  assert.ok(isNetworkError(timeout));
  assert.ok(isNetworkError(hangUp));
  assert.ok(!isNetworkError(sdkError(404)));
  assert.ok(!isNetworkError(new Error('plain')));
  assert.ok(isRetryable(sdkError(429)) && isRetryable(sdkError(502)) && isRetryable(reset));
  assert.ok(!isRetryable(sdkError(404)) && !isRetryable(sdkError(422)) && !isRetryable(new Error('plain')));
});

test('requester retries 5xx and network errors with the same cap and backoff', async () => {
  const waits = [];
  const request = createRequester({ sleep: async (ms) => waits.push(ms), log: () => {} });
  let calls = 0;
  const value = await request('flaky', async () => {
    calls += 1;
    if (calls === 1) throw sdkError(503);
    if (calls === 2) throw Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' });
    if (calls === 3) throw new Error('socket hang up');
    return 'ok';
  });
  assert.equal(value, 'ok');
  assert.equal(calls, 4);
  assert.deepEqual(waits, [2000, 2000, 2000]);

  let always = 0;
  await assert.rejects(request('down', async () => { always += 1; throw sdkError(500); }), /500/);
  assert.equal(always, 5);

  let timeouts = 0;
  await assert.rejects(
    request('slow', async () => { timeouts += 1; throw Object.assign(new Error('timeout of 1000ms'), { code: 'ETIMEDOUT' }); }),
    /timeout/,
  );
  assert.equal(timeouts, 5);

  let client = 0;
  await assert.rejects(request('bad', async () => { client += 1; throw sdkError(422); }), /422/);
  assert.equal(client, 1);
});

test('isPublished follows the Contentful version convention', () => {
  assert.ok(isPublished({ sys: { version: 4, publishedVersion: 3 } }));
  assert.ok(!isPublished({ sys: { version: 5, publishedVersion: 3 } }));
  assert.ok(!isPublished({ sys: { version: 1 } }));
});

test('sameContentType ignores API defaults and null flags', () => {
  const definition = CONTENT_TYPES.find((type) => type.id === 'link');
  const stored = JSON.parse(JSON.stringify(definition));
  stored.sys = { id: 'link', version: 2, publishedVersion: 1 };
  for (const field of stored.fields) {
    field.localized = Boolean(field.localized);
    field.disabled = false;
    field.omitted = false;
    field.required = Boolean(field.required);
    field.validations ??= [];
    for (const validation of field.validations) if (validation.regexp) validation.regexp.flags = null;
  }
  assert.ok(sameContentType(stored, definition));
  stored.fields[0].name = 'Renamed';
  assert.ok(!sameContentType(stored, definition));
  assert.equal(normaliseContentType({ name: 'x', fields: [] }).description, '');
});

test('sameFields and sameAssetMetadata decide when a write can be skipped', () => {
  const desired = buildEntryFields({ id: 'x', contentType: 'specification', fields: { label: 'a', unit: undefined } });
  assert.ok(sameFields({ label: { 'en-US': 'a' } }, desired));
  assert.ok(!sameFields({ label: { 'en-US': 'b' } }, desired));
  // the Management API drops empty arrays, so they must not force an update
  assert.ok(sameFields({ heading: { 'en-US': 'x' } }, { heading: { 'en-US': 'x' }, stories: { 'en-US': [] } }));
  assert.ok(!sameFields({ stories: { 'en-US': [{ sys: { id: 'a' } }] } }, { stories: { 'en-US': [{ sys: { id: 'b' } }] } }));
  assert.ok(!sameFields({ stories: { 'en-US': [{ sys: { id: 'a' } }] } }, { stories: { 'en-US': [] } }));

  const seed = { id: 'img', title: 'T', description: 'D', file: 'assets/placeholders/img.svg', contentType: 'image/svg+xml' };
  const fields = assetFields(seed, 'img.svg', 'upload-1');
  assert.equal(fields.file['en-US'].uploadFrom.sys.id, 'upload-1');
  const stored = { fields: { title: { 'en-US': 'T' }, description: { 'en-US': 'D' }, file: { 'en-US': { fileName: 'img.svg', contentType: 'image/svg+xml', url: '//images.ctfassets.net/x/img.svg', details: { size: 1234 } } } } };
  assert.ok(sameAssetMetadata(stored, seed, 'img.svg', 1234));
  assert.ok(!sameAssetMetadata(stored, { ...seed, title: 'Other' }, 'img.svg', 1234));
  // changed bytes (or unknown length) force a re-upload
  assert.ok(!sameAssetMetadata(stored, seed, 'img.svg', 1235));
  assert.ok(!sameAssetMetadata(stored, seed, 'img.svg'));
  delete stored.fields.file['en-US'].url;
  assert.ok(!sameAssetMetadata(stored, seed, 'img.svg', 1234));
});

test('provisionAssets skips an unchanged asset but re-uploads when the byte size differs', async () => {
  const seed = { id: 'img', title: 'T', description: 'D', file: 'assets/placeholders/img.svg', contentType: 'image/svg+xml' };
  const makeStored = (size) => ({
    sys: { version: 2, publishedVersion: 1 },
    fields: {
      title: { 'en-US': 'T' },
      description: { 'en-US': 'D' },
      file: { 'en-US': { fileName: 'img.svg', contentType: 'image/svg+xml', url: '//x/img.svg', details: { size } } },
    },
  });
  const run = async (storedSize) => {
    const uploads = [];
    const stored = makeStored(storedSize);
    stored.update = async () => stored;
    stored.processForAllLocales = async () => {
      stored.fields.file['en-US'].url = '//x/img.svg';
      return stored;
    };
    stored.publish = async () => ({ ...stored, sys: { version: 4, publishedVersion: 3 } });
    const environment = {
      getAsset: async () => stored,
      createUpload: async ({ file }) => { uploads.push(file.length); return { sys: { id: 'up-1' } }; },
    };
    const summary = await provisionAssets(environment, [seed], {
      log: () => {},
      readFile: () => Buffer.from('12345'),
      request: (label, fn) => fn(),
      sleep: async () => {},
    });
    return { summary, uploads };
  };
  const same = await run(5);
  assert.equal(same.summary.unchanged, 1);
  assert.deepEqual(same.uploads, []);
  const changed = await run(9);
  assert.equal(changed.summary.unchanged, 0);
  assert.equal(changed.summary.updated, 1);
  assert.deepEqual(changed.uploads, [5]);
});

function fakeEnvironment(items) {
  const calls = [];
  return {
    calls,
    getLocales: async () => ({ items }),
    createLocale: async (props) => { calls.push(['create', props]); return { ...props, sys: { id: 'l1' } }; },
  };
}

test('ensureLocales creates a missing locale', async () => {
  const env = fakeEnvironment([{ code: 'en-US', name: 'English (United States)', default: true }]);
  const summary = await ensureLocales(env, LOCALES, { log: () => {}, request: (_, fn) => fn() });
  assert.deepEqual(summary, { created: 1, updated: 0, unchanged: 0 });
  assert.equal(env.calls[0][1].code, 'ja-JP');
  assert.equal(env.calls[0][1].fallbackCode, 'en-US');
});

test('ensureLocales updates a locale whose fallback differs and leaves a matching one alone', async () => {
  let updated = 0;
  const stale = { code: 'ja-JP', name: 'Japanese (Japan)', fallbackCode: null, optional: true, contentDeliveryApi: true, contentManagementApi: true, update: async function () { updated += 1; return this; } };
  const env = fakeEnvironment([stale]);
  assert.deepEqual(await ensureLocales(env, LOCALES, { log: () => {}, request: (_, fn) => fn() }), { created: 0, updated: 1, unchanged: 0 });
  assert.equal(updated, 1);
  assert.equal(stale.fallbackCode, 'en-US');
  const fresh = fakeEnvironment([{ ...LOCALES[0], update: async () => { throw new Error('must not update'); } }]);
  assert.deepEqual(await ensureLocales(fresh, LOCALES, { log: () => {}, request: (_, fn) => fn() }), { created: 0, updated: 0, unchanged: 1 });
});

test('needsTranslation is true for words and rich text, false for numbers', () => {
  assert.equal(needsTranslation('Top speed'), true);
  assert.equal(needsTranslation('7 speed'), true);
  assert.equal(needsTranslation('750'), false);
  assert.equal(needsTranslation('2.9'), false);
  assert.equal(needsTranslation(''), false);
  assert.equal(needsTranslation(12), false);
  assert.equal(needsTranslation(richText), true);
  assert.equal(needsTranslation({ lat: 1, lon: 2 }), false);
});

test('buildEntryFields merges overlay values under their locale', () => {
  const translations = { 'ja-JP': { x: { label: '最高速度' } } };
  const fields = buildEntryFields({ id: 'x', contentType: 'specification', fields: { label: 'Top speed', order: 2 }, links: { vehicle: 'v' } }, { translations });
  assert.deepEqual(fields.label, { 'en-US': 'Top speed', 'ja-JP': '最高速度' });
  assert.deepEqual(fields.order, { 'en-US': 2 });
  assert.deepEqual(Object.keys(fields.vehicle), ['en-US']);
  assert.deepEqual(buildEntryFields({ id: 'x', contentType: 'specification', fields: { label: 'Top speed' } }).label, { 'en-US': 'Top speed' });
});

test('validateSeeds reports untranslated and unknown overlay keys', () => {
  const groups = validGroups();
  const bad = { 'ja-JP': { 'cat-supercars': { name: 'スーパーカー', slug: 'x' }, 'no-such-entry': { name: 'y' } } };
  const kinds = validateSeeds(groups, CONTENT_TYPES, { translations: bad }).map((p) => `${p.kind}:${p.id}:${p.field ?? ''}`);
  assert.ok(kinds.includes('unknown-translation-field:cat-supercars:slug'));
  assert.ok(kinds.includes('unknown-translation-entry:no-such-entry:'));
  assert.ok(kinds.includes('untranslated:vehicle-750s:name'));
  assert.ok(!kinds.includes('untranslated:cat-supercars:name'));
  assert.ok(!kinds.includes('untranslated:vehicle-750s:order'));
});

test('translationCoverage counts fields that need translation per group', () => {
  const groups = validGroups();
  const rows = translationCoverage(groups, CONTENT_TYPES, { 'ja-JP': { 'cat-supercars': { name: 'スーパーカー' } } });
  const vehicles = rows.find((r) => r.group === 'vehicles' && r.locale === 'ja-JP');
  assert.equal(vehicles.translated, 1);
  assert.ok(vehicles.total > 1);
  assert.equal(rows.find((r) => r.group === 'media').total, 0);
});

test('the repository seeds, overlays and model validate together', () => {
  const problems = validateSeeds(SEED_GROUPS, CONTENT_TYPES, { translations: TRANSLATIONS }).filter((p) => p.kind !== 'untranslated');
  assert.deepEqual(problems, []);
});

const allSeeds = () => SEED_GROUPS.flatMap((group) => group.entries);

test('audience seeds: nine audiences with the pinned keys and rules', () => {
  const group = SEED_GROUPS.find((g) => g.name === 'audiences');
  const audiences = group.entries.filter((e) => e.contentType === 'audience');
  assert.deepEqual(audiences.map((e) => e.fields.key), ['supercar-fans', 'returning', 'trackday', 'uk', 'us', 'jp', 'fr', 'it', 'vip']);
  const byKey = Object.fromEntries(audiences.map((e) => [e.fields.key, e]));
  assert.deepEqual(byKey['supercar-fans'].links.interestCategories, ['cat-supercars']);
  assert.equal(byKey.returning.fields.visitorType, 'returning');
  assert.deepEqual(byKey.trackday.fields.campaigns, ['trackday']);
  for (const [key, region] of [['uk', 'GB'], ['us', 'US'], ['jp', 'JP'], ['fr', 'FR'], ['it', 'IT']]) {
    assert.deepEqual(byKey[key].fields.regions, [region], key);
  }
  assert.equal(byKey.vip.fields.source, 'external');
  assert.equal(byKey.vip.links, undefined);
  for (const rule of ['campaigns', 'regions', 'minVisits', 'visitorType']) assert.equal(byKey.vip.fields[rule], undefined);
});

test('personalized seeds wrap the home hero, the home banner, the Pordoi Su Misura banner and the Pordoi enquiry CTA', () => {
  const byId = new Map(allSeeds().map((e) => [e.id, e]));
  const keysOf = (id) => byId.get(id).links.variants.map((v) => byId.get(byId.get(v).links.audience).fields.key);
  const contentOf = (id) => byId.get(id).links.variants.map((v) => byId.get(v).links.content);
  assert.deepEqual(byId.get('page-home').links.sections, ['text-home-intro', 'pc-home-banner', 'stories-latest', 'cta-home']);
  assert.equal(byId.get('pc-home-banner').links.default, 'banner-mcl-6gt');
  assert.deepEqual(keysOf('pc-home-banner'), ['supercar-fans', 'trackday']);
  assert.equal(byId.get('page-home').links.heroBanner, 'pc-home-hero');
  assert.equal(byId.get('pc-home-hero').links.default, 'banner-hero-home');
  assert.deepEqual(keysOf('pc-home-hero'), ['vip', 'trackday', 'supercar-fans', 'uk', 'us', 'jp', 'fr', 'it', 'returning']);
  assert.ok(contentOf('pc-home-hero').every((id) => byId.get(id).contentType === 'bannerButton'), 'every hero variant is a banner');
  for (const region of ['uk', 'us', 'jp', 'fr', 'it']) {
    const image = byId.get(`banner-hero-${region}`).assets.image;
    assert.equal(image, `img-home-hero-${region === 'uk' ? 'gb' : region}`, `${region} hero shows its flag drape`);
  }
  const coupe = byId.get('vehicle-750s');
  assert.equal(coupe.links.msoBanner, 'pc-750s-mso-banner');
  assert.equal(coupe.links.enquiryCta, 'pc-750s-enquiry-cta');
  assert.equal(coupe.fields.enquiryUrl, '#/enquire/pordoi', 'the fallback stays');
  assert.equal(byId.get('pc-750s-mso-banner').links.default, 'banner-mso-generic');
  assert.deepEqual(keysOf('pc-750s-mso-banner'), ['returning']);
  assert.equal(byId.get('pc-750s-enquiry-cta').links.default, 'link-cta-enquire-750s');
  assert.deepEqual(keysOf('pc-750s-enquiry-cta'), ['uk']);
  assert.deepEqual(contentOf('pc-750s-enquiry-cta'), ['link-cta-uk-retailer']);
  assert.equal(byId.get('link-cta-uk-retailer').fields.externalUrl, '#/retailers');
  const spider = byId.get('vehicle-750s-spider');
  assert.equal(spider.links.msoBanner, 'banner-mso-generic');
  assert.equal(spider.links.enquiryCta, undefined);
});

test('the full seed set validates against the content model, with every link resolving', () => {
  assert.deepEqual(validateSeeds(SEED_GROUPS, CONTENT_TYPES), []);
});
