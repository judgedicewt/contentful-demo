/**
 * Provisions seed groups: assets first, then entries.
 *
 * A seed group is `{ name, assets: [], entries: [] }`; see `fields.js` for
 * the entry seed shape and `assets.js` for the asset seed shape.
 *
 * Entries are written in two passes across all selected groups. Pass 1
 * creates or updates every entry as a draft (Contentful does not check link
 * targets until publish, so entries may link forward to entries written
 * later in the run, and cycles such as vehicle <-> story are fine). Pass 2
 * publishes every entry that was written or was not published. An entry
 * whose stored fields deep-equal the desired fields and that is already
 * published is reported as `unchanged` and not touched.
 *
 * All API calls go through one serialised requester that retries on 429.
 */
import { isDeepStrictEqual } from 'node:util';
import { provisionAssets } from './assets.js';
import { describeError, isNotFound } from './errors.js';
import { buildEntryFields, toComparable } from './fields.js';
import { createRequester, isArchived, isPublished } from './requests.js';
import { selectGroups } from './validate.js';

export async function provisionEntries(environment, seedGroups, options = {}) {
  const { only, log = console.log, rootDir, translations } = options;
  const request = options.request ?? createRequester({ log });
  const groups = selectGroups(seedGroups, only);
  const summary = {
    assets: { created: 0, updated: 0, published: 0, unchanged: 0 },
    entries: { created: 0, updated: 0, published: 0, unchanged: 0 },
    failures: [],
  };
  const pending = [];

  for (const group of groups) {
    log(`\nGroup "${group.name}"`);
    if (group.assets?.length) {
      await provisionAssets(environment, group.assets, { log, request, rootDir, summary: summary.assets });
    }
    for (const seed of group.entries ?? []) {
      const result = await writeEntry(environment, seed, { request, log, translations });
      if (result.action === 'unchanged') {
        summary.entries.unchanged += 1;
        log(`  unchanged ${seed.contentType}/${seed.id} (v${result.entry.sys.publishedVersion})`);
      } else {
        pending.push({ seed, ...result });
      }
    }
  }

  if (pending.length > 0) log(`\nPublishing ${pending.length} entr${pending.length === 1 ? 'y' : 'ies'}`);
  for (const item of pending) {
    try {
      const published = await request(`publish entry ${item.seed.id}`, () => item.entry.publish());
      summary.entries[item.action] += 1;
      log(`  ${item.action.padEnd(9)} ${item.seed.contentType}/${item.seed.id} (v${published.sys.publishedVersion})`);
    } catch (error) {
      summary.failures.push({ id: item.seed.id, contentType: item.seed.contentType, error: describeError(error) });
      log(`  FAILED    ${item.seed.contentType}/${item.seed.id}: ${describeError(error)}`);
    }
  }

  return summary;
}

/** Creates or updates one entry as a draft. Returns `{ action, entry }`. */
async function writeEntry(environment, seed, { request, translations }) {
  const fields = buildEntryFields(seed, { translations });
  let entry = null;
  try {
    entry = await request(`get entry ${seed.id}`, () => environment.getEntry(seed.id));
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }

  if (!entry) {
    const created = await request(`create entry ${seed.id}`, () =>
      environment.createEntryWithId(seed.contentType, seed.id, { fields }),
    );
    return { action: 'created', entry: created };
  }

  const storedType = entry.sys.contentType?.sys?.id;
  if (storedType !== seed.contentType) {
    throw new Error(
      `Entry "${seed.id}" exists with content type "${storedType}" but the seed says "${seed.contentType}". Delete it first.`,
    );
  }

  if (isArchived(entry)) entry = await request(`unarchive entry ${seed.id}`, () => entry.unarchive());

  if (sameFields(entry.fields, fields)) {
    return { action: isPublished(entry) ? 'unchanged' : 'published', entry };
  }

  entry.fields = fields;
  const updated = await request(`update entry ${seed.id}`, () => entry.update());
  return { action: 'updated', entry: updated };
}

export function sameFields(stored, desired) {
  return isDeepStrictEqual(toComparable(stored ?? {}), toComparable(desired));
}
