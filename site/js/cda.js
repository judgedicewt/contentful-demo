/**
 * Contentful Delivery API client for the browser (and Node tests).
 *
 * `createClient(config)` returns an object that fetches from
 * cdn.contentful.com and resolves links against the `includes` block.
 * `resolve(payload)` is exported separately so it can be unit tested with
 * fixtures; it is pure and never touches the network.
 *
 * Resolved entries have the shape `{ sys, fields }` with every link inside
 * `fields` (at any depth, including arrays and rich text `data.target`)
 * replaced by the resolved entry or asset. Links whose target is not in the
 * payload become `null`. Cycles are preserved as object references.
 */

const DEFAULT_HOST = 'https://cdn.contentful.com';

/** True when `value` is a Contentful link object. */
export function isLink(value) {
  return Boolean(value && typeof value === 'object' && value.sys && value.sys.type === 'Link');
}

/** Returns `https:` + the asset file URL, with optional Images API params. */
export function assetUrl(asset, params) {
  const url = asset?.fields?.file?.url;
  if (!url) return '';
  let absolute = url.startsWith('//') ? `https:${url}` : url;
  if (params && typeof params === 'object') {
    const query = Object.entries(params)
      .filter(([, value]) => value !== null && value !== undefined && value !== '')
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');
    if (query) absolute += (absolute.includes('?') ? '&' : '?') + query;
  }
  return absolute;
}

/** Copies an asset, prefixing its file URL with `https:`. */
function normaliseAsset(asset) {
  const fields = { ...(asset.fields || {}) };
  if (fields.file && typeof fields.file === 'object') {
    fields.file = { ...fields.file };
    if (typeof fields.file.url === 'string' && fields.file.url.startsWith('//')) {
      fields.file.url = `https:${fields.file.url}`;
    }
  }
  return { sys: asset.sys, fields };
}

/**
 * Resolves every link in `payload.items` against `payload.includes`.
 * Returns the array of resolved items.
 */
export function resolve(payload) {
  if (!payload) return [];
  const items = Array.isArray(payload.items) ? payload.items : [];
  const includes = payload.includes || {};
  const lookup = new Map();
  for (const entry of items) if (entry?.sys?.id) lookup.set(entry.sys.id, entry);
  for (const entry of includes.Entry || []) if (entry?.sys?.id) lookup.set(entry.sys.id, entry);
  for (const asset of includes.Asset || []) if (asset?.sys?.id) lookup.set(asset.sys.id, asset);

  const memo = new Map();

  function resolveNode(node) {
    const id = node.sys.id;
    if (memo.has(id)) return memo.get(id);
    if (node.sys.type === 'Asset') {
      const asset = normaliseAsset(node);
      memo.set(id, asset);
      return asset;
    }
    const out = { sys: node.sys, fields: {} };
    memo.set(id, out);
    for (const [key, value] of Object.entries(node.fields || {})) {
      out.fields[key] = resolveValue(value);
    }
    return out;
  }

  function resolveValue(value) {
    if (Array.isArray(value)) return value.map(resolveValue);
    if (!value || typeof value !== 'object') return value;
    if (isLink(value)) {
      const target = lookup.get(value.sys.id);
      return target ? resolveNode(target) : null;
    }
    const out = {};
    for (const [key, inner] of Object.entries(value)) out[key] = resolveValue(inner);
    return out;
  }

  return items.map((item) => (item?.sys?.id ? resolveNode(item) : item));
}

/** True when a Delivery API error means "this content type does not exist". */
function isUnknownContentType(body) {
  const errors = body?.details?.errors;
  return Array.isArray(errors) && errors.some((error) => error?.name === 'unknownContentType');
}

/** Builds a Delivery API client. */
export function createClient(config = {}, options = {}) {
  const { spaceId, environment = 'master', deliveryToken } = config;
  const host = options.host || DEFAULT_HOST;
  const fetchImpl = options.fetch || globalThis.fetch;
  const warn = options.warn || ((message) => console.warn(`[cda] ${message}`));
  const warned = new Set();

  if (!spaceId || !deliveryToken) {
    throw new Error('Contentful client needs spaceId and deliveryToken');
  }

  const base = `${host}/spaces/${encodeURIComponent(spaceId)}/environments/${encodeURIComponent(environment)}`;

  async function request(path, query = {}) {
    const url = new URL(`${base}${path}`);
    url.searchParams.set('access_token', deliveryToken);
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) continue;
      url.searchParams.set(key, String(value));
    }
    const response = await fetchImpl(url.toString(), { headers: { Accept: 'application/json' } });
    let body = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    if (!response.ok) {
      if (response.status === 400 && isUnknownContentType(body)) {
        const type = query.content_type || '?';
        if (!warned.has(type)) {
          warned.add(type);
          warn(`content type "${type}" does not exist in this space yet; treating as empty`);
        }
        return { sys: { type: 'Array' }, total: 0, skip: 0, limit: 0, items: [], includes: {} };
      }
      const detail = body?.message ? `: ${body.message}` : '';
      const error = new Error(`Contentful ${response.status} ${response.statusText || ''}${detail}`.trim());
      error.status = response.status;
      error.body = body;
      throw error;
    }
    return body;
  }

  /** Raw payload for `/entries`. */
  function getEntriesRaw(query = {}) {
    return request('/entries', query);
  }

  /** Resolved entries for `/entries`. */
  async function getEntries(query = {}) {
    return resolve(await getEntriesRaw(query));
  }

  /** One resolved entry by ID (queried via `sys.id` so includes are returned). */
  async function getEntry(id, query = {}) {
    const items = await getEntries({ include: 2, ...query, 'sys.id': id, limit: 1 });
    return items[0] || null;
  }

  async function getSiteSettings() {
    const items = await getEntries({ content_type: 'siteSettings', include: 3, limit: 1 });
    return items[0] || null;
  }

  function getCategories() {
    return getEntries({ content_type: 'vehicleCategory', order: 'fields.order', include: 2, limit: 50 });
  }

  async function getBySlug(contentType, slug, include = 4) {
    const items = await getEntries({ content_type: contentType, 'fields.slug': slug, include, limit: 1 });
    return items[0] || null;
  }

  function getVehiclesInCategory(categoryId) {
    return getEntries({
      content_type: 'vehicle',
      'fields.category.sys.id': categoryId,
      order: 'fields.order',
      include: 2,
      limit: 100,
    });
  }

  function getVariants(vehicleId) {
    return getEntries({
      content_type: 'vehicle',
      'fields.parentModel.sys.id': vehicleId,
      order: 'fields.order',
      include: 1,
      limit: 20,
    });
  }

  function getStories(limit = 3) {
    return getEntries({ content_type: 'story', order: '-fields.publishDate', include: 2, limit });
  }

  function getCurrentVehicles() {
    return getEntries({
      content_type: 'vehicle',
      'fields.status[in]': 'current,motorsport',
      order: 'fields.order',
      include: 2,
      limit: 20,
    });
  }

  function getRetailers() {
    return getEntries({ content_type: 'retailer', order: 'fields.country,fields.city', limit: 200 });
  }

  function getPagesByParent(parentId) {
    return getEntries({
      content_type: 'page',
      'fields.parent.sys.id': parentId,
      order: 'fields.order',
      include: 1,
      limit: 50,
    });
  }

  return {
    config: { spaceId, environment },
    request,
    getEntriesRaw,
    getEntries,
    getEntry,
    getSiteSettings,
    getCategories,
    getBySlug,
    getVehiclesInCategory,
    getVariants,
    getStories,
    getCurrentVehicles,
    getRetailers,
    getPagesByParent,
    assetUrl,
    resolve,
  };
}
