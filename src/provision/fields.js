/**
 * Turns an entry seed into the `fields` payload the Management API expects.
 *
 * Seed shape:
 *   {
 *     id: 'vehicle-750s',
 *     contentType: 'vehicle',
 *     fields: { name: '750S', order: 1, location: { lat, lon }, answer: richTextDocument },
 *     links:  { category: 'cat-supercars', relatedStories: ['story-a', 'story-b'] },
 *     assets: { heroImage: 'img-750s-hero', downloads: ['img-a', 'img-b'] },
 *   }
 *
 * Every plain value is localised to `en-US`. Rich text documents
 * (`nodeType: 'document'`) and Location objects (`{ lat, lon }`) are passed
 * through unchanged under the locale key. `links` become Entry links and
 * `assets` become Asset links; an array produces an array of links.
 */
export const LOCALE = 'en-US';

export function entryLink(id) {
  return { sys: { type: 'Link', linkType: 'Entry', id } };
}

export function assetLink(id) {
  return { sys: { type: 'Link', linkType: 'Asset', id } };
}

export function localise(value) {
  return { [LOCALE]: value };
}

function mapLinks(value, toLink) {
  return Array.isArray(value) ? value.map(toLink) : toLink(value);
}

export function buildEntryFields(seed) {
  const fields = {};
  for (const [fieldId, value] of Object.entries(seed.fields ?? {})) {
    if (value === undefined) continue;
    fields[fieldId] = localise(value);
  }
  for (const [fieldId, value] of Object.entries(seed.links ?? {})) {
    if (value === undefined) continue;
    fields[fieldId] = localise(mapLinks(value, entryLink));
  }
  for (const [fieldId, value] of Object.entries(seed.assets ?? {})) {
    if (value === undefined) continue;
    fields[fieldId] = localise(mapLinks(value, assetLink));
  }
  return fields;
}

/** Drops `undefined` values so payloads compare equal to what the API returns. */
export function toComparable(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}
