/**
 * Creates or updates assets with fixed IDs from local files.
 *
 * Asset seed shape:
 *   { id: 'img-750s-hero', title: '750S hero', description: '...',
 *     file: 'assets/placeholders/img-750s-hero.svg', contentType: 'image/svg+xml' }
 *
 * Flow per asset: upload the bytes (`createUpload`), create or update the
 * asset pointing its file at the upload (`uploadFrom`), trigger processing
 * for all locales, wait until the processed file has a URL, then publish.
 * An asset that is already published with the same title, description,
 * file name and content type is reported as `unchanged` and not re-uploaded.
 */
import { readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOCALE } from './fields.js';
import { isNotFound } from './errors.js';
import { createRequester, isArchived, isPublished } from './requests.js';

export const PROJECT_ROOT = fileURLToPath(new URL('../../', import.meta.url));

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function provisionAssets(environment, assetSeeds, options = {}) {
  const { log = console.log, rootDir = PROJECT_ROOT, sleep = defaultSleep, readFile = readFileSync } = options;
  const request = options.request ?? createRequester({ log });
  const summary = options.summary ?? { created: 0, updated: 0, published: 0, unchanged: 0 };

  for (const seed of assetSeeds) {
    const fileName = basename(seed.file);
    let asset = null;
    try {
      asset = await request(`get asset ${seed.id}`, () => environment.getAsset(seed.id));
    } catch (error) {
      if (!isNotFound(error)) throw error;
    }

    if (asset && isPublished(asset) && sameAssetMetadata(asset, seed, fileName)) {
      summary.unchanged += 1;
      log(`  unchanged asset/${seed.id} (v${asset.sys.publishedVersion})`);
      continue;
    }

    const bytes = readFile(resolve(rootDir, seed.file));
    const upload = await request(`upload ${seed.file}`, () => environment.createUpload({ file: bytes }));
    const fields = assetFields(seed, fileName, upload.sys.id);

    let action;
    if (!asset) {
      asset = await request(`create asset ${seed.id}`, () => environment.createAssetWithId(seed.id, { fields }));
      action = 'created';
    } else {
      if (isArchived(asset)) asset = await request(`unarchive asset ${seed.id}`, () => asset.unarchive());
      asset.fields = fields;
      asset = await request(`update asset ${seed.id}`, () => asset.update());
      action = 'updated';
    }

    asset = await processAsset(environment, asset, seed.id, { request, sleep });
    asset = await request(`publish asset ${seed.id}`, () => asset.publish());
    summary[action] += 1;
    log(`  ${action.padEnd(9)} asset/${seed.id} (v${asset.sys.publishedVersion})`);
  }

  return summary;
}

export function assetFields(seed, fileName, uploadId) {
  const fields = {
    title: { [LOCALE]: seed.title },
    file: {
      [LOCALE]: {
        contentType: seed.contentType,
        fileName,
        uploadFrom: { sys: { type: 'Link', linkType: 'Upload', id: uploadId } },
      },
    },
  };
  if (seed.description !== undefined) fields.description = { [LOCALE]: seed.description };
  return fields;
}

export function sameAssetMetadata(asset, seed, fileName = basename(seed.file)) {
  const file = asset.fields?.file?.[LOCALE];
  return Boolean(
    file?.url &&
      file.fileName === fileName &&
      file.contentType === seed.contentType &&
      asset.fields?.title?.[LOCALE] === seed.title &&
      (asset.fields?.description?.[LOCALE] ?? undefined) === (seed.description ?? undefined),
  );
}

/** Triggers processing and waits until the processed file has a URL. */
async function processAsset(environment, asset, id, { request, sleep, attempts = 30, interval = 1000 }) {
  try {
    const processed = await request(`process asset ${id}`, () =>
      asset.processForAllLocales({ processingCheckWait: 1000, processingCheckRetries: 10 }),
    );
    if (processed.fields?.file?.[LOCALE]?.url) return processed;
  } catch (error) {
    if (error?.name !== 'AssetProcessingTimeout') throw error;
  }
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    await sleep(interval);
    const current = await request(`poll asset ${id}`, () => environment.getAsset(id));
    if (current.fields?.file?.[LOCALE]?.url) return current;
  }
  throw new Error(`Asset ${id} was not processed after ${attempts} checks; the file may be damaged.`);
}
