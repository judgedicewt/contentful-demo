/**
 * Hash router: route matching, navigation helpers, and the data loader that
 * turns a matched route into `{ view, data }` for the render registry.
 *
 * Everything here is pure except `navigate` and `onRouteChange`, which touch
 * `window` only when called, so the module can be imported in Node tests.
 *
 * Routes (hash without the leading `#`):
 *   /ja/...                     → any route below with lang 'ja' (the `ja` segment is removed
 *                                 first; `/ja` and `/ja/` are home; no prefix means lang 'en')
 *   /, /home                    → home
 *   /current-models             → redirect to /current-models/supercars
 *   /current-models/:slug       → category
 *   /post/:slug                 → story
 *   /retailers                  → retailers
 *   /enquire, /enquire/:slug    → enquire (falls back to placeholder if the form entry is missing)
 *   /configure/..., /contact, /legal/..., /placeholder/...,
 *   /mcl-6gt                    → placeholder (demo stand-ins for real integrations)
 *   #anything-else              → ignore (in-page anchors such as #main; not a route)
 *   /:a, /:a/:b                 → page (slug is the full path; the loader
 *                                 tries a vehicle with that slug first)
 *   anything deeper             → notFound
 */

import { safeUrl } from './dom.js';
import { DEFAULT_LANG } from './i18n.js';

export const DEFAULT_CATEGORY_SLUG = 'supercars';

/** First path segments whose destinations are placeholder routes in the demo. */
export const PLACEHOLDER_KINDS = new Set(['configure', 'contact', 'legal', 'placeholder', 'mcl-6gt']);

/** Normalises a hash (or path) into an array of decoded segments. */
export function segmentsOf(hash) {
  let path = String(hash ?? '');
  if (path.startsWith('#')) path = path.slice(1);
  const queryAt = path.indexOf('?');
  if (queryAt >= 0) path = path.slice(0, queryAt);
  return path
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      try {
        return decodeURIComponent(part);
      } catch {
        return part;
      }
    });
}

/** Prefixes a hash route (`#/...`) with the `ja` segment when `lang` is `'ja'`; anything else, including a route that already has the prefix, is returned unchanged. */
export function withLang(href, lang) {
  if (lang !== 'ja' || typeof href !== 'string' || !href.startsWith('#/')) return href;
  if (/^#\/ja(\/|$)/i.test(href)) return href;
  return href === '#/' ? '#/ja' : `#/ja/${href.slice(2)}`;
}

/** Rebuilds a hash for `lang`: strips any leading `ja` segment, drops the query string, then applies `withLang`. */
export function hashForLang(hash, lang) {
  const segments = segmentsOf(hash);
  if (segments[0]?.toLowerCase() === 'ja') segments.shift();
  const rebuilt = segments.length ? `#/${segments.join('/')}` : '#/';
  return withLang(rebuilt, lang);
}

/** Matches a location hash to `{ name, params, lang }`. */
export function matchRoute(hash) {
  const value = String(hash ?? '');
  // In-page anchors (`#main`) are not routes; leave the current view alone.
  if (value.startsWith('#') && value.length > 1 && !value.startsWith('#/')) {
    return { name: 'ignore', params: {}, lang: DEFAULT_LANG };
  }
  const segments = segmentsOf(value).map((segment) => segment.toLowerCase());
  const lang = segments[0] === 'ja' ? 'ja' : DEFAULT_LANG;
  if (lang === 'ja') segments.shift();
  return { ...matchSegments(segments, lang), lang };
}

/** Matches language-free, lowercased segments to `{ name, params }`. */
function matchSegments(segments, lang) {
  const [first, second] = segments;

  if (segments.length === 0 || (segments.length === 1 && first === 'home')) {
    return { name: 'home', params: {} };
  }
  if (first === 'current-models') {
    if (segments.length === 1) {
      return { name: 'redirect', params: { to: withLang(`#/current-models/${DEFAULT_CATEGORY_SLUG}`, lang) } };
    }
    if (segments.length === 2) return { name: 'category', params: { slug: second } };
    return { name: 'notFound', params: { path: segments.join('/') } };
  }
  if (first === 'post') {
    if (segments.length === 2) return { name: 'story', params: { slug: second } };
    return { name: 'notFound', params: { path: segments.join('/') } };
  }
  if (first === 'retailers' && segments.length === 1) {
    return { name: 'retailers', params: {} };
  }
  if (first === 'enquire') {
    return segments.length <= 2
      ? { name: 'enquire', params: { slug: second ?? null } }
      : { name: 'notFound', params: { path: segments.join('/') } };
  }
  if (PLACEHOLDER_KINDS.has(first)) {
    return { name: 'placeholder', params: { path: segments.join('/'), kind: first, slug: second ?? null } };
  }
  if (segments.length <= 2) {
    return { name: 'page', params: { slug: segments.join('/') } };
  }
  return { name: 'notFound', params: { path: segments.join('/') } };
}

/** Content type ID of a resolved entry, or ''. */
export function contentTypeOf(entry) {
  return entry?.sys?.contentType?.sys?.id || '';
}

/** Builds the hash route for an entry based on its content type. */
export function routeFor(entry, lang = DEFAULT_LANG) {
  return withLang(hashRouteFor(entry), lang);
}

function hashRouteFor(entry) {
  if (!entry || !entry.fields) return '#/';
  const slug = entry.fields.slug ? String(entry.fields.slug) : '';
  switch (contentTypeOf(entry)) {
    case 'vehicle':
      return slug ? `#/${slug}` : '#/';
    case 'vehicleCategory':
      return slug ? `#/current-models/${slug}` : `#/current-models/${DEFAULT_CATEGORY_SLUG}`;
    case 'story':
      return slug ? `#/post/${slug}` : '#/';
    case 'page':
      return !slug || slug === 'home' ? '#/' : `#/${slug}`;
    default:
      return '#/';
  }
}

/** Resolves a `link` entry to an href: its target's route, else externalUrl. Always safe to interpolate. */
export function linkHref(link, lang = DEFAULT_LANG) {
  if (!link) return '#';
  if (typeof link === 'string') return safeUrl(link);
  const fields = link.fields || {};
  if (fields.target && fields.target.fields) return safeUrl(routeFor(fields.target, lang));
  if (fields.externalUrl) return safeUrl(withLang(fields.externalUrl, lang));
  return '#';
}

/** True when the href leaves the site (not a hash route). */
export function isExternalHref(href) {
  return /^(https?:)?\/\//i.test(String(href || ''));
}

/** Sets the location hash (browser only). */
export function navigate(hash, { replace = false } = {}) {
  if (typeof window === 'undefined') return;
  const target = hash.startsWith('#') ? hash : `#${hash}`;
  if (replace && window.history?.replaceState) {
    window.history.replaceState(null, '', target);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    window.location.hash = target;
  }
}

/** Calls `fn(route)` on every hash change. Returns an unsubscribe function. */
export function onRouteChange(fn) {
  if (typeof window === 'undefined') return () => {};
  const handler = () => fn(matchRoute(window.location.hash));
  window.addEventListener('hashchange', handler);
  return () => window.removeEventListener('hashchange', handler);
}

/** Current route from `window.location.hash` (browser only). */
export function currentRoute() {
  if (typeof window === 'undefined') return matchRoute('#/');
  return matchRoute(window.location.hash || '#/');
}

/** Sections of a page or story that are storyGrids with no curated stories. */
function needsLatestStories(entry) {
  const sections = entry?.fields?.sections;
  if (!Array.isArray(sections)) return false;
  return sections.some(
    (section) => contentTypeOf(section) === 'storyGrid' && !(section.fields?.stories || []).length,
  );
}

/** Page data: the entry plus sibling and child pages for sub-navigation. */
async function loadPageData(cda, entry) {
  if (!entry) return null;
  const parentId = entry.fields.parent?.sys?.id;
  const [siblings, children, latestStories] = await Promise.all([
    parentId ? cda.getPagesByParent(parentId) : Promise.resolve([]),
    cda.getPagesByParent(entry.sys.id),
    needsLatestStories(entry) ? cda.getStories(3) : Promise.resolve([]),
  ]);
  return { entry, siblings, children, latestStories };
}

/**
 * Returns the `sys.id` that keys a vehicle family's variants query: the parent
 * model when it resolved to an entry, otherwise the vehicle itself.
 */
export function familyRootId(vehicle) {
  const parent = vehicle?.fields?.parentModel;
  if (parent?.fields && parent.sys?.id) return parent.sys.id;
  return vehicle?.sys?.id || '';
}

/**
 * Loads the data for a matched route. Returns `{ view, data }` where `view`
 * is a key of the render registry.
 */
export async function loadRoute(route, cda) {
  const { name, params } = route;
  switch (name) {
    case 'ignore':
      return { view: 'ignore', data: null };
    case 'redirect':
      return { view: 'redirect', data: { to: params.to } };
    case 'home': {
      const entry = await cda.getBySlug('page', 'home');
      if (!entry) return { view: 'notFound', data: { route } };
      // A showcase failure must not break the home page: it just loses the strip.
      const [pageData, showcase] = await Promise.allSettled([loadPageData(cda, entry), cda.getCurrentVehicles()]);
      if (pageData.status === 'rejected') throw pageData.reason;
      return {
        view: 'home',
        data: { ...pageData.value, showcase: showcase.status === 'fulfilled' ? showcase.value || [] : [] },
      };
    }
    case 'category': {
      const entry = await cda.getBySlug('vehicleCategory', params.slug, 3);
      if (!entry) return { view: 'notFound', data: { route } };
      const vehicles = await cda.getVehiclesInCategory(entry.sys.id);
      return { view: 'vehicleCategory', data: { entry, vehicles } };
    }
    case 'story': {
      const entry = await cda.getBySlug('story', params.slug, 4);
      if (!entry) return { view: 'notFound', data: { route } };
      const latestStories = await cda.getStories(4);
      return { view: 'story', data: { entry, latestStories } };
    }
    case 'retailers': {
      const retailers = await cda.getRetailers();
      return { view: 'retailers', data: { retailers } };
    }
    case 'page': {
      const vehicle = await cda.getBySlug('vehicle', params.slug, 4);
      if (vehicle) {
        const variants = await cda.getVariants(familyRootId(vehicle));
        return { view: 'vehicle', data: { entry: vehicle, variants } };
      }
      const page = await cda.getBySlug('page', params.slug, 4);
      if (!page) return { view: 'notFound', data: { route } };
      return { view: 'page', data: await loadPageData(cda, page) };
    }
    case 'enquire': {
      const slug = params.slug ?? null;
      const [form, vehicle, vehicles] = await Promise.allSettled([
        cda.getEnquiryForm(),
        slug ? cda.getBySlug('vehicle', slug, 1) : Promise.resolve(null),
        cda.getCurrentVehicles(),
      ]);
      const settled = (result, fallback) => (result.status === 'fulfilled' ? result.value ?? fallback : fallback);
      const formEntry = settled(form, null);
      const vehicleEntry = settled(vehicle, null);
      if (!formEntry) {
        const path = slug ? `enquire/${slug}` : 'enquire';
        return {
          view: 'placeholder',
          data: { route: { ...route, params: { kind: 'enquire', slug, path } }, vehicle: vehicleEntry },
        };
      }
      return { view: 'enquire', data: { route, form: formEntry, vehicle: vehicleEntry, vehicles: settled(vehicles, []) } };
    }
    case 'placeholder': {
      const wantsVehicle = params.kind === 'configure' && params.slug;
      const vehicle = wantsVehicle ? await cda.getBySlug('vehicle', params.slug, 1) : null;
      return { view: 'placeholder', data: { route, vehicle } };
    }
    default:
      return { view: 'notFound', data: { route } };
  }
}
