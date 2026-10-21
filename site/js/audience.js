/**
 * Audience resolution. A provider turns a visitor profile into the set of
 * audience keys the visitor belongs to. The local provider evaluates the
 * rules on each audience entry against the profile. A customer data platform
 * (CDP) provider can replace it behind the same interface. The resolver
 * unions the providers, then applies any audience override in the profile.
 * Nothing touches the DOM or storage at import time.
 */

import { effectiveRegion } from './signals.js';

const VISITOR_TYPES = new Set(['first-time', 'returning']);
const RETURNING_MIN_VISITS = 2;

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/** The entries of a non-empty array, or null. */
function nonEmptyList(value) {
  return Array.isArray(value) && value.length > 0 ? value : null;
}

/** The slugs of the resolved links in `list`, or null when none resolved. */
function linkedSlugs(list) {
  if (!Array.isArray(list)) return null;
  const slugs = list
    .filter((entry) => isObject(entry) && isObject(entry.fields) && typeof entry.fields.slug === 'string' && entry.fields.slug !== '')
    .map((entry) => entry.fields.slug);
  return slugs.length ? slugs : null;
}

/** True when the profile has viewed the category at least once. */
function viewedIn(categories, slug) {
  if (!Object.hasOwn(categories, slug)) return false;
  const count = categories[slug];
  return Number.isFinite(count) && count > 0;
}

/** The profile fields the rules read, with defaults for anything missing or of the wrong type. */
function readProfile(profile) {
  const p = isObject(profile) ? profile : {};
  const viewed = isObject(p.viewed) ? p.viewed : {};
  const campaign = typeof p.campaign === 'string' ? p.campaign.trim().toLowerCase() : '';
  return {
    visits: Number.isFinite(p.visits) ? p.visits : 0,
    vehicles: Array.isArray(viewed.vehicles) ? viewed.vehicles : [],
    categories: isObject(viewed.categories) ? viewed.categories : {},
    campaign: campaign || null,
    region: effectiveRegion(p),
  };
}

/** The predicates for the populated rules of an audience. Unpopulated rules are left out. */
function rulesFor(fields) {
  const rules = [];
  const categories = linkedSlugs(fields.interestCategories);
  if (categories) rules.push((p) => categories.some((slug) => viewedIn(p.categories, slug)));
  const vehicles = linkedSlugs(fields.interestVehicles);
  if (vehicles) rules.push((p) => vehicles.some((slug) => p.vehicles.includes(slug)));
  if (VISITOR_TYPES.has(fields.visitorType)) {
    const returning = fields.visitorType === 'returning';
    rules.push((p) => (p.visits >= RETURNING_MIN_VISITS) === returning);
  }
  if (Number.isFinite(fields.minVisits)) rules.push((p) => p.visits >= fields.minVisits);
  const campaigns = nonEmptyList(fields.campaigns);
  if (campaigns) {
    const wanted = campaigns.map((name) => (typeof name === 'string' ? name.trim().toLowerCase() : null));
    rules.push((p) => p.campaign !== null && wanted.includes(p.campaign));
  }
  const regions = nonEmptyList(fields.regions);
  if (regions) {
    const wanted = regions.map((code) => (typeof code === 'string' ? code.trim().toUpperCase() : null));
    rules.push((p) => p.region !== null && wanted.includes(p.region));
  }
  return rules;
}

/** The compiled form of an audience, or null when it can never match locally. */
function compile(audience) {
  if (!isObject(audience) || !isObject(audience.fields)) return null;
  const { fields } = audience;
  if (typeof fields.key !== 'string' || fields.key === '' || fields.source === 'external') return null;
  const rules = rulesFor(fields);
  if (!rules.length) return null;
  return { key: fields.key, rules, any: fields.matchMode === 'any' };
}

/**
 * Creates the provider that evaluates the rules of resolved audience entries
 * against a profile. Entries that are null, external or have no populated
 * rules never match.
 */
export function createLocalProvider(audiences) {
  const compiled = (Array.isArray(audiences) ? audiences : []).map(compile).filter(Boolean);
  return {
    resolve(profile) {
      const view = readProfile(profile);
      const keys = new Set();
      for (const { key, rules, any } of compiled) {
        const passes = any ? rules.some((rule) => rule(view)) : rules.every((rule) => rule(view));
        if (passes) keys.add(key);
      }
      return keys;
    },
  };
}

/**
 * Creates the resolver. `audiencesFor` unions the providers' keys, skipping a
 * provider that throws with one call to `warn`. An `overrides.audiences` array
 * in the profile, even an empty one, replaces the union.
 */
export function createResolver({ providers = [], warn = console.warn } = {}) {
  return {
    audiencesFor(profile) {
      const found = new Set();
      for (const provider of providers) {
        try {
          for (const key of provider.resolve(profile)) {
            if (typeof key === 'string') found.add(key);
          }
        } catch (error) {
          warn(`Audience provider skipped: ${error?.message ?? error}`);
        }
      }
      const override = profile?.overrides?.audiences;
      if (Array.isArray(override)) return new Set(override.filter((key) => typeof key === 'string'));
      return found;
    },
  };
}
