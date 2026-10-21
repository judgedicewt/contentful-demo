/**
 * The visitor profile for audience personalization. This module owns
 * everything the site knows about the visitor and is the only reader and
 * writer of the profile, so replacing it with a customer data platform (CDP)
 * changes this file alone.
 * Nothing touches the DOM or storage at import time: storage and the clock
 * are read only when a function runs, and failures fall back to memory.
 */

export const PROFILE_KEY = 'mcl.profile';
export const SESSION_KEY = 'mcl.session';
export const PROFILE_VERSION = 1;
export const MAX_VIEWED_VEHICLES = 20;

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const clone = (value) => JSON.parse(JSON.stringify(value));

function fresh() {
  return {
    version: PROFILE_VERSION,
    visits: 0,
    firstSeen: null,
    lastSeen: null,
    viewed: { vehicles: [], categories: {} },
    campaign: null,
    region: null,
    overrides: { audiences: null, region: null },
  };
}

/** Keeps the string entries of `list`, without duplicates. */
function strings(list) {
  return [...new Set(list.filter((value) => typeof value === 'string'))];
}

/** Trims the value. Two ASCII letters become uppercase; anything else is null. */
function normaliseRegion(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return /^[A-Za-z]{2}$/.test(trimmed) ? trimmed.toUpperCase() : null;
}

/** Repairs a parsed profile field by field. A profile of another version starts fresh. */
function normalise(raw) {
  if (!isObject(raw) || raw.version !== PROFILE_VERSION) return fresh();
  const viewed = isObject(raw.viewed) ? raw.viewed : {};
  const categories = {};
  if (isObject(viewed.categories)) {
    for (const [slug, count] of Object.entries(viewed.categories)) {
      if (Number.isInteger(count) && count > 0) categories[slug] = count;
    }
  }
  const overrides = isObject(raw.overrides) ? raw.overrides : {};
  return {
    version: PROFILE_VERSION,
    visits: Number.isInteger(raw.visits) && raw.visits >= 0 ? raw.visits : 0,
    firstSeen: typeof raw.firstSeen === 'string' ? raw.firstSeen : null,
    lastSeen: typeof raw.lastSeen === 'string' ? raw.lastSeen : null,
    viewed: {
      vehicles: Array.isArray(viewed.vehicles) ? strings(viewed.vehicles).slice(0, MAX_VIEWED_VEHICLES) : [],
      categories,
    },
    campaign: typeof raw.campaign === 'string' ? raw.campaign : null,
    region: normaliseRegion(raw.region),
    overrides: {
      audiences: Array.isArray(overrides.audiences) ? strings(overrides.audiences) : null,
      region: normaliseRegion(overrides.region),
    },
  };
}

/**
 * Creates a profile store over the given storage and clock. Each instance
 * keeps its own in-memory state, so tests can run several at once.
 */
export function createSignals({ local = () => globalThis.localStorage, session = () => globalThis.sessionStorage, now = () => new Date() } = {}) {
  let enabled = true;
  let memory = null; // The last profile this instance wrote.
  let unsaved = false; // True when the last write failed, so memory is the truth.
  let counted = false; // True once this instance has seen a session start (used when session storage is blocked).

  /** Reads the stored profile. A blocked or empty store gives memory, or a fresh profile. */
  function load() {
    if (unsaved) return clone(memory);
    let raw;
    try {
      raw = local().getItem(PROFILE_KEY);
    } catch {
      return clone(memory ?? fresh());
    }
    if (raw === null) return fresh();
    try {
      return normalise(JSON.parse(raw));
    } catch {
      return fresh();
    }
  }

  function save(profile) {
    memory = clone(profile);
    try {
      local().setItem(PROFILE_KEY, JSON.stringify(profile));
      unsaved = false;
    } catch {
      unsaved = true;
    }
  }

  /** True when this boot starts a new browser session, and records that it has. */
  function startsVisit() {
    let isNew;
    try {
      const store = session();
      isNew = store.getItem(SESSION_KEY) === null;
      if (isNew) store.setItem(SESSION_KEY, '1');
    } catch {
      isNew = !counted;
    }
    counted = true;
    return isNew;
  }

  function recordBoot(location, navigator) {
    if (!enabled) return load();
    const profile = load();
    const at = now().toISOString();
    if (startsVisit()) profile.visits += 1;
    if (profile.firstSeen === null) profile.firstSeen = at;
    profile.lastSeen = at;
    const campaign = campaignFromLocation(location);
    if (campaign) profile.campaign = campaign;
    if (profile.region === null) profile.region = regionFromLanguage(navigator?.language);
    save(profile);
    return clone(profile);
  }

  function recordView({ vehicleSlug, categorySlug } = {}) {
    if (!enabled) return load();
    const profile = load();
    const { viewed } = profile;
    if (vehicleSlug) {
      viewed.vehicles = [vehicleSlug, ...viewed.vehicles.filter((slug) => slug !== vehicleSlug)].slice(0, MAX_VIEWED_VEHICLES);
    }
    if (categorySlug) {
      const count = Object.hasOwn(viewed.categories, categorySlug) ? viewed.categories[categorySlug] : 0;
      viewed.categories[categorySlug] = count + 1;
    }
    save(profile);
    return clone(profile);
  }

  function setOverrides({ audiences, region } = {}) {
    if (!enabled) return load();
    const profile = load();
    if (audiences !== undefined) {
      profile.overrides.audiences = Array.isArray(audiences) ? strings(audiences) : null;
    }
    if (region !== undefined) profile.overrides.region = normaliseRegion(region);
    save(profile);
    return clone(profile);
  }

  /** Turns writes on or off. Reads keep working either way, and reset always clears. */
  function setEnabled(on) {
    enabled = Boolean(on);
  }

  /** Removes the stored profile and the session marker, and drops the in-memory copy. */
  function reset() {
    memory = null;
    unsaved = false;
    counted = false;
    for (const [store, key] of [[local, PROFILE_KEY], [session, SESSION_KEY]]) {
      try {
        store().removeItem(key);
      } catch {
        // Blocked storage holds nothing this instance could remove.
      }
    }
    return fresh();
  }

  return { load, recordBoot, recordView, setOverrides, setEnabled, reset };
}

export const { load, recordBoot, recordView, setOverrides, setEnabled, reset } = createSignals();

/**
 * The value of `name` in the real query string, then in the query string
 * after the first `?` of the hash route. Trimmed, or null when absent or blank.
 */
export function readQueryParam(location, name) {
  const search = typeof location?.search === 'string' ? location.search : '';
  const hash = typeof location?.hash === 'string' ? location.hash : '';
  const at = hash.indexOf('?');
  const hashQuery = at === -1 ? '' : hash.slice(at + 1);
  for (const query of [search, hashQuery]) {
    const value = new URLSearchParams(query).get(name)?.trim();
    if (value) return value;
  }
  return null;
}

/** The campaign named by `utm_campaign`, then `audience`, lowercased; or null. */
export function campaignFromLocation(location) {
  for (const name of ['utm_campaign', 'audience']) {
    const value = readQueryParam(location, name);
    if (value) return value.toLowerCase();
  }
  return null;
}

/** The region subtag of a language tag such as `en-GB`, uppercased; or null. */
export function regionFromLanguage(tag) {
  if (typeof tag !== 'string') return null;
  const subtags = tag.split(/[-_]/).slice(1);
  for (const subtag of subtags) {
    if (subtag.length === 1) return null; // An extension begins here.
    if (/^[A-Za-z]{2}$/.test(subtag)) return subtag.toUpperCase();
  }
  return null;
}

/** The region in force for a profile: the override when set, else the derived region. */
export function effectiveRegion(profile) {
  const value = profile?.overrides?.region || profile?.region;
  return typeof value === 'string' ? value.toUpperCase() : null;
}

/** The profile fields a route view contributes, or null when the view is not recorded. */
export function viewFrom(view, data) {
  const fields = data?.entry?.fields;
  if (!fields) return null;
  if (view === 'vehicle') {
    const out = {};
    if (fields.slug) out.vehicleSlug = String(fields.slug);
    const categorySlug = fields.category?.fields?.slug;
    if (categorySlug) out.categorySlug = String(categorySlug);
    return Object.keys(out).length ? out : null;
  }
  if (view === 'vehicleCategory' && fields.slug) return { categorySlug: String(fields.slug) };
  return null;
}
