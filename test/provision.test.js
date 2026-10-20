import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CONTENT_TYPES } from '../src/content-model.js';
import { assetFields, provisionAssets, sameAssetMetadata } from '../src/provision/assets.js';
import { normaliseContentType, sameContentType } from '../src/provision/content-types.js';
import { sameFields } from '../src/provision/entries.js';
import { isNetworkError, isNotFound, isRateLimited, isRetryable, isServerError, rateLimitResetSeconds } from '../src/provision/errors.js';
import { buildEntryFields } from '../src/provision/fields.js';
import { createRequester, isPublished } from '../src/provision/requests.js';
import { selectGroups, validateContentModel, validateSeeds } from '../src/provision/validate.js';

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
          fields: { name: 'McLaren London', city: 'London', country: 'United Kingdom', location: { lat: 51.5, lon: -0.12 }, website: 'https://example.com' },
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

test('the content model covers every type in the design', () => {
  const ids = CONTENT_TYPES.map((type) => type.id);
  const expected = [
    'siteSettings', 'link', 'linkGroup', 'seoMetadata', 'vehicleCategory', 'vehicle', 'specification',
    'featureHighlight', 'mediaSlide', 'lineageEntry', 'faqItem', 'page', 'story', 'textBlock', 'imageBlock',
    'bannerButton', 'card', 'cardGrid', 'vehicleGrid', 'storyGrid', 'ctaGroup', 'retailer',
  ];
  for (const id of expected) assert.ok(ids.includes(id), `missing content type ${id}`);
  assert.equal(ids.length, expected.length);
  const retailer = CONTENT_TYPES.find((type) => type.id === 'retailer');
  assert.equal(retailer.fields.find((field) => field.id === 'location').type, 'Location');
  const vehicle = CONTENT_TYPES.find((type) => type.id === 'vehicle');
  assert.deepEqual(vehicle.fields.find((field) => field.id === 'heroImage').validations, [{ linkMimetypeGroup: ['image'] }]);
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
    field.localized = false;
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
