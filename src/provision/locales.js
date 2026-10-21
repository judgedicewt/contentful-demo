/**
 * Creates or updates the locales the content model needs.
 *
 * Locales are matched by code. A locale whose settings already match the
 * definition is reported as `unchanged` and not touched. Nothing is deleted.
 */
import { createRequester } from './requests.js';

const COMPARED = ['name', 'fallbackCode', 'optional', 'contentDeliveryApi', 'contentManagementApi'];

export async function ensureLocales(environment, locales, { log = console.log, request } = {}) {
  request ??= createRequester({ log });
  const summary = { created: 0, updated: 0, unchanged: 0 };

  log('Locales');
  const { items } = await request('get locales', () => environment.getLocales());

  for (const definition of locales) {
    const { code } = definition;
    const existing = items.find((locale) => locale.code === code);

    if (!existing) {
      await request(`create locale ${code}`, () => environment.createLocale(definition));
      summary.created += 1;
      log(`  ${'created'.padEnd(9)} ${code}`);
      continue;
    }

    if (sameLocale(existing, definition)) {
      summary.unchanged += 1;
      log(`  ${'unchanged'.padEnd(9)} ${code}`);
      continue;
    }

    for (const key of COMPARED) existing[key] = definition[key];
    await request(`update locale ${code}`, () => existing.update());
    summary.updated += 1;
    log(`  ${'updated'.padEnd(9)} ${code}`);
  }

  return summary;
}

/** True when the stored locale already matches the definition. */
export function sameLocale(existing, definition) {
  return COMPARED.every((key) => normalise(existing[key]) === normalise(definition[key]));
}

// The API returns `fallbackCode: null` for no fallback; treat null and undefined alike.
function normalise(value) {
  return value ?? null;
}
