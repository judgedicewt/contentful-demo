import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { html, raw, escapeHtml } from '../site/js/dom.js';
import { renderRichText } from '../site/js/richtext.js';
import { routeFor, linkHref } from '../site/js/router.js';
import { assetUrl } from '../site/js/cda.js';
import { renderBreadcrumbs, renderHeader, renderFooter } from '../site/js/shell.js';
import { registry } from '../site/js/render/index.js';
import { imageTag, imageSrc, imageSrcset, HERO_WIDTHS } from '../site/js/render/common.js';
import { sortShowcase } from '../site/js/render/home.js';

const load = (name) => JSON.parse(readFileSync(new URL(`./fixtures/render-${name}.json`, import.meta.url), 'utf8'));
const site = load('site');
const vehicles = load('vehicle');
const categoryData = load('category');
const pageData = load('page');
const homeData = load('home');
const hubData = load('hub');
const storyData = load('story');
const retailersData = load('retailers');
const enquireData = load('enquire');

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
    'vehicle', 'vehicleCategory', 'page', 'home', 'story', 'retailers', 'notFound', 'placeholder',
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
  assert.match(heroImg, /alt=""/, 'the h1 already names the car, so the hero image is decorative');
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

test('vehicle: hero image offers a srcset of HERO_WIDTHS at 100vw', () => {
  const { out } = renderView('vehicle', { entry: vehicles.full, variants: [] });
  const heroImg = out.match(/<img[^>]*hero__image[^>]*>/)[0];
  assert.match(heroImg, /srcset="[^"]*w=800&amp;[^"]* 800w, [^"]*w=1200&amp;[^"]* 1200w, [^"]*w=1600&amp;[^"]* 1600w, [^"]*w=1920&amp;[^"]* 1920w"/);
  assert.match(heroImg, /sizes="100vw"/);
  assert.match(heroImg, /src="[^"]*w=1920/);
});

test('imageSrcset skips SVG assets and imageTag then emits no srcset', () => {
  const { ctx } = makeCtx();
  const svg = { sys: { id: 'a' }, fields: { title: 'x', file: { url: 'https://images.ctfassets.net/s/a/b/c.svg', contentType: 'image/svg+xml' } } };
  assert.equal(imageSrcset(ctx, svg, HERO_WIDTHS), '');
  assert.doesNotMatch(String(imageTag(ctx, svg, { widths: HERO_WIDTHS })), /srcset=/);
  const jpg = vehicles.full.fields.heroImage;
  assert.equal(imageSrcset(ctx, jpg, [800, 1600]).split(', ').length, 2);
  assert.match(String(imageTag(ctx, jpg, { w: 1200, widths: [800, 1200], sizes: '50vw' })), /sizes="50vw"/);
});

test('vehicle: breadcrumbs for a current model', () => {
  const { out } = renderView('vehicle', { entry: vehicles.full, variants: [] });
  assert.match(out, /aria-label="Breadcrumb"/);
  assert.match(out, /<a href="#\/">Home<\/a>/);
  assert.match(out, /<a href="#\/current-models">Current models<\/a>/);
  assert.match(out, /<a href="#\/current-models\/supercars">Supercars<\/a>/);
  assert.doesNotMatch(out, /<a href="#\/current-models\/supercars">Current models<\/a>/);
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

  const familyMenu = renderView('vehicle', { entry: vehicles.spider, variants: vehicles.variants }).out.match(/Change model variant[\s\S]*?<\/ul>/)[0];
  assert.equal((familyMenu.match(/<a href=/g) || []).length, 2, 'the current entry is not listed twice');
  assert.ok(familyMenu.indexOf('#/750s"') < familyMenu.indexOf('#/750s-spider"'), 'root first');
  assert.match(familyMenu, /<a href="#\/750s-spider" aria-current="page">750S Spider/);
});

test('vehicle: overview carousel has slides and prev/next buttons', () => {
  const { out } = renderView('vehicle', { entry: vehicles.full, variants: [] });
  assert.match(out, /class="carousel__track"/);
  assert.equal((out.match(/class="carousel__slide"/g) || []).length, 2);
  assert.match(out, /Slide heading 1/);
  assert.match(out, /aria-label="Previous slide"/);
  assert.match(out, /aria-label="Next slide"/);
});

const imgSrcs = (markup) => [...String(markup).matchAll(/<img[^>]*src="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&'));

test('vehicle: overview slides use 16:9 crops that alternate focus left and right', () => {
  const { out } = renderView('vehicle', { entry: vehicles.full, variants: [] });
  const slides = [...out.matchAll(/<div class="carousel__media">[\s\S]*?<\/div>/g)].map((m) => imgSrcs(m[0])[0]);
  assert.equal(slides.length, 2);
  assert.match(slides[0], /[?&]f=left\b/);
  assert.match(slides[1], /[?&]f=right\b/);
  for (const src of slides) assert.match(src, /[?&]h=675\b/);
});

test('vehicle: highlight media is a 4:3 crop focused by area', () => {
  const { out } = renderView('vehicle', { entry: vehicles.full, variants: [] });
  const media = [...out.matchAll(/<li class="highlight"[^>]*>[\s\S]*?<\/li>/g)].map((m) => imgSrcs(m[0])[0]);
  assert.equal(media.length, 3);
  const areas = vehicles.full.fields.highlights.map((h) => h.fields.area);
  assert.deepEqual(areas, ['exterior', 'exterior', 'interior']);
  for (const [index, src] of media.entries()) {
    assert.match(src, /[?&]w=800\b/);
    assert.match(src, /[?&]h=600\b/);
    assert.match(src, areas[index] === 'exterior' ? /[?&]f=left\b/ : /[?&]f=right\b/);
  }
});

test('vehicle: lineage tiles keep a 3:4 crop focused left', () => {
  const { out } = renderView('vehicle', { entry: vehicles.full, variants: [] });
  const timeline = out.match(/<ol class="timeline">[\s\S]*?<\/ol>/)[0];
  const srcs = imgSrcs(timeline);
  assert.ok(srcs.length > 0);
  for (const src of srcs) {
    assert.match(src, /[?&]f=left\b/);
    assert.match(src, /[?&]w=600\b/);
    assert.match(src, /[?&]h=800\b/);
  }
});

test('vehicle carousel has no inline handlers', () => {
  const { out } = renderView('vehicle', { entry: vehicles.full, variants: [] });
  assert.doesNotMatch(out, /onclick=/i);
  assert.doesNotMatch(out, /\bon[a-z]+="/i, 'no inline event handler attributes at all');
  assert.match(out, /<button[^>]*data-carousel-prev[^>]*>/);
  assert.match(out, /<button[^>]*data-carousel-next[^>]*>/);
  const track = out.match(/<ul[^>]*data-carousel-track[^>]*>/)[0];
  assert.match(track, /class="carousel__track"/);
  assert.match(track, /tabindex="0"/);
});

test('vehicle hero and sections carry reveal marks', () => {
  const { out } = renderView('vehicle', { entry: vehicles.full, variants: [] });
  assert.match(out, /<section class="hero hero--full[^"]*"[^>]*data-hero/);
  assert.ok((out.match(/data-reveal/g) || []).length >= 3, 'at least three reveal marks');
  assert.match(out, /<h2 class="section__title"[^>]*data-reveal/, 'section headings reveal');
});

test('product bar carries data-compact-bar', () => {
  const { out } = renderView('vehicle', { entry: vehicles.full, variants: [] });
  assert.match(out, /<nav class="subnav subnav--product"[^>]*data-compact-bar/);
});

test('page: a full hero is a motion hero, a compact one is not', () => {
  const full = clone(pageData);
  full.entry.fields.heroStyle = 'full';
  assert.match(renderView('page', full).out, /hero--full[^"]*"[^>]*data-hero/);
  const compact = clone(pageData);
  compact.entry.fields.heroStyle = 'compact';
  assert.doesNotMatch(renderView('page', compact).out, /data-hero/);
});

test('cards, card grids and story sections carry reveal marks', () => {
  const stories = renderView('story', storyData).out;
  assert.ok((stories.match(/data-reveal/g) || []).length >= 2);
  const cat = renderView('vehicleCategory', categoryData).out;
  assert.match(cat, /<li data-reveal>/, 'card list items reveal');
});

test('vehicle: exterior and interior tabs are radio driven and list highlights by area', () => {
  const { out } = renderView('vehicle', { entry: vehicles.full, variants: [] });
  assert.match(out, /<input class="tabs__radio" type="radio" name="detail-area" id="detail-tab-exterior" checked>/);
  assert.match(out, /<input class="tabs__radio" type="radio" name="detail-area" id="detail-tab-interior">/);
  assert.match(out, /<label class="tabs__tab tabs__tab--exterior" for="detail-tab-exterior">Exterior<\/label>/);
  // radios and labels sit inside one labelled radiogroup
  const group = out.match(/<div class="tabs__group" role="radiogroup" aria-label="In detail">[\s\S]*?<\/label>\s*<\/div>\s*<\/div>/)[0];
  assert.match(group, /id="detail-tab-exterior"/);
  assert.match(group, /id="detail-tab-interior"/);
  assert.match(group, /for="detail-tab-interior"/);
  assert.doesNotMatch(group, /tabs__panel/);
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
  const tiles = out.match(/<ul class="spec-tiles"[^>]*>[\s\S]*?<\/ul>/)[0];
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
    'text-block__title" data-reveal>Contacts', // textBlock text
    'image-block--full', // imageBlock full
    'image-block--contained', // imageBlock contained
    'banner--image', // bannerButton with image
    'banner--split', // bannerButton on a light theme
    'Experiences', // cardGrid
    'Winter Ball',
    'class="section vehicle-grid', // vehicleGrid
    'Curated stories', // storyGrid curated
    'Latest stories', // storyGrid fallback
    'cta-group__title" data-reveal>Continue your journey', // ctaGroup
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

test('sections: a text block with an empty body omits the richtext wrapper', () => {
  const { ctx } = makeCtx();
  const empty = { nodeType: 'document', data: {}, content: [] };
  const block = (fields) => ({ sys: { id: 'tb', contentType: { sys: { id: 'textBlock' } } }, fields });
  const headingOnly = String(registry.textBlock(block({ heading: 'Only a heading', body: empty }), ctx));
  assert.match(headingOnly, /Only a heading/);
  assert.doesNotMatch(headingOnly, /richtext/);
  const header = String(registry.textBlock(block({ heading: 'Header', variant: 'header', body: empty }), ctx));
  assert.doesNotMatch(header, /richtext/);
  assert.equal(String(registry.textBlock(block({ body: empty }), ctx)), '');
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

test('home renders the showcase strip', () => {
  const { out } = renderView('home', homeData);
  assert.match(out, /class="section showcase/);
  assert.match(out, /data-carousel-track/);
  assert.match(out, /data-carousel-prev/);
  assert.match(out, /data-carousel-next/);
  assert.equal((out.match(/class="showcase__card/g) || []).length, 2);
  for (const vehicle of homeData.showcase) {
    assert.ok(out.includes(vehicle.fields.name), `showcase lists ${vehicle.fields.name}`);
    assert.ok(out.includes(`href="#/${vehicle.fields.slug}"`), `showcase links to ${vehicle.fields.slug}`);
  }
  assert.match(out, /Explore/);
});

test('home without showcase omits the strip', () => {
  for (const showcase of [[], undefined]) {
    const { out } = renderView('home', { ...homeData, showcase });
    assert.doesNotMatch(out, /showcase/);
    assert.doesNotMatch(out, /data-carousel-track/);
    assert.match(out, /hero--home/, 'the hero still renders');
  }
});

test('home hero uses the taller variant', () => {
  const { out } = renderView('home', homeData);
  assert.match(out, /class="hero hero--full hero--home theme-carbon"/);
  assert.match(out, /data-hero/);
  assert.match(out, /<h1[^>]*>McLaren<\/h1>/);
  assert.doesNotMatch(out, /hero__strapline/, 'the first text block heading is not repeated in the hero');
});

test('home showcase has an accessible name from its heading only', () => {
  const { out } = renderView('home', homeData);
  assert.match(out, /<section class="section showcase[^"]*"[^>]*aria-labelledby="showcase-title"/);
  assert.doesNotMatch(out, /<section class="section showcase[^"]*"[^>]*aria-label=/);
  assert.match(out, /<h2 id="showcase-title"/);
  assert.match(out, /<ul class="carousel__track showcase__track"[^>]*aria-label="Models"/);
});

test('sortShowcase orders by category order, then vehicle order, without mutating', () => {
  const v = (name, order, categoryOrder) => ({
    sys: { type: 'Entry', id: name },
    fields: { name, order, category: categoryOrder === undefined ? undefined : { sys: { type: 'Entry' }, fields: { order: categoryOrder } } },
  });
  const input = [v('motorsport', 1, 4), v('gt', 1, 2), v('spider', 4, 1), v('coupe', 3, 1), v('unresolved', 0)];
  const before = input.map((item) => item.fields.name);
  assert.deepEqual(sortShowcase(input).map((item) => item.fields.name), ['coupe', 'spider', 'gt', 'motorsport', 'unresolved']);
  assert.deepEqual(input.map((item) => item.fields.name), before, 'input untouched');
  assert.deepEqual(sortShowcase(undefined), []);
});

test('home showcase renders in category then vehicle order', () => {
  const [a, b] = homeData.showcase;
  const swap = (entry, order) => ({ ...entry, fields: { ...entry.fields, order } });
  const { out } = renderView('home', { ...homeData, showcase: [swap(a, 9), swap(b, 1)] });
  assert.ok(out.indexOf(b.fields.name) < out.lastIndexOf(a.fields.name));
  assert.ok(out.indexOf('href="#/' + b.fields.slug + '"') < out.indexOf('href="#/' + a.fields.slug + '"'));
});

// ---------------------------------------------------------------------------
// story
// ---------------------------------------------------------------------------

test('story: hero, standfirst, sections, related vehicles and more stories', () => {
  const { out, heads } = renderView('story', storyData);
  assert.match(out, /class="hero hero--compact hero--story/);
  assert.match(out, /<span class="eyebrow">Engineering · <time datetime="2026-02-12">12 February 2026<\/time><\/span>/);
  assert.match(out, /<h1[^>]*>750S: five key facts<\/h1>/);
  assert.match(out, /<div class="lead" data-reveal><p>Standfirst for 750S: five key facts\.<\/p><\/div>/);
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

test('placeholder: configure with a resolved vehicle', () => {
  const route = { name: 'placeholder', params: { path: 'configure/750s', kind: 'configure', slug: '750s' } };
  const { out, heads } = renderView('placeholder', { route, vehicle: vehicles.full });
  assert.match(out, /<span class="eyebrow">Placeholder<\/span>/);
  assert.match(out, /<h1[^>]*>Configure your 750S<\/h1>/);
  assert.match(out, /placeholder route in the demo/);
  assert.match(out, /configurator, lead form, or legal page/);
  assert.match(out, /theme-carbon/);
  assert.match(out, /href="#\/"[^>]*>Back home</);
  assert.match(out, /href="#\/750s"[^>]*>Back to 750S</);
  assert.match(out, /<a href="#\/">Home<\/a>/);
  assert.match(out, /<li class="breadcrumbs__item" aria-current="page">Configure your 750S<\/li>/);
  assert.deepEqual(heads, [{ title: 'Configure your 750S', description: '' }]);
});

test('placeholder: titles per kind, with and without a vehicle', () => {
  const titleOf = (params, vehicle = null) =>
    renderView('placeholder', { route: { name: 'placeholder', params }, vehicle }).heads[0].title;
  assert.equal(titleOf({ kind: 'configure', slug: 'nope', path: 'configure/nope' }), 'Configurator');
  assert.equal(titleOf({ kind: 'configure', slug: null, path: 'configure' }), 'Configurator');
  assert.equal(titleOf({ kind: 'enquire', slug: '750s', path: 'enquire/750s' }, vehicles.full), 'Enquire about 750S');
  assert.equal(titleOf({ kind: 'enquire', slug: null, path: 'enquire' }), 'Enquire');
  assert.equal(titleOf({ kind: 'contact', slug: null, path: 'contact' }), 'Contact McLaren');
  assert.equal(titleOf({ kind: 'legal', slug: 'privacy', path: 'legal/privacy' }), 'Legal: privacy');
  assert.equal(titleOf({ kind: 'legal', slug: null, path: 'legal' }), 'Legal');
  assert.equal(titleOf({ kind: 'placeholder', slug: 'careers', path: 'placeholder/careers' }), 'Coming soon');
  assert.equal(titleOf({ kind: 'mcl-6gt', slug: null, path: 'mcl-6gt' }), 'Coming soon');
  const { out } = renderView('placeholder', { route: { name: 'placeholder', params: { kind: 'contact', slug: null, path: 'contact' } }, vehicle: null });
  assert.doesNotMatch(out, /Back to /, 'no vehicle, no back-to-vehicle button');
});

test('placeholder: slug and vehicle name are escaped', () => {
  const evil = '<script>alert(1)</script>';
  const out = renderView('placeholder', { route: { name: 'placeholder', params: { kind: 'legal', slug: evil, path: `legal/${evil}` } } }).out;
  assert.doesNotMatch(out, /<script/i);
  const vehicle = clone(vehicles.full);
  vehicle.fields.name = evil;
  const configured = renderView('placeholder', { route: { name: 'placeholder', params: { kind: 'configure', slug: 'x', path: 'configure/x' } }, vehicle }).out;
  assert.doesNotMatch(configured, /<script/i);
});

test('shell: a javascript: externalUrl never reaches an href', () => {
  const link = (label, externalUrl) => ({ sys: { id: label, contentType: { sys: { id: 'link' } } }, fields: { label, externalUrl } });
  const evil = 'javascript:alert(1)';
  const settings = clone(site.siteSettings);
  settings.fields.mainNavigation = [link('Nav', evil), { ...link('Parent', undefined), fields: { label: 'Parent', children: [link('Child', evil)] } }];
  settings.fields.retailerLink = link('Retailer', evil);
  settings.fields.socialLinks = [link('Social', evil)];
  settings.fields.legalLinks = [link('Legal', evil)];
  const header = String(renderHeader(settings, []));
  const footer = String(renderFooter(settings));
  assert.doesNotMatch(header + footer, /javascript:/i);
  assert.match(header, /href="#" class="site-nav__retailer"/);
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
    registry.placeholder({ route: { name: 'placeholder', params: { kind: 'contact', slug: null, path: 'contact' } }, vehicle: null }, ctx),
  ];
  for (const out of outputs) {
    assert.equal(typeof String(out), 'string');
    assert.ok(String(out).length > 200);
    assert.doesNotMatch(String(out), BAD);
  }
});

// ---------------------------------------------------------------------------
// image helper crops
// ---------------------------------------------------------------------------

const photoAsset = (overrides = {}) => ({
  sys: { id: 'photo-1', type: 'Asset' },
  fields: {
    title: 'Studio photo',
    description: 'A car in a studio',
    file: {
      url: '//images.ctfassets.net/space/photo-1/abc/photo.webp',
      contentType: 'image/webp',
      details: { image: { width: 2400, height: 1350 } },
      ...overrides,
    },
  },
});

test('imageTag with aspect 4:3 requests a filled crop', () => {
  const { ctx } = makeCtx();
  const out = String(imageTag(ctx, photoAsset(), { w: 1200, aspect: '4:3' }));
  const src = out.match(/src="([^"]+)"/)[1];
  const params = new URL(src.replaceAll('&amp;', '&')).searchParams;
  assert.equal(params.get('fit'), 'fill');
  assert.equal(params.get('f'), 'center');
  assert.equal(params.get('w'), '1200');
  assert.equal(params.get('h'), '900');
  assert.match(out, /width="1200" height="900"/);
});

test('imageTag with aspect and a focus', () => {
  const { ctx } = makeCtx();
  const out = String(imageTag(ctx, photoAsset(), { w: 800, aspect: '3:4', focus: 'bottom' }));
  const params = new URL(out.match(/src="([^"]+)"/)[1].replaceAll('&amp;', '&')).searchParams;
  assert.equal(params.get('f'), 'bottom');
  assert.equal(params.get('h'), '1067');
  assert.match(out, /width="800" height="1067"/);
});

test('imageTag aspect dimensions ignore the asset details', () => {
  const { ctx } = makeCtx();
  const noDetails = photoAsset({ details: undefined });
  const out = String(imageTag(ctx, noDetails, { w: 1600, aspect: '16:9' }));
  assert.match(out, /width="1600" height="900"/);
  assert.doesNotMatch(out, /NaN/);
});

test('imageTag without image details still renders', () => {
  const { ctx } = makeCtx();
  for (const details of [undefined, {}, { image: {} }, { image: { width: 'x', height: null } }]) {
    const out = String(imageTag(ctx, photoAsset({ details }), { w: 800 }));
    assert.match(out, /<img[^>]* src="https:\/\/images\.ctfassets\.net/);
    assert.doesNotMatch(out, /NaN|undefined/);
    assert.doesNotMatch(out, /\swidth=|\sheight=/, 'no dimensions attributes without details');
  }
});

test('imageTag without aspect keeps the natural-ratio URL', () => {
  const { ctx } = makeCtx();
  const src = String(imageSrc(ctx, photoAsset(), 800));
  assert.doesNotMatch(src, /fit=|[?&]h=|[?&]f=/);
  assert.match(src, /w=800/);
});

test('SVG assets never get fm=webp but do get fit when aspect is set', () => {
  const { ctx } = makeCtx();
  const svg = photoAsset({ url: '//images.ctfassets.net/space/svg-1/abc/placeholder.svg', contentType: 'image/svg+xml' });
  const out = String(imageTag(ctx, svg, { w: 800, aspect: '4:3' }));
  assert.doesNotMatch(out, /fm=webp/);
  assert.match(out, /fit=fill/);
  assert.match(out, /h=600/);
  assert.doesNotMatch(String(imageTag(ctx, svg, { w: 800 })), /fm=webp/);
});

test('an unknown aspect is ignored rather than producing NaN', () => {
  const { ctx } = makeCtx();
  const out = String(imageTag(ctx, photoAsset(), { w: 800, aspect: 'wide' }));
  assert.doesNotMatch(out, /NaN|fit=/);
});

test('cards and tiles crop their images, heroes stay natural', () => {
  const { out } = renderView('vehicle', { entry: vehicles.full, variants: vehicles.variants });
  assert.match(out.match(/<img[^>]*hero__image[^>]*>/)[0], /w=1920/);
  assert.doesNotMatch(out.match(/<img[^>]*hero__image[^>]*>/)[0], /fit=fill/);
  const { out: cat } = renderView('vehicleCategory', categoryData);
  const cardImgs = cat.match(/<img[^>]*card__media[^>]*>/g) || [];
  assert.ok(cardImgs.length > 0, 'category renders product card images');
  for (const tag of cardImgs) {
    assert.match(tag, /fit=fill/);
    assert.match(tag, /h=600/);
  }
});

test('enquire renderer emits the form contract and preselects the route vehicle', () => {
  const { ctx, heads } = makeCtx();
  const out = String(registry.enquire({ ...enquireData, route: { name: 'enquire', params: { slug: '750s' } } }, ctx));
  assert.match(out, /<form[^>]*data-enquiry-form[^>]*data-endpoint="https:\/\/hook\.fusion\.adobe\.com\/[^"]+"/);
  for (const name of ['name', 'email', 'phone', 'country', 'model', 'message', 'consent', 'website']) {
    assert.match(out, new RegExp(`name="${name}"`), `field ${name}`);
  }
  assert.match(out, /<option value="750s" selected>750S<\/option>/);
  assert.match(out, /<option value="gts">GTS<\/option>/);
  assert.match(out, /data-enquiry-status/);
  assert.match(out, /data-enquiry-success[^>]*hidden/);
  assert.match(out, /id="email-error"/);
  assert.doesNotMatch(out, /<script>alert/);
  assert.match(out, /&lt;script&gt;/);
  assert.equal(heads.at(-1).title, 'Enquire about 750S');
});

test('enquire renderer works without a vehicle', () => {
  const { ctx } = makeCtx();
  const out = String(registry.enquire({ ...enquireData, vehicle: null, route: { name: 'enquire', params: { slug: null } } }, ctx));
  assert.match(out, /<option value="" selected>Select a model<\/option>/);
  assert.match(out, /<h1[^>]*>Enquire<\/h1>/);
  assert.match(out, /href="#\/">Back home/);
});

const withFixture = (override) => structuredClone({ ...enquireData, ...override });
const vehicleEntry = (slug, name) => ({ sys: { id: `v-${slug}`, type: 'Entry' }, fields: { slug, name } });

test('enquire renderer escapes vehicle names and the endpoint', () => {
  const { ctx } = makeCtx();
  const data = withFixture({});
  data.vehicles = [vehicleEntry('odd', 'Odd "Quote" <b>Car</b>')];
  data.vehicle = null;
  data.form.fields.endpoint = 'https://hook.example/x" onfocus="alert(1)';
  const out = String(registry.enquire(data, ctx));
  assert.match(out, /<option value="odd">Odd &quot;Quote&quot; &lt;b&gt;Car&lt;\/b&gt;<\/option>/);
  assert.doesNotMatch(out, /<b>Car/);
  assert.match(out, /data-endpoint="https:\/\/hook\.example\/x&quot; onfocus=&quot;alert\(1\)"/);
  assert.doesNotMatch(out, /data-endpoint="[^"]*" onfocus=/);
});

test('enquire renderer adds a route vehicle that is missing from the list, preselected', () => {
  const { ctx } = makeCtx();
  const data = withFixture({});
  data.vehicles = [vehicleEntry('gts', 'GTS')];
  data.vehicle = vehicleEntry('750s', '750S');
  const out = String(registry.enquire(data, ctx));
  assert.match(out, /<option value="750s" selected>750S<\/option>/);
  assert.match(out, /<option value="gts">GTS<\/option>/);
  assert.equal((out.match(/<option value="750s"/g) || []).length, 1);
  assert.match(out, /<select id="model" name="model" required/);
  assert.doesNotMatch(out, /Models could not be loaded/);
});

test('enquire renderer with no models shows a hint and does not require the select', () => {
  const { ctx } = makeCtx();
  const data = withFixture({});
  data.vehicles = [];
  data.vehicle = null;
  const out = String(registry.enquire(data, ctx));
  const select = out.match(/<select[^>]*>[\s\S]*?<\/select>/)[0];
  assert.doesNotMatch(select, /required/);
  assert.equal((select.match(/<option/g) || []).length, 1);
  assert.match(select, /<option value="" selected>Select a model<\/option>/);
  assert.match(out, /<p class="form__hint">Models could not be loaded\. Reload the page to try again\.<\/p>/);
});
