/**
 * Creates or updates content types, then publishes them.
 *
 * Two passes: the model has link validations that form cycles (link -> page
 * -> bannerButton -> link), and Contentful only resolves `linkContentType`
 * targets when the referencing type is published. Pass 1 creates or updates
 * every type as a draft; pass 2 publishes every type that changed or was
 * not published. Types whose definition already matches and that are
 * published are reported as `unchanged` and not touched.
 */
import { isDeepStrictEqual } from 'node:util';
import { isNotFound } from './errors.js';
import { createRequester, isPublished } from './requests.js';

export async function provisionContentTypes(environment, contentTypes, { log = console.log, request } = {}) {
  request ??= createRequester({ log });
  const summary = { created: 0, updated: 0, published: 0, unchanged: 0 };
  const pending = [];

  log('Content types');
  for (const definition of contentTypes) {
    const { id, ...body } = definition;
    let existing = null;
    try {
      existing = await request(`get content type ${id}`, () => environment.getContentType(id));
    } catch (error) {
      if (!isNotFound(error)) throw error;
    }

    if (!existing) {
      const created = await request(`create content type ${id}`, () => environment.createContentTypeWithId(id, body));
      pending.push({ id, contentType: created, action: 'created' });
      continue;
    }

    if (sameContentType(existing, body)) {
      if (isPublished(existing)) {
        summary.unchanged += 1;
        log(`  unchanged ${id} (v${existing.sys.publishedVersion})`);
      } else {
        pending.push({ id, contentType: existing, action: 'published' });
      }
      continue;
    }

    existing.name = body.name;
    existing.description = body.description;
    existing.displayField = body.displayField;
    existing.fields = body.fields;
    const updated = await request(`update content type ${id}`, () => existing.update());
    pending.push({ id, contentType: updated, action: 'updated' });
  }

  for (const item of pending) {
    const published = await request(`publish content type ${item.id}`, () => item.contentType.publish());
    summary[item.action] += 1;
    log(`  ${item.action.padEnd(9)} ${item.id} (v${published.sys.publishedVersion})`);
  }

  return summary;
}

/** True when the stored content type already matches the definition. */
export function sameContentType(existing, definition) {
  return isDeepStrictEqual(normaliseContentType(existing), normaliseContentType(definition));
}

export function normaliseContentType(type) {
  return {
    name: type.name,
    description: type.description ?? '',
    displayField: type.displayField,
    fields: (type.fields ?? []).map(normaliseField),
  };
}

function normaliseField(field) {
  const normalised = {
    id: field.id,
    name: field.name,
    type: field.type,
    localized: Boolean(field.localized),
    required: Boolean(field.required),
    disabled: Boolean(field.disabled),
    omitted: Boolean(field.omitted),
    validations: stripNullish(field.validations ?? []),
  };
  if (field.linkType) normalised.linkType = field.linkType;
  if (field.items) {
    normalised.items = { type: field.items.type, validations: stripNullish(field.items.validations ?? []) };
    if (field.items.linkType) normalised.items.linkType = field.items.linkType;
  }
  if (field.defaultValue !== undefined) normalised.defaultValue = stripNullish(field.defaultValue);
  return normalised;
}

/** Removes null/undefined properties recursively (the API echoes `flags: null` and similar). */
function stripNullish(value) {
  if (Array.isArray(value)) return value.map(stripNullish);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== null && v !== undefined)
        .map(([k, v]) => [k, stripNullish(v)]),
    );
  }
  return value;
}
