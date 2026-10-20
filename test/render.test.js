import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { html, raw, escapeHtml } from '../site/js/dom.js';
import { renderRichText } from '../site/js/richtext.js';
import { routeFor, linkHref } from '../site/js/router.js';
import { assetUrl } from '../site/js/cda.js';
import { renderBreadcrumbs } from '../site/js/shell.js';
import { registry } from '../site/js/render/index.js';

const load = (name) => JSON.parse(readFileSync(new URL(`./fixtures/render-${name}.json`, import.meta.url), 'utf8'));
const site = load('site');
const vehicles = load('vehicle');
const categoryData = load('category');
const pageData = load('page');
const homeData = load('home');
const hubData = load('hub');
const storyData = load('story');
const retailersData = load('retailers');

/** Builds a render context from the real modules with a recording setHead. */
function makeCtx(overrides = {}) {
  const heads = [];
  const ctx = {
    siteSettings: site.siteSettings,
    categories: site.categories,
    cda: {},
    routeFor,
    linkHref,
    renderRichText,
    html,
    raw,
    escapeHtml,
    assetUrl,
    renderBreadcrumbs,
    setHead: (head) => heads.push(head),
    route: { name: 'test', params: {} },
    ...overrides,
  };
  return { ctx, heads };
}

const BAD = /undefined|\[object Object\]|\bnull\b|\bNaN\b/;

function renderView(key, data, overrides) {
  const { ctx, heads } = makeCtx(overrides);
  const out = String(registry[key](data, ctx));
  assert.doesNotMatch(out, BAD, `${key} output must not leak undefined, null, [object Object] or NaN`);
  return { out, heads, ctx };
}

const clone = (value) => JSON.parse(JSON.stringify(value));

test('registry exposes every view and section key', () => {
  for (const key of [
    'vehicle', 'vehicleCategory', 'page', 'home', 'story', 'retailers', 'notFound',
    'textBlock', 'imageBlock', 'bannerButton', 'cardGrid', 'vehicleGrid', 'storyGrid', 'ctaGroup',
  ]) {
    assert.equal(typeof registry[key], 'function', key);
  }
});

// ---------------------------------------------------------------------------
// vehicle
// ---------------------------------------------------------------------------

test('vehicle: hero, sub-nav, statement and head', () => {
  const { out, heads } = renderView('vehicle', { entry: vehicles.full, variants: vehicles.variants });
  assert.match(out, /<h1[^>]*>750S<\/h1>/);
  assert.match(out, /<span class="eyebrow">Supercars<\/span>/);
  assert.match(out, /Less mass, more intent/);
  const heroImg = out.match(/<img[^>]*hero__image[^>]*>/)[0];
  assert.match(heroImg, /w=1920/);
  assert.match(heroImg, /alt="750S hero artwork"/);
  assert.match(heroImg, /width="1600" height="900"|width="1920" height="1080"/);
  assert.doesNotMatch(heroImg, /loading="lazy"/);
  // sub-nav
  assert.match(out, /<nav class="subnav subnav--product"/);
  assert.match(out, /href="#\/configure\/750s"[^>]*>Configure</);
  assert.match(out, /href="#\/enquire\/750s"[^>]*>Enquire</);
  assert.match(out, /Change model variant/);
  assert.match(out, /<details class="subnav__menu"[^>]*>\s*<summary class="subnav__summary">Downloads/);
  assert.match(out, /750S brochure/);
  // statement
  assert.match(out, /remove everything the car does not need/);
  assert.match(out, /Watch the film/);
  assert.match(out, /href="https:\/\/example.com\/films\/750s"/);
  assert.deepEqual(heads, [{ title: '750S | McLaren supercar', description: 'The McLaren 750S.' }]);
});

test('vehicle: breadcrumbs for a current model', () => {
  const { out } = renderView('vehicle', { entry: vehicles.full, variants: [] });
  assert.match(out, /aria-label="Breadcrumb"/);
  assert.match(out, /<a href="#\/">Home<\/a>/);
  assert.match(out, /<a href="#\/current-models\/supercars">Current models<\/a>/);
  assert.match(out, /<a href="#\/current-models\/supercars">Supercars<\/a>/);
  assert.match(out, /<li class="breadcrumbs__item" aria-current="page">750S<\/li>/);
});

test('vehicle: variant switch lists parent and variants with the current one marked', () => {
  const parentView = renderView('vehicle', { entry: vehicles.full, variants: vehicles.variants }).out;
  const menu = parentView.match(/Change model variant[\s\S]*?<\/ul>/)[0];
  assert.match(menu, /<a href="#\/750s" aria-current="page">750S/);
  assert.match(menu, /<a href="#\/750s-spider">750S Spider<\/a>/);

  const childMenu = renderView('vehicle', { entry: vehicles.spider, variants: [] }).out.match(/Change model variant[\s\S]*?<\/ul>/)[0];
  assert.ok(childMenu.indexOf('#/750s"') < childMenu.indexOf('#/750s-spider"'), 'parent listed first');
  assert.match(childMenu, /<a href="#\/750s-spider" aria-current="page">750S Spider/);
});

test('vehicle: overview carousel has slides and prev/next buttons', () => {
  const { out } = renderView('vehicle', { entry: vehicles.full, variants: [] });
  assert.match(out, /class="carousel__track"/);
  assert.equal((out.match(/class="carousel__slide"/g) || []).length, 2);
  assert.match(out, /Slide heading 1/);
  assert.match(out, /aria-label="Previous slide"/);
  assert.match(out, /aria-label="Next slide"/);
});

test('vehicle: exterior and interior tabs are radio driven and list highlights by area', () => {
  const { out } = renderView('vehicle', { entry: vehicles.full, variants: [] });
  assert.match(out, /<input class="tabs__radio" type="radio" name="detail-area" id="detail-tab-exterior" checked>/);
  assert.match(out, /<input class="tabs__radio" type="radio" name="detail-area" id="detail-tab-interior">/);
  assert.match(out, /<label class="tabs__tab tabs__tab--exterior" for="detail-tab-exterior">Exterior<\/label>/);
  const exterior = out.match(/tabs__panel--exterior[\s\S]*?<\/ul>\s*<\/div>/)[0];
  const interior = out.match(/tabs__panel--interior[\s\S]*?<\/ul>\s*<\/div>/)[0];
  assert.match(exterior, /Carved by air/);
  assert.match(exterior, /Dihedral doors/);
  assert.match(exterior, /Active rear wing/);
  assert.doesNotMatch(exterior, /Focus on the drive/);
  assert.match(interior, /Focus on the drive/);
});

test('vehicle: featured specs become tiles in array order and the table is grouped', () => {
  const { out } = renderView('vehicle', { entry: vehicles.full, variants: [] });
  const tiles = out.match(/<ul class="spec-tiles">[\s\S]*?<\/ul>/)[0];
  assert.equal((tiles.match(/class="spec-tile"/g) || []).length, 3);
  assert.ok(tiles.indexOf('332') < tiles.indexOf('800') && tiles.indexOf('800') < tiles.indexOf('750'));
  assert.match(tiles, /<small class="spec-tile__unit">km\/h<\/small>/);
  assert.match(tiles, /Top speed/);
  assert.match(out, /<summary class="spec-full__summary">Full specifications<\/summary>/);
  const table = out.match(/<table class="spec-table">[\s\S]*?<\/table>/)[0];
  for (const group of ['Performance', 'Powertrain', 'Dimensions', 'Weight']) {
    assert.match(table, new RegExp(`colspan="2">${group}<`));
  }
  assert.ok(table.indexOf('Performance') < table.indexOf('Powertrain') && table.indexOf('Powertrain') < table.indexOf('Dimensions'));
  assert.match(table, /<th scope="row">Engine<\/th><td>4.0L twin-turbo V8<\/td>/);
  assert.match(out, /750 PS, 332 km\/h/);
  assert.match(out, /Revised turbochargers/);
});

test('vehicle: MSO banner, lineage, related stories and FAQs', () => {
  const { out } = renderView('vehicle', { entry: vehicles.full, variants: [] });
  assert.match(out, /Make it yours/);
  assert.match(out, /href="https:\/\/example.com\/mso"[^>]*>Customise with MSO</);
  const timeline = out.match(/<ol class="timeline">[\s\S]*?<\/ol>/)[0];
  assert.equal((timeline.match(/class="timeline__item"/g) || []).length, 3);
  assert.match(timeline, /timeline__year">2020</);
  assert.match(timeline, /765LT/);
  assert.match(timeline, /href="#\/765lt"/);
  assert.match(timeline, /href="#\/f1"/);
  assert.equal((timeline.match(/btn-text/g) || []).length, 2, 'only entries with a vehicle link out');
  assert.match(out, /The 750S continues the Super Series/);
  assert.match(out, /Related stories/);
  assert.match(out, /href="#\/post\/750s-five-key-facts"/);
  assert.match(out, /href="#\/post\/w1-designed-by-air"/);
  assert.match(out, /<details class="faq">\s*<summary class="faq__question">Is it a hybrid\?<\/summary>/);
  assert.match(out, /<strong>pure V8<\/strong>/);
});

test('vehicle: legacy vehicles render only the sections they have', () => {
  const { out, heads } = renderView('vehicle', { entry: vehicles.legacy, variants: [] });
  assert.match(out, /<a href="#\/legacy">Legacy<\/a>/);
  assert.doesNotMatch(out, /Current models/);
  assert.match(out, /<h1[^>]*>720S<\/h1>/);
  assert.match(out, /The 720S introduced the monocage II tub/);
  assert.equal((out.match(/class="spec-tile"/g) || []).length, 3);
  for (const absent of ['carousel', 'in-detail', 'timeline', 'faq-list', 'Related stories', 'Configure', 'Enquire', 'subnav__menu', 'Watch the film']) {
    assert.doesNotMatch(out, new RegExp(absent), `legacy page should not contain ${absent}`);
  }
  assert.deepEqual(heads, [{ title: '720S', description: 'The 2017 Super Series coupe.' }]);
});

test('vehicle: tolerates an entry with almost no fields', () => {
  const bare = { sys: { id: 'x', type: 'Entry', contentType: { sys: { id: 'vehicle' } } }, fields: { name: 'Bare', slug: 'bare', status: 'current' } };
  const { out } = renderView('vehicle', { entry: bare, variants: [] });
  assert.match(out, /<h1[^>]*>Bare<\/h1>/);
});

// ---------------------------------------------------------------------------
// category
// ---------------------------------------------------------------------------

test('category: tabs, header, product cards, banner and journey group', () => {
  const { out, heads } = renderView('vehicleCategory', categoryData);
  const tabs = out.match(/<nav class="category-tabs"[\s\S]*?<\/nav>/)[0];
  assert.match(tabs, /href="#\/current-models\/supercars" aria-current="page">Supercars</);
  assert.match(tabs, /href="#\/current-models\/grand-tourer">Grand Tourers</);
  assert.equal((tabs.match(/aria-current="page"/g) || []).length, 1);
  assert.match(out, /<span class="eyebrow">Current models<\/span>/);
  assert.match(out, /<h1>Supercars<\/h1>/);
  assert.match(out, /Carbon structure\. Twin-turbo power\./);
  assert.match(out, /Built to be driven\./);
  // legacy vehicles are not listed on the current models page
  assert.equal((out.match(/class="card product-card"/g) || []).length, 2);
  assert.doesNotMatch(out, /720S/);
  assert.match(out, /href="#\/artura"/);
  assert.match(out, /href="#\/enquire\/artura"[^>]*>Enquire</);
  assert.match(out, /href="#\/configure\/750s"[^>]*>Configure</);
  assert.match(out, /A lightweight V8 supercar\./);
  assert.match(out, /McL 6GT/);
  assert.match(out, /Continue your journey/);
  assert.match(out, /href="#\/mso"/);
  assert.match(out, /href="#\/retailers"/);
  assert.match(out, /href="#\/post\/artura-spider-performance"/, 'first related story is linked');
  assert.match(out, /<a href="#\/current-models\/supercars">Current models<\/a>/);
  assert.match(out, /aria-current="page">Supercars<\/li>/);
  assert.deepEqual(heads, [{ title: 'Supercars', description: 'Carbon structure. Twin-turbo power. Built to be driven.' }]);
});

test('category: omits the story link when no vehicle has stories and handles no vehicles', () => {
  const noStories = clone(categoryData);
  for (const vehicle of noStories.vehicles) delete vehicle.fields.relatedStories;
  const withVehicles = renderView('vehicleCategory', noStories).out;
  assert.doesNotMatch(withVehicles, /Read the latest story/);
  const empty = renderView('vehicleCategory', { entry: categoryData.entry, vehicles: [] }).out;
  assert.match(empty, /No models are listed/);
});

// ---------------------------------------------------------------------------
// page and home
// ---------------------------------------------------------------------------

test('page: full hero, kicker, breadcrumbs from the parent chain and head', () => {
  const { out, heads } = renderView('page', pageData);
  assert.match(out, /class="hero hero--full hero--page/);
  assert.match(out, /<span class="eyebrow">McLaren ownership<\/span>/);
  assert.match(out, /<h1[^>]*>Ownership: roadside assistance<\/h1>/);
  assert.match(out, /<a href="#\/ownership">Ownership<\/a>/);
  assert.match(out, /aria-current="page">Ownership: roadside assistance<\/li>/);
  assert.deepEqual(heads, [{ title: 'Roadside assistance', description: 'Contacts for owners.' }]);
});

test('page: compact hero when heroStyle is not full', () => {
  const data = clone(pageData);
  delete data.entry.fields.heroStyle;
  assert.match(renderView('page', data).out, /class="hero hero--compact hero--page/);
});

test('page: sibling sub-navigation lists the parent first, siblings by order, current marked', () => {
  const { out } = renderView('page', pageData);
  const nav = out.match(/<nav class="subnav subnav--page"[\s\S]*?<\/nav>/)[0];
  const hrefs = [...nav.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(hrefs, ['#/ownership', '#/ownership/roadside-assistance', '#/ownership/service']);
  assert.match(nav, /href="#\/ownership\/roadside-assistance" aria-current="page"/);
  assert.equal((nav.match(/aria-current="page"/g) || []).length, 1);
});

test('page: a parent page lists itself first and then its children', () => {
  const { out } = renderView('page', hubData);
  const nav = out.match(/<nav class="subnav subnav--page"[\s\S]*?<\/nav>/)[0];
  const hrefs = [...nav.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(hrefs, ['#/legacy', '#/legacy/2010s', '#/legacy/1990s']);
  assert.match(nav, /href="#\/legacy" aria-current="page"/);
  assert.match(nav, />The 2010s</);
});

test('page: no sub-navigation without parent, siblings or children', () => {
  assert.doesNotMatch(renderView('page', { ...hubData, children: [] }).out, /subnav/);
});

test('page: renders every section type in order and skips unknown types', () => {
  const { out } = renderView('page', pageData);
  const markers = [
    'Always on call', // textBlock header
    'text-block__title">Contacts', // textBlock text
    'image-block--full', // imageBlock full
    'image-block--contained', // imageBlock contained
    'banner--image', // bannerButton with image
    'banner--split', // bannerButton on a light theme
    'Experiences', // cardGrid
    'Winter Ball',
    'class="section vehicle-grid', // vehicleGrid
    'Curated stories', // storyGrid curated
    'Latest stories', // storyGrid fallback
    'cta-group__title">Continue your journey', // ctaGroup
  ];
  let last = -1;
  for (const marker of markers) {
    const at = out.indexOf(marker);
    assert.ok(at > last, `${marker} should appear after the previous section`);
    last = at;
  }
  assert.doesNotMatch(out, /Should not render/);
});

test('sections: text blocks, image blocks and banners carry their content', () => {
  const { out } = renderView('page', pageData);
  assert.match(out, /text-block--header theme-white/);
  assert.match(out, /<div class="text-block__lead lead richtext"><p>Help is a call away\.<\/p><\/div>/);
  assert.match(out, /text-block theme-mist/);
  assert.match(out, /<em>the team<\/em>/);
  assert.match(out, /<figcaption class="image-block__caption">A caption<\/figcaption>/);
  assert.match(out, /alt="Inline artwork"/);
  assert.match(out, /alt="Inline two"/, 'alt falls back to the asset title');
  assert.match(out, /theme-carbon[^>]*>\s*<div class="banner__media">/);
  assert.match(out, /href="https:\/\/example.com\/mso"[^>]*target="_blank"[^>]*>Learn more</);
  assert.match(out, /<span class="eyebrow">MSO<\/span>/);
});

test('sections: card grid, vehicle grid and cta group', () => {
  const { out } = renderView('page', pageData);
  assert.match(out, /grid-cards grid-cards--two/);
  assert.match(out, /href="https:\/\/example.com\/ball"[^>]*>Discover</);
  assert.match(out, /href="#\/ownership"[^>]*>Register interest</, 'internal link target resolved through routeFor');
  const grid = out.match(/class="section vehicle-grid[\s\S]*?<\/section>/)[0];
  assert.match(grid, /href="#\/750s"/);
  assert.match(grid, /href="#\/720s"/);
  const cta = out.match(/class="section cta-group[\s\S]*?<\/section>/)[0];
  assert.match(cta, /btn btn-primary" href="#\/retailers">Retailers</);
  assert.match(cta, /href="#\/current-models\/supercars">Models</);
});

test('sections: storyGrid uses curated stories, else falls back to latestStories', () => {
  const { out } = renderView('page', pageData);
  const curated = out.match(/Curated stories[\s\S]*?<\/section>/)[0];
  assert.match(curated, /750S: five key facts/);
  assert.doesNotMatch(curated, /W1: designed by air/);
  const latest = out.match(/Latest stories[\s\S]*?<\/section>/)[0];
  assert.match(latest, /W1: designed by air/);
  assert.match(latest, /Artura Spider performance/);
  assert.match(latest, /<time datetime="2026-05-01">1 May 2026<\/time>/);
  // with no latestStories the fallback grid renders nothing
  const none = renderView('page', { ...clone(pageData), latestStories: [] }).out;
  assert.doesNotMatch(none, /Latest stories/);
});

test('sections: section renderers can be called directly with a ctx extra', () => {
  const { ctx } = makeCtx({ latestStories: [storyData.latestStories[1]] });
  const grid = pageData.entry.fields.sections.find((section) => section.sys.id === 'stories-latest');
  const out = String(registry.storyGrid(grid, ctx));
  assert.match(out, /W1: designed by air/);
});

test('home: no breadcrumbs, site name in hero and head', () => {
  const { out, heads } = renderView('home', homeData);
  assert.doesNotMatch(out, /breadcrumbs/);
  assert.match(out, /<h1[^>]*>McLaren<\/h1>/);
  assert.match(out, /Engineered around the driver/);
  assert.deepEqual(heads, [{ title: 'McLaren', description: 'Supercars engineered around the driver.' }]);
});

// ---------------------------------------------------------------------------
// story
// ---------------------------------------------------------------------------

test('story: hero, standfirst, sections, related vehicles and more stories', () => {
  const { out, heads } = renderView('story', storyData);
  assert.match(out, /class="hero hero--compact hero--story/);
  assert.match(out, /<span class="eyebrow">Engineering · <time datetime="2026-02-12">12 February 2026<\/time><\/span>/);
  assert.match(out, /<h1[^>]*>750S: five key facts<\/h1>/);
  assert.match(out, /<div class="lead"><p>Standfirst for 750S: five key facts\.<\/p><\/div>/);
  assert.match(out, /The story opens here\./);
  assert.match(out, /Inline caption/);
  assert.match(out, /href="#\/750s"[^>]*>See the 750S</);
  assert.match(out, /Related models/);
  assert.match(out, /href="#\/750s-spider"/);
  const more = out.match(/More stories[\s\S]*?<\/section>/)[0];
  assert.doesNotMatch(more, /750S: five key facts/, 'the story itself is excluded');
  assert.match(more, /W1: designed by air/);
  assert.match(more, /Artura Spider performance/);
  assert.match(out, /<a href="#\/">Home<\/a>[\s\S]*>Stories<[\s\S]*aria-current="page">750S: five key facts<\/li>/);
  assert.match(out, /aria-current="page">750S: five key facts<\/li>/);
  assert.deepEqual(heads, [{ title: '750S: five key facts', description: 'Standfirst for 750S: five key facts.' }]);
});

test('story: omits More stories when there are none', () => {
  const { out } = renderView('story', { entry: storyData.entry, latestStories: [storyData.entry] });
  assert.doesNotMatch(out, /More stories/);
});

// ---------------------------------------------------------------------------
// retailers and notFound
// ---------------------------------------------------------------------------

test('retailers: grouped by country with address, phone, website and map link', () => {
  const { out, heads } = renderView('retailers', retailersData);
  const countries = [...out.matchAll(/<h2 class="retailers__heading">([^<]+)<\/h2>/g)].map((match) => match[1]);
  assert.deepEqual(countries, ['France', 'United Kingdom']);
  const uk = out.match(/United Kingdom[\s\S]*$/)[0];
  assert.equal((uk.match(/class="retailer"/g) || []).length, 2);
  assert.match(out, /<address class="retailer__address">14 Hanover Mews<br>Mayfair<br>London W1S 1AA<\/address>/);
  assert.match(out, /<a href="tel:\+442000000101">\+44 20 0000 0101<\/a>/);
  assert.match(out, /<a href="https:\/\/example.com\/r-london"[^>]*>Website<\/a>/);
  assert.match(
    out,
    /href="https:\/\/www.openstreetmap.org\/\?mlat=51.5072&amp;mlon=-0.1276#map=14\/51.5072\/-0.1276"[^>]*>View on map</,
  );
  assert.match(out, /<h3 class="retailer__name">McLaren Paris<\/h3>/);
  assert.deepEqual(heads, [{ title: 'Find a retailer', description: 'Find a McLaren retailer near you.' }]);
});

test('retailers: skips the map link without a location', () => {
  const data = clone(retailersData);
  for (const retailer of data.retailers) delete retailer.fields.location;
  assert.doesNotMatch(renderView('retailers', data).out, /View on map/);
});

test('notFound: friendly message with links home and to supercars', () => {
  const { out, heads } = renderView('notFound', { route: { name: 'page', params: { slug: 'nope' } } });
  assert.match(out, /404/);
  assert.match(out, /<code>\/nope<\/code>/);
  assert.match(out, /href="#\/"[^>]*>Back to home</);
  assert.match(out, /href="#\/current-models\/supercars"/);
  assert.equal(heads[0].title, 'Page not found');
  assert.doesNotMatch(String(registry.notFound({}, makeCtx().ctx)), BAD);
});

// ---------------------------------------------------------------------------
// safety
// ---------------------------------------------------------------------------

test('text fields are escaped: a <script> in content never reaches the output', () => {
  const evil = '<script>alert(1)</script>';
  const vehicle = clone(vehicles.full);
  for (const key of ['name', 'tagline', 'statement', 'shortDescription', 'performanceHeading', 'performanceBody', 'lineageIntro']) {
    vehicle.fields[key] = evil;
  }
  vehicle.fields.highlights[0].fields.title = evil;
  vehicle.fields.specifications[0].fields.value = evil;
  vehicle.fields.lineage[0].fields.title = evil;
  vehicle.fields.faqs[0].fields.question = evil;
  vehicle.fields.configureUrl = 'javascript:alert(1)';
  const { out, heads } = renderView('vehicle', { entry: vehicle, variants: [] });
  assert.doesNotMatch(out, /<script/i);
  assert.match(out, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(out, /javascript:/i);
  assert.ok(String(heads[0].title).length > 0);

  const page = clone(pageData);
  page.entry.fields.title = evil;
  page.entry.fields.kicker = evil;
  page.entry.fields.sections[0].fields.heading = evil;
  page.entry.fields.sections[6].fields.cards[0].fields.title = evil;
  const pageOut = renderView('page', page).out;
  assert.doesNotMatch(pageOut, /<script/i);

  const story = clone(storyData);
  story.entry.fields.title = evil;
  story.entry.fields.standfirst = evil;
  assert.doesNotMatch(renderView('story', story).out, /<script/i);

  const retailers = clone(retailersData);
  retailers.retailers[0].fields.name = evil;
  retailers.retailers[0].fields.address = evil;
  retailers.retailers[0].fields.country = evil;
  assert.doesNotMatch(renderView('retailers', retailers).out, /<script/i);

  const category = clone(categoryData);
  category.entry.fields.name = evil;
  category.entry.fields.intro = evil;
  assert.doesNotMatch(renderView('vehicleCategory', category).out, /<script/i);
});

test('every template returns HTML that coerces to a string', () => {
  const { ctx } = makeCtx();
  const outputs = [
    registry.vehicle({ entry: vehicles.full, variants: vehicles.variants }, ctx),
    registry.vehicleCategory(categoryData, ctx),
    registry.page(pageData, ctx),
    registry.home(homeData, ctx),
    registry.story(storyData, ctx),
    registry.retailers(retailersData, ctx),
    registry.notFound({ route: { name: 'notFound', params: {} } }, ctx),
  ];
  for (const out of outputs) {
    assert.equal(typeof String(out), 'string');
    assert.ok(String(out).length > 200);
    assert.doesNotMatch(String(out), BAD);
  }
});
