/**
 * Asset seeds derived from the placeholder manifest. One Contentful asset
 * per generated SVG, keyed by the manifest ID so seed authors can reference
 * images with `assetId(slug, purpose)`.
 */
import { MANIFEST } from '../placeholders/manifest.js';

/** Returns the asset ID for a slug and purpose, e.g. assetId('750s', 'hero'). */
export function assetId(slug, purpose) {
  return `img-${slug}-${purpose}`;
}

export const ASSET_SEEDS = MANIFEST.map((entry) => {
  return {
    id: entry.id,
    title: entry.label,
    description: `${entry.label}`,
    file: `assets/placeholders/${entry.id}.svg`,
    contentType: 'image/svg+xml',
  };
});

export const ASSET_GROUP = { name: 'assets', assets: ASSET_SEEDS, entries: [] };
