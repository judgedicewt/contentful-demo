import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeUrl } from '../site/js/dom.js';
import { matchRoute, routeFor, linkHref, loadRoute, segmentsOf, isExternalHref, familyRootId, withLang, hashForLang, CONTENT_INCLUDE } from '../site/js/router.js';

const entry = (type, fields = {}, id = `${type}-1`) => ({
  sys: { id, type: 'Entry', contentType: { sys: { type: 'Link', linkType: 'ContentType', id: type } } },
  fields,
});

test('matchRoute: home', () => {
  for (const hash of ['', '#', '#/', '#/home', '#/home/', '/']) {
    assert.deepEqual(matchRoute(hash), { name: 'home', params: {}, lang: 'en' }, `hash ${JSON.stringify(hash)}`);
  }
});

test('matchRoute: current-models redirects to supercars', () => {
  assert.deepEqual(matchRoute('#/current-models'), { name: 'redirect', params: { to: '#/current-models/supercars' }, lang: 'en' });
  assert.deepEqual(matchRoute('#/current-models/'), { name: 'redirect', params: { to: '#/current-models/supercars' }, lang: 'en' });
});

test('matchRoute: categories', () => {
  for (const slug of ['supercars', 'grand-tourer', 'ultimate', 'motorsport']) {
    assert.deepEqual(matchRoute(`#/current-models/${slug}`), { name: 'category', params: { slug }, lang: 'en' });
  }
});

test('matchRoute: stories', () => {
  for (const slug of ['750s-five-key-facts', 'artura-spider-performance', 'w1-designed-by-air', 'su-misura-project']) {
    assert.deepEqual(matchRoute(`#/post/${slug}`), { name: 'story', params: { slug }, lang: 'en' });
  }
});

test('matchRoute: retailers', () => {
  assert.deepEqual(matchRoute('#/retailers'), { name: 'retailers', params: {}, lang: 'en' });
});

test('matchRoute: pages and vehicles share the page route with the full path as slug', () => {
  const slugs = [
    'legacy',
    'legacy/2010s',
    'legacy/1990s',
    'ownership',
    'ownership/roadside-assistance',
    'experiences',
    'su-misura',
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
    assert.deepEqual(matchRoute(`#/${slug}`), { name: 'page', params: { slug }, lang: 'en' });
  }
});

test('matchRoute: strips query strings, decodes segments, rejects deep paths', () => {
  assert.deepEqual(matchRoute('#/750s?utm=x'), { name: 'page', params: { slug: '750s' }, lang: 'en' });
  assert.deepEqual(matchRoute('#/post/caf%C3%A9'), { name: 'story', params: { slug: 'café' }, lang: 'en' });
  assert.equal(matchRoute('#/a/b/c').name, 'notFound');
  assert.equal(matchRoute('#/post').name, 'notFound');
  assert.equal(matchRoute('#/post/a/b').name, 'notFound');
  assert.equal(matchRoute('#/current-models/a/b').name, 'notFound');
  assert.deepEqual(segmentsOf('#/a//b/'), ['a', 'b']);
});

test('matchRoute: in-page anchors such as the skip link are ignored, not 404s', () => {
  for (const hash of ['#main', '#content', '#section-2', '#main?x=1']) {
    assert.deepEqual(matchRoute(hash), { name: 'ignore', params: {}, lang: 'en' }, hash);
  }
  // empty, bare # and real routes are untouched
  assert.equal(matchRoute('#').name, 'home');
  assert.equal(matchRoute('').name, 'home');
  assert.equal(matchRoute('#/main').name, 'page');
});

test('matchRoute: placeholder destinations at any depth', () => {
  assert.deepEqual(matchRoute('#/configure/750s'), { name: 'placeholder', params: { path: 'configure/750s', kind: 'configure', slug: '750s' }, lang: 'en' });
  assert.deepEqual(matchRoute('#/contact'), { name: 'placeholder', params: { path: 'contact', kind: 'contact', slug: null }, lang: 'en' });
  assert.deepEqual(matchRoute('#/legal/privacy'), { name: 'placeholder', params: { path: 'legal/privacy', kind: 'legal', slug: 'privacy' }, lang: 'en' });
  assert.deepEqual(matchRoute('#/placeholder/winter-ball'), { name: 'placeholder', params: { path: 'placeholder/winter-ball', kind: 'placeholder', slug: 'winter-ball' }, lang: 'en' });
  assert.deepEqual(matchRoute('#/nova-6gt'), { name: 'placeholder', params: { path: 'nova-6gt', kind: 'nova-6gt', slug: null }, lang: 'en' });
  const deep = matchRoute('#/configure/750s/extra/segments');
  assert.equal(deep.name, 'placeholder');
  assert.equal(deep.params.path, 'configure/750s/extra/segments');
  assert.equal(deep.params.slug, '750s');
  assert.equal(matchRoute('#/legal/a/b/c').name, 'placeholder');
});

test('matchRoute: segments are lowercased', () => {
  assert.deepEqual(matchRoute('#/W1'), { name: 'page', params: { slug: 'w1' }, lang: 'en' });
  assert.deepEqual(matchRoute('#/Legacy/2010S'), { name: 'page', params: { slug: 'legacy/2010s' }, lang: 'en' });
  assert.deepEqual(matchRoute('#/Post/W1-Designed-By-Air'), { name: 'story', params: { slug: 'w1-designed-by-air' }, lang: 'en' });
  assert.deepEqual(matchRoute('#/Current-Models/Supercars'), { name: 'category', params: { slug: 'supercars' }, lang: 'en' });
  assert.equal(matchRoute('#/Configure/750S').params.slug, '750s');
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
  assert.equal(linkHref(entry('link', { label: 'Mail', externalUrl: 'mailto:hello@example.com' })), 'mailto:hello@example.com');
  assert.equal(linkHref(null), '#');
  assert.equal(linkHref('#/retailers'), '#/retailers');
  assert.equal(isExternalHref('https://example.com'), true);
  assert.equal(isExternalHref('#/750s'), false);
});

test('linkHref never returns an unsafe URL', () => {
  assert.equal(linkHref(entry('link', { label: 'x', externalUrl: 'javascript:alert(1)' })), '#');
  assert.equal(linkHref(entry('link', { label: 'x', externalUrl: '  JaVaScRiPt:alert(1)' })), '#');
  assert.equal(linkHref(entry('link', { label: 'x', externalUrl: 'data:text/html,<script>1</script>' })), '#');
  assert.equal(linkHref('javascript:alert(1)'), '#');
  assert.equal(safeUrl('vbscript:x'), '#');
  assert.equal(safeUrl(''), '#');
  assert.equal(safeUrl('https://example.com/a'), 'https://example.com/a');
});

function fakeCda(store) {
  const calls = [];
  const includes = [];
  return {
    calls,
    includes,
    async getBySlug(type, slug, include) {
      calls.push(['getBySlug', type, slug]);
      includes.push([type, slug, include]);
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
    async getCurrentVehicles() {
      calls.push(['getCurrentVehicles']);
      if (store.currentVehiclesError) throw store.currentVehiclesError;
      return store.currentVehicles || [];
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

test('loadRoute keys the variants query on the family root, so a child variant lists its siblings', async () => {
  const coupe = entry('vehicle', { slug: '750s' }, 'v-750s');
  const spider = entry('vehicle', { slug: '750s-spider', parentModel: coupe }, 'v-750s-spider');
  const cda = fakeCda({ vehicle: { '750s': coupe, '750s-spider': spider }, variants: { 'v-750s': [spider] } });
  const result = await loadRoute(matchRoute('#/750s-spider'), cda);
  assert.equal(result.view, 'vehicle');
  assert.equal(result.data.entry, spider);
  assert.deepEqual(result.data.variants, [spider]);
  assert.deepEqual(cda.calls[1], ['getVariants', 'v-750s']);
});

test('familyRootId is the parent model when present, else the vehicle itself', () => {
  const coupe = entry('vehicle', { slug: '750s' }, 'v-750s');
  const spider = entry('vehicle', { slug: '750s-spider', parentModel: coupe }, 'v-750s-spider');
  assert.equal(familyRootId(coupe), 'v-750s');
  assert.equal(familyRootId(spider), 'v-750s');
  assert.equal(familyRootId(entry('vehicle', { slug: 'x', parentModel: null }, 'v-x')), 'v-x');
  assert.equal(familyRootId(null), '');
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
  const retailer = entry('retailer', { name: 'Strada Nova London' });
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

test('loadRoute: home route loads showcase vehicles', async () => {
  const home = entry('page', { slug: 'home', sections: [] }, 'p-home');
  const models = [entry('vehicle', { slug: 'artura' }, 'v-artura'), entry('vehicle', { slug: '750s' }, 'v-750s')];
  const cda = fakeCda({ page: { home }, currentVehicles: models });
  const result = await loadRoute(matchRoute('#/'), cda);
  assert.equal(result.view, 'home');
  assert.equal(result.data.showcase.length, 2);
  assert.deepEqual(result.data.showcase, models);
  assert.equal(result.data.entry, home);
});

test('loadRoute: a showcase failure yields an empty showcase and the home view', async () => {
  const home = entry('page', { slug: 'home', sections: [] }, 'p-home');
  const cda = fakeCda({ page: { home }, currentVehiclesError: new Error('CDA outage') });
  const result = await loadRoute(matchRoute('#/'), cda);
  assert.equal(result.view, 'home');
  assert.deepEqual(result.data.showcase, []);
  assert.equal(result.data.entry, home);
});

test('loadRoute: ignore does nothing and fetches nothing', async () => {
  const cda = fakeCda({});
  const result = await loadRoute(matchRoute('#main'), cda);
  assert.equal(result.view, 'ignore');
  assert.deepEqual(cda.calls, []);
});

test('loadRoute: placeholder resolves the vehicle for configure only', async () => {
  const gts = entry('vehicle', { slug: 'gts', name: 'GTS' }, 'v-gts');
  const cda = fakeCda({ vehicle: { gts } });

  const configure = await loadRoute(matchRoute('#/configure/gts'), cda);
  assert.equal(configure.view, 'placeholder');
  assert.equal(configure.data.vehicle, gts);
  assert.equal(configure.data.route.params.kind, 'configure');
  assert.deepEqual(cda.includes[0], ['vehicle', 'gts', 1]);

  const unknown = await loadRoute(matchRoute('#/configure/unknown'), cda);
  assert.equal(unknown.view, 'placeholder');
  assert.equal(unknown.data.vehicle, null);

  const before = cda.calls.length;
  for (const hash of ['#/contact', '#/legal/privacy', '#/placeholder/gts', '#/nova-6gt']) {
    const result = await loadRoute(matchRoute(hash), cda);
    assert.equal(result.view, 'placeholder', hash);
    assert.equal(result.data.vehicle, null, hash);
  }
  assert.equal(cda.calls.length, before, 'no fetches for kinds without a vehicle');
});

test('matchRoute: enquire is a real route, configure stays a placeholder', () => {
  assert.deepEqual(matchRoute('#/enquire'), { name: 'enquire', params: { slug: null }, lang: 'en' });
  assert.deepEqual(matchRoute('#/enquire/750s'), { name: 'enquire', params: { slug: '750s' }, lang: 'en' });
  assert.equal(matchRoute('#/enquire/a/b').name, 'notFound');
  assert.equal(matchRoute('#/configure/750s').name, 'placeholder');
});

test('loadRoute: enquire loads form, vehicle and current vehicles; falls back to placeholder without a form', async () => {
  const form = entry('enquiryForm', { title: 'Enquire' });
  const car = entry('vehicle', { slug: '750s', name: '750S' });
  const cda = {
    getEnquiryForm: async () => form,
    getBySlug: async (type, slug) => (slug === '750s' ? car : null),
    getCurrentVehicles: async () => [car],
  };
  const ok = await loadRoute({ name: 'enquire', params: { slug: '750s' } }, cda);
  assert.equal(ok.view, 'enquire');
  assert.deepEqual([ok.data.form, ok.data.vehicle, ok.data.vehicles], [form, car, [car]]);
  const unknown = await loadRoute({ name: 'enquire', params: { slug: 'nope' } }, cda);
  assert.equal(unknown.data.vehicle, null);
  const noForm = await loadRoute({ name: 'enquire', params: { slug: '750s' } }, { ...cda, getEnquiryForm: async () => null });
  assert.equal(noForm.view, 'placeholder');
  assert.equal(noForm.data.route.params.kind, 'enquire');
  assert.equal(noForm.data.vehicle, car);
});

test('loadRoute: enquire tolerates rejected calls and skips the vehicle lookup without a slug', async () => {
  const form = entry('enquiryForm', { title: 'Enquire' });
  const boom = async () => {
    throw new Error('down');
  };
  const bySlugCalls = [];
  const cda = {
    getEnquiryForm: async () => form,
    getBySlug: async (...args) => {
      bySlugCalls.push(args);
      return null;
    },
    getCurrentVehicles: boom,
  };
  const noSlug = await loadRoute({ name: 'enquire', params: { slug: null } }, cda);
  assert.equal(noSlug.view, 'enquire');
  assert.deepEqual([noSlug.data.vehicle, noSlug.data.vehicles], [null, []]);
  assert.deepEqual(bySlugCalls, []);
  const degraded = await loadRoute({ name: 'enquire', params: { slug: '750s' } }, { ...cda, getEnquiryForm: boom, getBySlug: boom });
  assert.equal(degraded.view, 'placeholder');
  assert.deepEqual(degraded.data.route.params, { kind: 'enquire', slug: '750s', path: 'enquire/750s' });
  assert.equal(degraded.data.vehicle, null);
});

test('loadRoute: categories load with include depth 3 so featuredBanner.cta.target resolves', async () => {
  const supercars = entry('vehicleCategory', { slug: 'supercars' }, 'cat-supercars');
  const cda = fakeCda({ vehicleCategory: { supercars } });
  await loadRoute(matchRoute('#/current-models/supercars'), cda);
  assert.deepEqual(cda.includes[0], ['vehicleCategory', 'supercars', 3]);
});

test('every seeded internal href resolves to a real route or a placeholder', async () => {
  const { SEED_GROUPS } = await import('../src/seed/index.js');
  const entries = SEED_GROUPS.flatMap((group) => group.entries);
  const slugs = (type) => new Set(entries.filter((e) => e.contentType === type).map((e) => e.fields.slug));
  const known = {
    page: new Set([...slugs('page'), ...slugs('vehicle')]),
    story: slugs('story'),
    category: slugs('vehicleCategory'),
  };
  let checked = 0;
  const walk = (value, where) => {
    if (typeof value === 'string' && value.startsWith('#/')) {
      checked += 1;
      const route = matchRoute(value);
      assert.notEqual(route.name, 'notFound', `${where}: ${value}`);
      if (known[route.name]) assert.ok(known[route.name].has(route.params.slug), `${where}: ${value} is not a seeded ${route.name}`);
    } else if (Array.isArray(value)) value.forEach((v, i) => walk(v, `${where}[${i}]`));
    else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) walk(v, `${where}.${k}`);
  };
  for (const entry of entries) walk(entry.fields, entry.id);
  assert.ok(checked > 20, `expected to check many seeded hrefs, got ${checked}`);
});

test('the footer lists "Follow us" once: social links come from socialLinks, not a footer group', async () => {
  const { SEED_GROUPS } = await import('../src/seed/index.js');
  const entries = SEED_GROUPS.flatMap((group) => group.entries);
  const site = entries.find((e) => e.contentType === 'siteSettings');
  assert.ok(site.links.socialLinks.length > 0);
  assert.ok(!site.links.footerGroups.includes('group-footer-follow'));
  assert.ok(!entries.some((e) => e.id === 'group-footer-follow'));
  const headings = entries.filter((e) => e.id?.startsWith('group-footer-')).map((e) => e.fields.heading);
  assert.ok(!headings.includes('Follow us'));
  // every footer group reference still resolves to a seeded entry
  for (const id of site.links.footerGroups) assert.ok(entries.some((e) => e.id === id), id);
});

test('matchRoute carries lang and strips the ja prefix', () => {
  assert.deepEqual(matchRoute('#/750s'), { name: 'page', params: { slug: '750s' }, lang: 'en' });
  assert.deepEqual(matchRoute('#/ja/750s'), { name: 'page', params: { slug: '750s' }, lang: 'ja' });
  for (const hash of ['#/ja', '#/ja/', '#/JA/', '#/ja/home']) assert.deepEqual(matchRoute(hash), { name: 'home', params: {}, lang: 'ja' }, hash);
  assert.deepEqual(matchRoute('#/JA/750s/'), { name: 'page', params: { slug: '750s' }, lang: 'ja' });
  assert.deepEqual(matchRoute('#/ja/current-models'), { name: 'redirect', params: { to: '#/ja/current-models/supercars' }, lang: 'ja' });
  assert.deepEqual(matchRoute('#/ja/enquire/gts'), { name: 'enquire', params: { slug: 'gts' }, lang: 'ja' });
  assert.deepEqual(matchRoute('#/ja/post/w1-designed-by-air'), { name: 'story', params: { slug: 'w1-designed-by-air' }, lang: 'ja' });
  assert.equal(matchRoute('#/en/750s').name, 'page');
  assert.equal(matchRoute('#main').lang, 'en');
});

test('withLang and hashForLang', () => {
  assert.equal(withLang('#/', 'ja'), '#/ja');
  assert.equal(withLang('#/750s', 'ja'), '#/ja/750s');
  assert.equal(withLang('#/750s', 'en'), '#/750s');
  assert.equal(withLang('https://example.com/#/x', 'ja'), 'https://example.com/#/x');
  assert.equal(withLang('#/ja/750s', 'ja'), '#/ja/750s');
  assert.equal(withLang('#/ja', 'ja'), '#/ja');
  assert.equal(withLang('#/jaguar', 'ja'), '#/ja/jaguar');
  assert.equal(hashForLang('#/ja/enquire/750s', 'en'), '#/enquire/750s');
  assert.equal(hashForLang('#/enquire/750s', 'ja'), '#/ja/enquire/750s');
  assert.equal(hashForLang('#/ja', 'en'), '#/');
  assert.equal(hashForLang('#/ja/750s', 'ja'), '#/ja/750s');
  assert.equal(hashForLang('', 'ja'), '#/ja');
});

test('routeFor and linkHref prefix hash routes for ja', () => {
  assert.equal(routeFor(entry('vehicle', { slug: '750s' }), 'ja'), '#/ja/750s');
  assert.equal(routeFor(entry('page', { slug: 'home' }), 'ja'), '#/ja');
  assert.equal(routeFor(entry('vehicleCategory', { slug: 'supercars' }), 'ja'), '#/ja/current-models/supercars');
  assert.equal(linkHref(entry('link', { externalUrl: '#/retailers' }), 'ja'), '#/ja/retailers');
  assert.equal(linkHref(entry('link', { externalUrl: 'https://example.com' }), 'ja'), 'https://example.com');
  assert.equal(linkHref(entry('link', { target: entry('story', { slug: 's' }) }), 'ja'), '#/ja/post/s');
  assert.equal(linkHref(entry('link', { externalUrl: '#/retailers' })), '#/retailers');
  assert.equal(linkHref(entry('link', { externalUrl: '#/ja/retailers' }), 'ja'), '#/ja/retailers');
});

test('loadRoute: home, modular pages, stories and vehicles load at include depth 6', async () => {
  const cda = fakeCda({
    page: { home: entry('page', { slug: 'home' }, 'p-home'), legacy: entry('page', { slug: 'legacy' }, 'p-legacy') },
    vehicle: { '750s': entry('vehicle', { slug: '750s' }, 'v-750s') },
    story: { 'five-facts': entry('story', { slug: 'five-facts' }, 's-1') },
  });
  for (const hash of ['#/', '#/750s', '#/legacy', '#/post/five-facts']) await loadRoute(matchRoute(hash), cda);
  assert.equal(CONTENT_INCLUDE, 6);
  assert.deepEqual(cda.includes, [
    ['page', 'home', 6],
    ['vehicle', '750s', 6],
    ['vehicle', 'legacy', 6],
    ['page', 'legacy', 6],
    ['story', 'five-facts', 6],
  ]);
});

test('loadRoute fetches the latest stories for a storyGrid nested in a personalized section', async () => {
  const grid = () => entry('storyGrid', { stories: [] });
  const textBlock = entry('richTextSection', {});
  const inDefault = entry('personalizedContent', { default: grid(), variants: [] }, 'pc-default');
  const inVariant = entry(
    'personalizedContent',
    { default: textBlock, variants: [entry('contentVariant', { audience: entry('audience', { key: 'uk' }), content: grid() })] },
    'pc-variant',
  );
  const withoutGrid = entry('personalizedContent', { default: textBlock, variants: [entry('contentVariant', { content: textBlock })] }, 'pc-none');
  const latest = [entry('story', { slug: 'latest' })];
  const load = async (sections) => {
    const cda = fakeCda({ page: { home: entry('page', { slug: 'home', sections }, 'p-home') }, stories: latest });
    const result = await loadRoute(matchRoute('#/'), cda);
    return { result, fetched: cda.calls.some((call) => call[0] === 'getStories') };
  };

  const a = await load([inDefault]);
  assert.equal(a.fetched, true, 'a grid in the default');
  assert.deepEqual(a.result.data.latestStories, latest);
  assert.equal((await load([inVariant])).fetched, true, 'a grid in a variant');
  assert.equal((await load([withoutGrid])).fetched, false, 'no grid anywhere');
});
