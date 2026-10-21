import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { resolve, assetUrl, createClient, isLink } from '../site/js/cda.js';

const here = dirname(fileURLToPath(import.meta.url));
const loadFixture = () => JSON.parse(readFileSync(join(here, 'fixtures', 'cda-payload.json'), 'utf8'));

test('resolve replaces nested entry links from includes', () => {
  const [vehicle] = resolve(loadFixture());
  assert.equal(vehicle.sys.id, 'vehicle-750s');
  assert.equal(vehicle.fields.name, '750S');
  assert.equal(vehicle.fields.category.fields.name, 'Supercars');
  // three levels deep: vehicle → category → banner → cta link
  assert.equal(vehicle.fields.category.fields.featuredBanner.fields.heading, 'Legend-inspired');
  assert.equal(vehicle.fields.category.fields.featuredBanner.fields.cta.fields.label, 'Discover');
  // scalar fields are preserved
  assert.equal(vehicle.fields.order, 2);
});

test('resolve replaces asset links and prefixes https:', () => {
  const [vehicle] = resolve(loadFixture());
  const hero = vehicle.fields.heroImage;
  assert.equal(hero.sys.type, 'Asset');
  assert.equal(hero.fields.title, '750S hero');
  assert.match(hero.fields.file.url, /^https:\/\/images\.ctfassets\.net\//);
  assert.equal(hero.fields.file.details.image.width, 1920);
});

test('resolve leaves unresolvable links as null, in arrays and single fields', () => {
  const [vehicle] = resolve(loadFixture());
  assert.equal(vehicle.fields.specifications.length, 2);
  assert.equal(vehicle.fields.specifications[0].fields.label, 'Top speed');
  assert.equal(vehicle.fields.specifications[1], null);
  assert.equal(vehicle.fields.msoBanner, null);
});

test('resolve tolerates cycles and reuses the same object', () => {
  const [vehicle] = resolve(loadFixture());
  const storyA = vehicle.fields.relatedStories[0];
  const storyB = storyA.fields.sections[0];
  assert.equal(storyA.fields.title, 'Story A');
  assert.equal(storyB.fields.title, 'Story B');
  // A → B → A: same object reference, not an infinite walk
  assert.equal(storyB.fields.sections[0], storyA);
  // links back to a top-level item resolve to that item
  assert.equal(storyA.fields.relatedVehicles[0], vehicle);
  assert.equal(vehicle.fields.category.fields.featuredBanner.fields.cta.fields.target, vehicle);
  // the resolved tree can still be serialised when cycles are cut by the caller
  assert.doesNotThrow(() => JSON.stringify(vehicle, (key, value) => (key === 'relatedVehicles' || key === 'target' || key === 'sections' ? undefined : value)));
});

test('resolve walks into rich text data.target links', () => {
  const [vehicle] = resolve(loadFixture());
  const faq = vehicle.fields.faqs[0];
  const embedded = faq.fields.answer.content[0];
  assert.equal(embedded.nodeType, 'embedded-asset-block');
  assert.equal(embedded.data.target.fields.title, '750S hero');
  assert.match(embedded.data.target.fields.file.url, /^https:/);
});

test('resolve handles empty or malformed payloads', () => {
  assert.deepEqual(resolve(null), []);
  assert.deepEqual(resolve({}), []);
  assert.deepEqual(resolve({ items: [] }), []);
  const [entry] = resolve({ items: [{ sys: { id: 'x', type: 'Entry' }, fields: { title: 'No includes' } }] });
  assert.equal(entry.fields.title, 'No includes');
});

test('isLink recognises link objects only', () => {
  assert.equal(isLink({ sys: { type: 'Link', linkType: 'Entry', id: 'a' } }), true);
  assert.equal(isLink({ sys: { type: 'Entry', id: 'a' } }), false);
  assert.equal(isLink(null), false);
  assert.equal(isLink('x'), false);
});

test('assetUrl returns https URL with optional Images API params', () => {
  const asset = { fields: { file: { url: '//images.ctfassets.net/s/a/b/c.jpg' } } };
  assert.equal(assetUrl(asset), 'https://images.ctfassets.net/s/a/b/c.jpg');
  assert.equal(assetUrl(asset, { w: 1600, fm: 'webp', q: 80 }), 'https://images.ctfassets.net/s/a/b/c.jpg?w=1600&fm=webp&q=80');
  assert.equal(assetUrl({ fields: { file: { url: 'https://x/y.png' } } }, { w: 10 }), 'https://x/y.png?w=10');
  assert.equal(assetUrl(null), '');
  assert.equal(assetUrl({ fields: {} }), '');
});

test('createClient requests the Delivery API and resolves results', async () => {
  const calls = [];
  const fakeFetch = async (url) => {
    calls.push(new URL(url));
    return { ok: true, status: 200, json: async () => loadFixture() };
  };
  const client = createClient({ spaceId: 'space', environment: 'master', deliveryToken: 'tok' }, { fetch: fakeFetch });
  const vehicle = await client.getBySlug('vehicle', '750s');
  assert.equal(vehicle.fields.category.fields.name, 'Supercars');
  const url = calls[0];
  assert.equal(url.origin, 'https://cdn.contentful.com');
  assert.equal(url.pathname, '/spaces/space/environments/master/entries');
  assert.equal(url.searchParams.get('access_token'), 'tok');
  assert.equal(url.searchParams.get('content_type'), 'vehicle');
  assert.equal(url.searchParams.get('fields.slug'), '750s');
  assert.equal(url.searchParams.get('include'), '4');
  assert.equal(url.searchParams.get('limit'), '1');

  await client.getVehiclesInCategory('cat-1');
  assert.equal(calls[1].searchParams.get('fields.category.sys.id'), 'cat-1');
  assert.equal(calls[1].searchParams.get('order'), 'fields.order');
  await client.getVariants('vehicle-750s');
  assert.equal(calls[2].searchParams.get('fields.parentModel.sys.id'), 'vehicle-750s');
  await client.getSiteSettings();
  assert.equal(calls[3].searchParams.get('content_type'), 'siteSettings');
  assert.equal(calls[3].searchParams.get('include'), '3');
  await client.getPagesByParent('page-legacy');
  assert.equal(calls[4].searchParams.get('fields.parent.sys.id'), 'page-legacy');
  await client.getStories(3);
  assert.equal(calls[5].searchParams.get('order'), '-fields.publishDate');
  assert.equal(calls[5].searchParams.get('limit'), '3');
  await client.getCurrentVehicles();
  assert.equal(calls[6].searchParams.get('content_type'), 'vehicle');
  assert.equal(calls[6].searchParams.get('fields.status[in]'), 'current,motorsport');
  assert.equal(calls[6].searchParams.has('fields.status'), false);
  assert.equal(calls[6].searchParams.get('include'), '2', 'category resolves');
});

test('getEnquiryForm requests the singleton with include 1 and returns the first item or null', async () => {
  const calls = [];
  const payloads = [
    { items: [{ sys: { id: 'f1', type: 'Entry' }, fields: { title: 'Enquire' } }], includes: {} },
    { items: [], includes: {} },
  ];
  const fakeFetch = async (url) => {
    calls.push(new URL(url));
    return { ok: true, status: 200, json: async () => payloads.shift() };
  };
  const client = createClient({ spaceId: 'space', deliveryToken: 'tok' }, { fetch: fakeFetch });
  const form = await client.getEnquiryForm();
  assert.equal(form.fields.title, 'Enquire');
  assert.equal(calls[0].searchParams.get('content_type'), 'enquiryForm');
  assert.equal(calls[0].searchParams.get('limit'), '1');
  assert.equal(calls[0].searchParams.get('include'), '1');
  // A fresh client, because the first response is cached by URL.
  const emptyClient = createClient({ spaceId: 'space', deliveryToken: 'tok' }, { fetch: fakeFetch });
  assert.equal(await emptyClient.getEnquiryForm(), null);
});

test('createClient treats an unknown content type as an empty result and throws on other errors', async () => {
  const warnings = [];
  const responses = [
    {
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => ({ sys: { id: 'InvalidQuery' }, details: { errors: [{ name: 'unknownContentType', value: 'DOESNOTEXIST' }] } }),
    },
    { ok: false, status: 401, statusText: 'Unauthorized', json: async () => ({ message: 'The access token you sent could not be found' }) },
  ];
  const fakeFetch = async () => responses.shift();
  const client = createClient({ spaceId: 's', deliveryToken: 't' }, { fetch: fakeFetch, warn: (m) => warnings.push(m) });
  assert.deepEqual(await client.getCategories(), []);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /vehicleCategory/);
  await assert.rejects(() => client.getRetailers(), /401.*access token/);
});

test('createClient requires spaceId and deliveryToken', () => {
  assert.throws(() => createClient({}), /spaceId/);
});

test('createClient caches responses by URL for the life of the client', async () => {
  let fetches = 0;
  const fakeFetch = async () => {
    fetches += 1;
    return { ok: true, status: 200, json: async () => loadFixture() };
  };
  const client = createClient({ spaceId: 'space', deliveryToken: 'tok' }, { fetch: fakeFetch });
  const [first, second] = await Promise.all([client.getBySlug('vehicle', '750s'), client.getBySlug('vehicle', '750s')]);
  assert.equal(fetches, 1, 'concurrent identical requests share one fetch');
  assert.equal(first.fields.name, second.fields.name);
  assert.notEqual(first, second, 'each call resolves its own object graph');
  await client.getBySlug('vehicle', '750s');
  assert.equal(fetches, 1, 'a repeat read is served from the cache');
  await client.getBySlug('vehicle', '750s-spider');
  assert.equal(fetches, 2, 'a different query is a different cache key');
  await client.getBySlug('vehicle', '750s', 2);
  assert.equal(fetches, 3, 'include depth is part of the key');
});

test('createClient does not cache a failed request', async () => {
  let fetches = 0;
  const fakeFetch = async () => {
    fetches += 1;
    if (fetches === 1) return { ok: false, status: 500, statusText: 'Server Error', json: async () => ({ message: 'boom' }) };
    return { ok: true, status: 200, json: async () => loadFixture() };
  };
  const client = createClient({ spaceId: 'space', deliveryToken: 'tok' }, { fetch: fakeFetch });
  await assert.rejects(() => client.getBySlug('vehicle', '750s'), /Contentful 500/);
  const vehicle = await client.getBySlug('vehicle', '750s');
  assert.equal(vehicle.fields.name, '750S');
  assert.equal(fetches, 2);
});
