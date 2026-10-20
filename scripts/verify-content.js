/**
 * Verifies the published space against the page inventory in
 * docs/plans/2026-10-20-mclaren-schema-design.md using the Delivery API.
 * Exits non-zero when anything is missing or malformed.
 */
import { loadConfig } from '../src/config.js';
import { SEED_GROUPS } from '../src/seed/index.js';

const config = loadConfig();
if (config.missing.length > 0) {
  console.error(`Missing required variables: ${config.missing.join(', ')}`);
  process.exit(1);
}

const base = `https://cdn.contentful.com/spaces/${config.spaceId}/environments/${config.environmentId}`;
const problems = [];
const rows = [];

async function cda(params) {
  const url = new URL(`${base}/entries`);
  url.searchParams.set('access_token', config.deliveryToken);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url.pathname}?${[...url.searchParams.keys()].join(',')}`);
  return res.json();
}

async function all(params) {
  const items = [];
  const includes = { Entry: [], Asset: [] };
  let skip = 0;
  for (;;) {
    const page = await cda({ ...params, limit: 100, skip });
    items.push(...page.items);
    includes.Entry.push(...(page.includes?.Entry ?? []));
    includes.Asset.push(...(page.includes?.Asset ?? []));
    skip += page.items.length;
    if (skip >= page.total || page.items.length === 0) return { items, includes, total: page.total };
  }
}

function problem(scope, message) {
  problems.push(`${scope}: ${message}`);
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

const expected = {
  vehicle: SEED_GROUPS.find((g) => g.name === 'vehicles').entries.map((e) => e.fields.slug),
  vehicleCategory: SEED_GROUPS.find((g) => g.name === 'categories').entries.map((e) => e.fields.slug),
  page: SEED_GROUPS.find((g) => g.name === 'pages').entries.filter((e) => e.contentType === 'page').map((e) => e.fields.slug),
  story: SEED_GROUPS.find((g) => g.name === 'stories').entries.filter((e) => e.contentType === 'story').map((e) => e.fields.slug),
};

for (const [contentType, slugs] of Object.entries(expected)) {
  const payload = await all({ content_type: contentType, include: 4 });
  const bySlug = new Map(payload.items.map((e) => [e.fields.slug, e]));
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
    if (contentType === 'vehicle') {
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

const site = await cda({ content_type: 'siteSettings', include: 2, limit: 1 });
if (site.total !== 1) problem('siteSettings', `expected 1 entry, found ${site.total}`);
else if (!(site.items[0].fields.mainNavigation?.length > 0)) problem('siteSettings', 'mainNavigation is empty');
const retailers = await cda({ content_type: 'retailer', limit: 1 });
if (retailers.total < 1) problem('retailer', 'no retailers published');

// Cross-type slug uniqueness (routes share one namespace).
const slugOwners = new Map();
for (const [type, slugs] of Object.entries(expected)) for (const s of slugs) {
  if (type === 'vehicleCategory') continue;
  if (slugOwners.has(s)) problem(`slug/${s}`, `used by ${slugOwners.get(s)} and ${type}`);
  slugOwners.set(s, type);
}

const width = Math.max(...rows.map((r) => r[1].length));
console.log(`${'type'.padEnd(16)} ${'slug'.padEnd(width)} status`);
for (const [t, s, st] of rows) console.log(`${t.padEnd(16)} ${s.padEnd(width)} ${st}`);
console.log(`\n${rows.length} routes checked, ${site.total} siteSettings, ${retailers.total} retailers`);
if (problems.length) {
  console.error(`\n${problems.length} problem(s):`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log('Content verification passed.');
