/**
 * Asset seeds derived from the placeholder manifest. One Contentful asset
 * per manifest entry, keyed by the manifest ID so seed authors can reference
 * images with `assetId(slug, purpose)`. A slot uses its generated WebP photo
 * when the file exists on disk and otherwise keeps its SVG placeholder, so
 * provisioning works at any point of a partial photo rollout.
 */
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MANIFEST } from '../placeholders/manifest.js';
import { photoForAsset } from '../photos/slots.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

export { assetId } from './asset-id.js';

/**
 * Builds the asset seeds. `fileExists(repoRelativePath)` decides whether a
 * slot's photo is available.
 */
export function buildAssetSeeds({ fileExists }) {
  return MANIFEST.map((entry) => {
    const shot = photoForAsset(entry.id);
    const usePhoto = Boolean(shot) && fileExists(shot.file);
    return {
      id: entry.id,
      title: entry.label,
      description: `${entry.label}`,
      file: usePhoto ? shot.file : `assets/placeholders/${entry.id}.svg`,
      contentType: usePhoto ? 'image/webp' : 'image/svg+xml',
    };
  });
}

export const ASSET_SEEDS = buildAssetSeeds({ fileExists: (path) => existsSync(resolve(ROOT, path)) });

export const ASSET_GROUP = { name: 'assets', assets: ASSET_SEEDS, entries: [] };
