/**
 * Verifies the published space against the page inventory in
 * docs/plans/2026-10-20-mclaren-schema-design.md using the Delivery API.
 * Exits non-zero when anything is missing or malformed. Also checks that every
 * internal `#/...` href in published content resolves to a route that exists.
 * Runs once per locale (the default plus every entry in LOCALES), and in the
 * `ja-JP` pass also checks that key text fields contain Japanese script.
 */
import { loadConfig } from '../src/config.js';
import { DEFAULT_LOCALE, LOCALES } from '../src/content-model.js';
import { SEED_GROUPS } from '../src/seed/index.js';
import { matchRoute, CONTENT_INCLUDE } from '../site/js/router.js';

const config = loadConfig();
if (config.missing.length > 0) {
  console.error(`Missing required variables: ${config.missing.join(', ')}`);
  process.exit(1);
}

const base = `https://cdn.contentful.com/spaces/${config.spaceId}/environments/${config.environmentId}`;
/** Cumulative across every locale pass. */
const problems = [];

/** Matches Hiragana, Katakana, and CJK ideographs. */
const JAPANESE_SCRIPT = /[\u3040-\u30ff\u4e00-\u9fff]/;

async function cda(locale, params) {
  const url = new URL(`${base}/entries`);
  url.searchParams.set('access_token', config.deliveryToken);
  url.searchParams.set('locale', locale);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const error = new Error(`Delivery API ${res.status} ${body.message ?? res.statusText} for ${url.pathname}`);
    error.status = res.status;
    throw error;
  }
  return res.json();
}

/** Walks fields and collects links whose target is absent from includes. */
function findDanglingLinks(payload) {
  const known = new Set();
  for (const e of [...(payload.items ?? []), ...(payload.includes?.Entry ?? []), ...(payload.includes?.Asset ?? [])]) known.add(e.sys.id);
  const dangling = [];
  const walk = (value, path) => {
    if (!value || typeof value !== 'object') return;
    if (value.sys?.type === 'Link' && !known.has(value.sys.id)) dangling.push(`${path} -> ${value.sys.linkType} ${value.sys.id}`);
    else if (Array.isArray(value)) value.forEach((v, i) => walk(v, `${path}[${i}]`));
    else for (const [k, v] of Object.entries(value.fields ?? value)) walk(v, path ? `${path}.${k}` : k);
  };
  for (const item of payload.items ?? []) walk(item, item.sys.id);
  return dangling;
}

/** Collects `{ path, value }` for every string starting with `#/` in an entry's fields. */
function collectInternalHrefs(entry) {
  const found = [];
  const walk = (value, path) => {
    if (typeof value === 'string') {
      if (value.startsWith('#/')) found.push({ path, value });
    } else if (Array.isArray(value)) value.forEach((v, i) => walk(v, `${path}[${i}]`));
    else if (value && typeof value === 'object' && !value.sys) for (const [k, v] of Object.entries(value)) walk(v, `${path}.${k}`);
  };
  for (const [k, v] of Object.entries(entry.fields ?? {})) walk(v, `${entry.sys.id}.${k}`);
  return found;
}

const expected = {
  vehicle: SEED_GROUPS.find((g) => g.name === 'vehicles').entries.map((e) => e.fields.slug),
  vehicleCategory: SEED_GROUPS.find((g) => g.name === 'categories').entries.map((e) => e.fields.slug),
  page: SEED_GROUPS.find((g) => g.name === 'pages').entries.filter((e) => e.contentType === 'page').map((e) => e.fields.slug),
  story: SEED_GROUPS.find((g) => g.name === 'stories').entries.filter((e) => e.contentType === 'story').map((e) => e.fields.slug),
};

// Cross-type slug uniqueness (routes share one namespace). Slugs come from the
// seed data and are never localized, so this runs once, not per locale.
const slugOwners = new Map();
for (const [type, slugs] of Object.entries(expected)) for (const s of slugs) {
  if (type === 'vehicleCategory') continue;
  if (slugOwners.has(s)) problems.push(`slug/${s}: used by ${slugOwners.get(s)} and ${type}`);
  slugOwners.set(s, type);
}

/** Fields that must hold Japanese script in the ja-JP pass, by content type. */
const JAPANESE_FIELDS = { vehicleCategory: 'intro', story: 'standfirst' };

/**
 * Runs every check against one locale, printing its table. Returns the counts
 * for the summary line. Problems accumulate in the shared `problems` array.
 */
async function verifyLocale(locale) {
  const rows = [];
  /** Every published entry seen in any response, by id, for the internal link check. */
  const seenEntries = new Map();
  const remember = (entries) => {
    for (const e of entries ?? []) if (e?.sys?.id && e.fields) seenEntries.set(e.sys.id, e);
  };
  const problem = (scope, message) => {
    problems.push(`${locale === DEFAULT_LOCALE ? '' : `[${locale}] `}${scope}: ${message}`);
  };
  const checkJapanese = (type, id, field, value) => {
    if (locale === 'ja-JP' && !JAPANESE_SCRIPT.test(String(value ?? ''))) {
      problems.push(`${type}/${id} has no Japanese text in ${field}`);
    }
  };
  const all = async (params) => {
    const items = [];
    const includes = { Entry: [], Asset: [] };
    let skip = 0;
    for (;;) {
      const page = await cda(locale, { ...params, limit: 100, skip });
      items.push(...page.items);
      includes.Entry.push(...(page.includes?.Entry ?? []));
      includes.Asset.push(...(page.includes?.Asset ?? []));
      remember(page.items);
      remember(page.includes?.Entry);
      skip += page.items.length;
      if (skip >= page.total || page.items.length === 0) return { items, includes, total: page.total };
    }
  };

  const publishedSlugs = {};
  // Slugs of vehicles the site lists (current or motorsport); `#/enquire/<slug>` links must point at one.
  const currentVehicleSlugs = new Set();

  for (const [contentType, slugs] of Object.entries(expected)) {
    const payload = await all({ content_type: contentType, include: CONTENT_INCLUDE });
    const bySlug = new Map(payload.items.map((e) => [e.fields.slug, e]));
    publishedSlugs[contentType] = new Set(bySlug.keys());
    const seen = new Set();
    for (const e of payload.items) {
      if (seen.has(e.fields.slug)) problem(`${contentType}/${e.fields.slug}`, 'duplicate slug');
      seen.add(e.fields.slug);
    }
    for (const slug of slugs) {
      const entry = bySlug.get(slug);
      if (!entry) {
        problem(`${contentType}/${slug}`, 'not published');
        rows.push([contentType, slug, 'MISSING']);
        continue;
      }
      if (contentType !== 'vehicleCategory' && contentType !== 'page' && !entry.fields.heroImage) problem(`${contentType}/${slug}`, 'no heroImage');
      if (JAPANESE_FIELDS[contentType]) checkJapanese(contentType, slug, JAPANESE_FIELDS[contentType], entry.fields[JAPANESE_FIELDS[contentType]]);
      if (contentType === 'vehicle') {
        if (['current', 'motorsport'].includes(entry.fields.status)) currentVehicleSlugs.add(slug);
        const specIds = (entry.fields.specifications ?? []).map((l) => l.sys.id);
        const specs = (payload.includes?.Entry ?? []).filter((e) => specIds.includes(e.sys.id));
        const featured = specs.filter((s) => s.fields.featured).length;
        if (featured > 3) problem(`vehicle/${slug}`, `${featured} featured specs (max 3)`);
        if (specs.length !== specIds.length) problem(`vehicle/${slug}`, 'unpublished specification linked');
      }
      rows.push([contentType, slug, 'ok']);
    }
    const dangling = findDanglingLinks(payload);
    for (const d of dangling) problem(contentType, `dangling link ${d}`);
  }

  const site = await cda(locale, { content_type: 'siteSettings', include: 2, limit: 1 });
  if (site.total !== 1) problem('siteSettings', `expected 1 entry, found ${site.total}`);
  else {
    if (!(site.items[0].fields.mainNavigation?.length > 0)) problem('siteSettings', 'mainNavigation is empty');
    checkJapanese('siteSettings', site.items[0].sys.id, 'newsletterText', site.items[0].fields.newsletterText);
  }
  remember(site.items);
  remember(site.includes?.Entry);
  const retailers = await cda(locale, { content_type: 'retailer', limit: 1 });
  if (retailers.total < 1) problem('retailer', 'no retailers published');
  const enquiry = await cda(locale, { content_type: 'enquiryForm', include: 0, limit: 2 });
  if (enquiry.total !== 1) problem('enquiryForm', `expected 1 entry, found ${enquiry.total}`);
  else {
    if (!String(enquiry.items[0].fields.endpoint || '').startsWith('https://')) problem('enquiryForm', 'endpoint is not an https URL');
    checkJapanese('enquiryForm', enquiry.items[0].sys.id, 'intro', enquiry.items[0].fields.intro);
  }

  // Internal links: every `#/...` string in published content must resolve to a
  // route, and slug-based routes must point at something that is published.
  await all({ content_type: 'link', include: 0 });
  const slugSets = {
    page: new Set([...(publishedSlugs.page ?? []), ...(publishedSlugs.vehicle ?? [])]),
    vehicle: publishedSlugs.vehicle ?? new Set(),
    story: publishedSlugs.story ?? new Set(),
    category: publishedSlugs.vehicleCategory ?? new Set(),
    enquire: currentVehicleSlugs,
  };
  let internalLinks = 0;
  for (const entry of seenEntries.values()) {
    for (const { path, value } of collectInternalHrefs(entry)) {
      internalLinks += 1;
      const route = matchRoute(value);
      if (route.name === 'notFound') problem(`link ${path}`, `${value} resolves to the 404 view`);
      else if (slugSets[route.name] && route.params.slug !== null && !slugSets[route.name].has(route.params.slug)) {
        problem(`link ${path}`, `${value} points at ${route.name} "${route.params.slug}", which is not published`);
      }
    }
  }

  const width = Math.max(...rows.map((r) => r[1].length));
  console.log(`${'type'.padEnd(16)} ${'slug'.padEnd(width)} status`);
  for (const [t, s, st] of rows) console.log(`${t.padEnd(16)} ${s.padEnd(width)} ${st}`);
  return { routes: rows.length, siteSettings: site.total, retailers: retailers.total, enquiryForm: enquiry.total, internalLinks };
}

const locales = [DEFAULT_LOCALE, ...LOCALES.map((l) => l.code)];
// Singleton and route counts come from the default-locale pass; the other
// passes repeat the same checks against their own text.
let counts = null;
let completed = 0;
for (const locale of locales) {
  console.log(`${locale === DEFAULT_LOCALE ? '' : '\n'}locale ${locale}`);
  try {
    const result = await verifyLocale(locale);
    counts ??= result;
    completed += 1;
  } catch (error) {
    // The Delivery API answers 400 "Unknown locale" until the locale is provisioned.
    if (locale === DEFAULT_LOCALE || error.status !== 400 || !/unknown locale/i.test(error.message)) throw error;
    problems.push(`locale ${locale}: ${error.message} (is the locale provisioned?)`);
    console.log('skipped, the Delivery API rejected the locale');
  }
}

if (counts) {
  console.log(`\n${counts.routes} routes checked, ${counts.siteSettings} siteSettings, ${counts.retailers} retailers, ${counts.enquiryForm} enquiryForm, ${counts.internalLinks} internal links checked, ${completed} of ${locales.length} locales`);
}
if (problems.length) {
  console.error(`\n${problems.length} problem(s):`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log('Content verification passed.');
