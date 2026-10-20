/**
 * Hash router: route matching, navigation helpers, and the data loader that
 * turns a matched route into `{ view, data }` for the render registry.
 *
 * Everything here is pure except `navigate` and `onRouteChange`, which touch
 * `window` only when called, so the module can be imported in Node tests.
 *
 * Routes (hash without the leading `#`):
 *   /, /home                    → home
 *   /current-models             → redirect to /current-models/supercars
 *   /current-models/:slug       → category
 *   /post/:slug                 → story
 *   /retailers                  → retailers
 *   /:a, /:a/:b                 → page (slug is the full path; the loader
 *                                 tries a vehicle with that slug first)
 *   anything deeper             → notFound
 */

export const DEFAULT_CATEGORY_SLUG = 'supercars';

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

/** Matches a location hash to `{ name, params }`. */
export function matchRoute(hash) {
  const segments = segmentsOf(hash);
  const [first, second] = segments;

  if (segments.length === 0 || (segments.length === 1 && first === 'home')) {
    return { name: 'home', params: {} };
  }
  if (first === 'current-models') {
    if (segments.length === 1) {
      return { name: 'redirect', params: { to: `#/current-models/${DEFAULT_CATEGORY_SLUG}` } };
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
export function routeFor(entry) {
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

/** Resolves a `link` entry to an href: its target's route, else externalUrl. */
export function linkHref(link) {
  if (!link) return '#';
  if (typeof link === 'string') return link;
  const fields = link.fields || {};
  if (fields.target && fields.target.fields) return routeFor(fields.target);
  if (fields.externalUrl) return String(fields.externalUrl);
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
 * Loads the data for a matched route. Returns `{ view, data }` where `view`
 * is a key of the render registry.
 */
export async function loadRoute(route, cda) {
  const { name, params } = route;
  switch (name) {
    case 'redirect':
      return { view: 'redirect', data: { to: params.to } };
    case 'home': {
      const entry = await cda.getBySlug('page', 'home');
      if (!entry) return { view: 'notFound', data: { route } };
      return { view: 'home', data: await loadPageData(cda, entry) };
    }
    case 'category': {
      const entry = await cda.getBySlug('vehicleCategory', params.slug, 2);
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
        const variants = await cda.getVariants(vehicle.sys.id);
        return { view: 'vehicle', data: { entry: vehicle, variants } };
      }
      const page = await cda.getBySlug('page', params.slug, 4);
      if (!page) return { view: 'notFound', data: { route } };
      return { view: 'page', data: await loadPageData(cda, page) };
    }
    default:
      return { view: 'notFound', data: { route } };
  }
}
