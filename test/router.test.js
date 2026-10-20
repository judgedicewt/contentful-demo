import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchRoute, routeFor, linkHref, loadRoute, segmentsOf, isExternalHref } from '../site/js/router.js';

const entry = (type, fields = {}, id = `${type}-1`) => ({
  sys: { id, type: 'Entry', contentType: { sys: { type: 'Link', linkType: 'ContentType', id: type } } },
  fields,
});

test('matchRoute: home', () => {
  for (const hash of ['', '#', '#/', '#/home', '#/home/', '/']) {
    assert.deepEqual(matchRoute(hash), { name: 'home', params: {} }, `hash ${JSON.stringify(hash)}`);
  }
});

test('matchRoute: current-models redirects to supercars', () => {
  assert.deepEqual(matchRoute('#/current-models'), { name: 'redirect', params: { to: '#/current-models/supercars' } });
  assert.deepEqual(matchRoute('#/current-models/'), { name: 'redirect', params: { to: '#/current-models/supercars' } });
});

test('matchRoute: categories', () => {
  for (const slug of ['supercars', 'grand-tourer', 'ultimate', 'motorsport']) {
    assert.deepEqual(matchRoute(`#/current-models/${slug}`), { name: 'category', params: { slug } });
  }
});

test('matchRoute: stories', () => {
  for (const slug of ['750s-five-key-facts', 'artura-spider-performance', 'w1-designed-by-air', 'mso-project-placeholder']) {
    assert.deepEqual(matchRoute(`#/post/${slug}`), { name: 'story', params: { slug } });
  }
});

test('matchRoute: retailers', () => {
  assert.deepEqual(matchRoute('#/retailers'), { name: 'retailers', params: {} });
});

test('matchRoute: pages and vehicles share the page route with the full path as slug', () => {
  const slugs = [
    'legacy',
    'legacy/2010s',
    'legacy/1990s',
    'ownership',
    'ownership/roadside-assistance',
    'experiences',
    'mso',
    'artura',
    'artura-spider',
    '750s',
    '750s-spider',
    'gts',
    'w1',
    'artura-gt4',
    '720s',
    '765lt',
    'p1',
    'f1',
  ];
  for (const slug of slugs) {
    assert.deepEqual(matchRoute(`#/${slug}`), { name: 'page', params: { slug } });
  }
});

test('matchRoute: strips query strings, decodes segments, rejects deep paths', () => {
  assert.deepEqual(matchRoute('#/750s?utm=x'), { name: 'page', params: { slug: '750s' } });
  assert.deepEqual(matchRoute('#/post/caf%C3%A9'), { name: 'story', params: { slug: 'café' } });
  assert.equal(matchRoute('#/a/b/c').name, 'notFound');
  assert.equal(matchRoute('#/post').name, 'notFound');
  assert.equal(matchRoute('#/post/a/b').name, 'notFound');
  assert.equal(matchRoute('#/current-models/a/b').name, 'notFound');
  assert.deepEqual(segmentsOf('#/a//b/'), ['a', 'b']);
});

test('routeFor builds hashes per content type', () => {
  assert.equal(routeFor(entry('vehicle', { slug: '750s' })), '#/750s');
  assert.equal(routeFor(entry('vehicleCategory', { slug: 'supercars' })), '#/current-models/supercars');
  assert.equal(routeFor(entry('story', { slug: '750s-five-key-facts' })), '#/post/750s-five-key-facts');
  assert.equal(routeFor(entry('page', { slug: 'ownership/roadside-assistance' })), '#/ownership/roadside-assistance');
  assert.equal(routeFor(entry('page', { slug: 'home' })), '#/');
  assert.equal(routeFor(entry('retailer', { name: 'x' })), '#/');
  assert.equal(routeFor(null), '#/');
  assert.equal(routeFor({ sys: {}, fields: {} }), '#/');
});

test('linkHref resolves targets, external URLs, and missing data', () => {
  const vehicle = entry('vehicle', { slug: 'gts' });
  assert.equal(linkHref(entry('link', { label: 'GTS', target: vehicle })), '#/gts');
  assert.equal(linkHref(entry('link', { label: 'Configure', externalUrl: 'https://configure.example.com/750s' })), 'https://configure.example.com/750s');
  // unresolved target (null) falls back to the external URL
  assert.equal(linkHref(entry('link', { label: 'x', target: null, externalUrl: 'https://example.com' })), 'https://example.com');
  assert.equal(linkHref(entry('link', { label: 'Nothing' })), '#');
  assert.equal(linkHref(null), '#');
  assert.equal(linkHref('#/retailers'), '#/retailers');
  assert.equal(isExternalHref('https://example.com'), true);
  assert.equal(isExternalHref('#/750s'), false);
});

function fakeCda(store) {
  const calls = [];
  return {
    calls,
    async getBySlug(type, slug) {
      calls.push(['getBySlug', type, slug]);
      return store[type]?.[slug] || null;
    },
    async getVehiclesInCategory(id) {
      calls.push(['getVehiclesInCategory', id]);
      return store.vehiclesByCategory?.[id] || [];
    },
    async getVariants(id) {
      calls.push(['getVariants', id]);
      return store.variants?.[id] || [];
    },
    async getPagesByParent(id) {
      calls.push(['getPagesByParent', id]);
      return store.pagesByParent?.[id] || [];
    },
    async getStories(limit) {
      calls.push(['getStories', limit]);
      return store.stories || [];
    },
    async getRetailers() {
      calls.push(['getRetailers']);
      return store.retailers || [];
    },
  };
}

test('loadRoute tries a vehicle before a page and fetches variants', async () => {
  const coupe = entry('vehicle', { slug: '750s' }, 'v-750s');
  const spider = entry('vehicle', { slug: '750s-spider', parentModel: coupe }, 'v-750s-spider');
  const cda = fakeCda({ vehicle: { '750s': coupe }, variants: { 'v-750s': [spider] } });
  const result = await loadRoute(matchRoute('#/750s'), cda);
  assert.equal(result.view, 'vehicle');
  assert.equal(result.data.entry, coupe);
  assert.deepEqual(result.data.variants, [spider]);
  assert.deepEqual(cda.calls[0], ['getBySlug', 'vehicle', '750s']);
});

test('loadRoute falls back to a page with siblings and children', async () => {
  const legacy = entry('page', { slug: 'legacy', title: 'Legacy' }, 'p-legacy');
  const decade = entry('page', { slug: 'legacy/2010s', title: '2010s', parent: legacy }, 'p-2010s');
  const cda = fakeCda({
    page: { legacy, 'legacy/2010s': decade },
    pagesByParent: { 'p-legacy': [decade] },
  });
  const hub = await loadRoute(matchRoute('#/legacy'), cda);
  assert.equal(hub.view, 'page');
  assert.deepEqual(hub.data.children, [decade]);
  assert.deepEqual(hub.data.siblings, []);
  assert.deepEqual(cda.calls[0], ['getBySlug', 'vehicle', 'legacy']);
  assert.deepEqual(cda.calls[1], ['getBySlug', 'page', 'legacy']);

  const sub = await loadRoute(matchRoute('#/legacy/2010s'), cda);
  assert.equal(sub.view, 'page');
  assert.deepEqual(sub.data.siblings, [decade]);
});

test('loadRoute: home, category, story, retailers, redirect, notFound', async () => {
  const home = entry('page', { slug: 'home', sections: [entry('storyGrid', { stories: [] })] }, 'p-home');
  const supercars = entry('vehicleCategory', { slug: 'supercars' }, 'cat-supercars');
  const artura = entry('vehicle', { slug: 'artura' }, 'v-artura');
  const story = entry('story', { slug: 'w1-designed-by-air' }, 's-w1');
  const retailer = entry('retailer', { name: 'McLaren London' });
  const latest = [entry('story', { slug: 'latest' })];
  const cda = fakeCda({
    page: { home },
    vehicleCategory: { supercars },
    story: { 'w1-designed-by-air': story },
    vehiclesByCategory: { 'cat-supercars': [artura] },
    retailers: [retailer],
    stories: latest,
  });

  const homeResult = await loadRoute(matchRoute('#/'), cda);
  assert.equal(homeResult.view, 'home');
  assert.equal(homeResult.data.entry, home);
  assert.deepEqual(homeResult.data.latestStories, latest);

  const category = await loadRoute(matchRoute('#/current-models/supercars'), cda);
  assert.equal(category.view, 'vehicleCategory');
  assert.deepEqual(category.data.vehicles, [artura]);

  const storyResult = await loadRoute(matchRoute('#/post/w1-designed-by-air'), cda);
  assert.equal(storyResult.view, 'story');
  assert.equal(storyResult.data.entry, story);

  const retailers = await loadRoute(matchRoute('#/retailers'), cda);
  assert.equal(retailers.view, 'retailers');
  assert.deepEqual(retailers.data.retailers, [retailer]);

  const redirect = await loadRoute(matchRoute('#/current-models'), cda);
  assert.deepEqual(redirect, { view: 'redirect', data: { to: '#/current-models/supercars' } });

  const missing = await loadRoute(matchRoute('#/does-not-exist'), cda);
  assert.equal(missing.view, 'notFound');
  assert.equal(missing.data.route.params.slug, 'does-not-exist');
  const missingCategory = await loadRoute(matchRoute('#/current-models/nope'), cda);
  assert.equal(missingCategory.view, 'notFound');
});
