/**
 * Prefetching for vehicle families. After a vehicle page renders, the other
 * members of its family are fetched at idle so a variant switch is served
 * from the client cache. Opening the variant menu warms the hero images
 * listed on its links.
 */

/** Slugs of the other vehicles in the family of `data.entry`, root first, in menu order. */
export function siblingSlugs(data) {
  const entry = data?.entry;
  if (!entry?.fields) return [];
  const root = entry.fields.parentModel?.fields ? entry.fields.parentModel : entry;
  const seen = new Set([entry.sys?.id]);
  const slugs = [];
  for (const candidate of [root, ...(Array.isArray(data.variants) ? data.variants : [])]) {
    const id = candidate?.sys?.id;
    const slug = candidate?.fields?.slug;
    if (!id || !slug || seen.has(id)) continue;
    seen.add(id);
    slugs.push(String(slug));
  }
  return slugs;
}

function idleSchedule(fn) {
  const ric = globalThis.requestIdleCallback;
  if (typeof ric === 'function') {
    const id = ric(fn, { timeout: 2000 });
    return () => globalThis.cancelIdleCallback?.(id);
  }
  const id = setTimeout(fn, 200);
  return () => clearTimeout(id);
}

/**
 * Schedules a fetch of every sibling's full entry (include depth 4, matching
 * the route loader). Returns a cancel function. Failures are ignored: the
 * route loader will fetch again on demand.
 */
export function prefetchFamily(cda, data, { schedule = idleSchedule } = {}) {
  const slugs = siblingSlugs(data);
  if (!slugs.length) return () => {};
  return schedule(() => {
    for (const slug of slugs) {
      Promise.resolve()
        .then(() => cda.getBySlug('vehicle', slug, 4))
        .catch(() => {});
    }
  });
}

/** Starts loading the hero images named on a variant menu's links (not the current one). */
export function warmHeroImages(menu, { createImage = () => new Image() } = {}) {
  const links = menu?.querySelectorAll?.('a[data-hero-srcset], a[data-hero-src]') || [];
  for (const link of links) {
    if (link.hasAttribute('aria-current')) continue;
    const img = createImage();
    img.sizes = '100vw';
    if (link.dataset.heroSrcset) img.srcset = link.dataset.heroSrcset;
    if (link.dataset.heroSrc) img.src = link.dataset.heroSrc;
  }
}
