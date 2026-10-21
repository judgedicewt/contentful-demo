/**
 * Leaf module for asset ID helpers. Kept separate from `assets.js` (which
 * imports the photo manifest, which imports `vehicles.js`) so seed files can
 * reference assets without creating an import cycle.
 */

/** Returns the asset ID for a slug and purpose, e.g. assetId('750s', 'hero'). */
export function assetId(slug, purpose) {
  return `img-${slug}-${purpose}`;
}
