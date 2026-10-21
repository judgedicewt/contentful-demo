# Japanese locale implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `ja-JP` locale to the space, Japanese values for every seeded entry, and a Japanese version of the site under `#/ja/...` with a header switcher.

**Architecture:** Provisioning gains a locale step and a translation overlay (`src/seed/ja-JP/`) that `buildEntryFields` merges into `{ 'en-US', 'ja-JP' }` per localized field, with coverage enforced by the dry run. The front end carries a language on every route (`lang: 'en' | 'ja'`), reads the Delivery API through a locale-bound client, and renders chrome strings from a two-language dictionary.

**Tech Stack:** Node 18+ ES modules, `node --test`, contentful-management SDK, static ES-module front end with no build step.

**Spec:** `docs/superpowers/specs/2026-10-21-japanese-locale-design.md`

## Global constraints

- No new packages, bundlers, or frameworks. The front end stays a static ES-module app.
- Modules under `site/js/` must not touch `document` or `window` at import time. Only `site/app.js` touches the DOM at module level.
- All markup goes through the escaping `html` tag from `site/js/dom.js`; `raw()` only for fixed literal fragments.
- `test/preload.test.js` requires `site/index.html` to `modulepreload` every module under `site/` and nothing else. A new module under `site/js/` needs a matching `<link rel="modulepreload">`.
- Tests use `import { test } from 'node:test'` and `node:assert/strict`, fixtures under `test/fixtures/`, no network.
- English seed files under `src/seed/*.js` are not edited for content. Japanese lives only in `src/seed/ja-JP/`.
- Not localized, ever: slugs, `order`, `status`, `bodyStyle`, `heroStyle`, `variant`, `theme`, `layout`, `area`, `group`, `style`, URLs, `externalUrl`, `endpoint`, `phone`, `website`, `locale`, asset links, entry links, dates, numbers, booleans, locations.
- Credentials come from the process environment. Never print a token. The management token never ships in the static site. Nothing in this plan deletes anything in the space.
- Only the orchestrator runs `scripts/setup.js` against the space. Implementers run it with `--dry-run` only.
- Never disable TLS verification or unset `HTTPS_PROXY`.
- Translation agents run on the fast tier, one per dispatch below; the spot check runs on the standard tier. No translation on the most capable tier.
- Prose (comments, docs, commit messages) follows the Google developer documentation style: sentence case, active voice, no em dashes, no exclamation points, second person.
- No model identifiers in any file in the repository.
- Each commit message ends with these two trailer lines, exactly:

  ```
  Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_019nTnpAxKvoPvNovGUrAM9D
  ```

## Review focus

1. A route hash with the prefix in another case or with a trailing slash (`#/JA/750s/`, `#/ja/`) must still match as Japanese. Pinned in Task 7.
2. A CMS `link` entry whose `externalUrl` is an internal hash (`#/retailers`) must pick up the `#/ja` prefix under Japanese; an `https://` URL must not. Pinned in Task 7.
3. Switching language from `#/ja/enquire/750s` must land on `#/enquire/750s`, and from `#/ja` on `#/`, with no doubled prefix. Pinned in Task 7.
4. `t()` with an unknown key or a missing placeholder value must not throw and must never print `undefined`. Pinned in Task 6.
5. Switching `en` to `ja` and back must not serve Japanese data for English: the Delivery cache keys include the locale. Pinned in Task 8.

## Model tiers

| Role | Tier |
|---|---|
| Implementers (Tasks 1 to 3, 6 to 11) | standard |
| Per-task reviewers | standard |
| Translation agents (Task 4, nine dispatches) | fast |
| Translation spot check (Task 5) | standard |
| Final whole-branch review | most capable |

## File structure

| Path | Responsibility |
|---|---|
| `src/content-model.js` | `LOCALES`, `DEFAULT_LOCALE`, `localized: true` flags |
| `src/provision/locales.js` (new) | `ensureLocales` |
| `src/provision/fields.js` | `buildEntryFields(seed, { translations })`, `needsTranslation` |
| `src/provision/validate.js` | overlay checks, `translationCoverage` |
| `src/seed/ja-JP/GLOSSARY.md` (new) | translator glossary |
| `src/seed/ja-JP/<group>.js` (new, 14 files) | overlays keyed by entry id |
| `src/seed/ja-JP/index.js` (new) | merges overlays into `JA_JP` and `JA_JP_BY_GROUP` |
| `src/seed/index.js` | exports `TRANSLATIONS` |
| `scripts/setup.js`, `scripts/verify-content.js` | wiring, coverage output, two-locale verify |
| `site/js/i18n.js` (new) | `LANGS`, `LOCALES`, `STRINGS`, `t` |
| `site/js/router.js` | `lang` on routes, `withLang`, `hashForLang`, lang-aware `routeFor` and `linkHref` |
| `site/js/cda.js` | `forLocale` |
| `site/js/shell.js`, `site/js/render/*.js`, `site/js/enquiry.js` | dictionary strings, `ctx.href`, `data-lang` |
| `site/app.js`, `site/styles.css`, `site/index.html` | language state, shell reload, `<html lang>`, Japanese typography, preload |
| `fusion/enquiry-scenario.blueprint.json`, `docs/fusion-setup.md`, `README.md` | `locale` in the payload, docs |

---

### Task 1: Localized fields and locale constants

**Files:**
- Modify: `src/content-model.js`
- Test: `test/provision.test.js`

**Interfaces:**
- Produces: `export const DEFAULT_LOCALE = 'en-US'`; `export const LOCALES = [{ code: 'ja-JP', name: 'Japanese (Japan)', fallbackCode: 'en-US', optional: true, contentDeliveryApi: true, contentManagementApi: true }]`; `localized: true` on exactly the fields in the table below.

| Type | Localized fields |
|---|---|
| seoMetadata | title, description |
| link | label |
| linkGroup | heading |
| bannerButton | eyebrow, heading, body |
| vehicleCategory | name, intro |
| specification | label, value, unit |
| featureHighlight | title, body, tag |
| mediaSlide | heading, body |
| lineageEntry | title, body |
| faqItem | question, answer |
| textBlock | heading, body |
| imageBlock | caption |
| card | title, body |
| cardGrid, ctaGroup, vehicleGrid, storyGrid | heading |
| story | title, kicker, standfirst |
| vehicle | name, shortDescription, tagline, statement, performanceHeading, performanceBody, lineageIntro |
| page | title, kicker |
| retailer | name, city, country, address |
| enquiryForm | title, intro, submitLabel, consentText, successTitle, successBody, errorBody |
| siteSettings | siteName, newsletterText |

- [ ] **Step 1: Write the failing tests**

```js
test('LOCALES declares ja-JP falling back to en-US', () => {
  assert.equal(DEFAULT_LOCALE, 'en-US');
  assert.deepEqual(LOCALES, [
    { code: 'ja-JP', name: 'Japanese (Japan)', fallbackCode: 'en-US', optional: true, contentDeliveryApi: true, contentManagementApi: true },
  ]);
});

test('exactly the human-readable text fields are localized', () => {
  const EXPECTED = { seoMetadata: ['title', 'description'], link: ['label'], /* ... the table above, every type */ };
  const actual = Object.fromEntries(
    CONTENT_TYPES.map((type) => [type.id, type.fields.filter((f) => f.localized).map((f) => f.id)]).filter(([, ids]) => ids.length),
  );
  assert.deepEqual(actual, EXPECTED);
  for (const type of CONTENT_TYPES) for (const field of type.fields) {
    if (!field.localized) continue;
    assert.ok(['Symbol', 'Text', 'RichText'].includes(field.type), `${type.id}.${field.id} is ${field.type}`);
    assert.ok(!(field.validations || []).some((v) => v.in), `${type.id}.${field.id} is an enum`);
  }
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/provision.test.js`
Expected: FAIL, `LOCALES` is not exported and the localized map is empty.

- [ ] **Step 3: Add `DEFAULT_LOCALE`, `LOCALES`, and the `localized: true` flags in `src/content-model.js`**

Replace the private `const LOCALE = 'en-US'` with the exported `DEFAULT_LOCALE`. Add the flag inline on each field object in the table; the `symbolIn` helper never gets it.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: all pass. `validateContentModel` already accepts `localized`.

- [ ] **Step 5: Commit**

```bash
git add src/content-model.js test/provision.test.js
git commit -m "Mark text fields localized and declare the ja-JP locale"
```

---

### Task 2: Locale provisioning

**Files:**
- Create: `src/provision/locales.js`
- Modify: `scripts/setup.js`
- Test: `test/provision.test.js`

**Interfaces:**
- Consumes: `LOCALES` from Task 1; `createRequester` from `src/provision/requests.js`; the SDK's `environment.getLocales()` (returns `{ items }`), `environment.createLocale(props)`, `locale.update()`.
- Produces: `export async function ensureLocales(environment, locales, { log = console.log, request } = {})` returning `{ created, updated, unchanged }`; `export function sameLocale(existing, definition)` comparing `name`, `fallbackCode`, `optional`, `contentDeliveryApi`, `contentManagementApi`.

- [ ] **Step 1: Write the failing tests**

```js
function fakeEnvironment(items) {
  const calls = [];
  return {
    calls,
    getLocales: async () => ({ items }),
    createLocale: async (props) => { calls.push(['create', props]); return { ...props, sys: { id: 'l1' } }; },
  };
}

test('ensureLocales creates a missing locale', async () => {
  const env = fakeEnvironment([{ code: 'en-US', name: 'English (United States)', default: true }]);
  const summary = await ensureLocales(env, LOCALES, { log: () => {}, request: (_, fn) => fn() });
  assert.deepEqual(summary, { created: 1, updated: 0, unchanged: 0 });
  assert.equal(env.calls[0][1].code, 'ja-JP');
  assert.equal(env.calls[0][1].fallbackCode, 'en-US');
});

test('ensureLocales updates a locale whose fallback differs and leaves a matching one alone', async () => {
  let updated = 0;
  const stale = { code: 'ja-JP', name: 'Japanese (Japan)', fallbackCode: null, optional: true, contentDeliveryApi: true, contentManagementApi: true, update: async function () { updated += 1; return this; } };
  const env = fakeEnvironment([stale]);
  assert.deepEqual(await ensureLocales(env, LOCALES, { log: () => {}, request: (_, fn) => fn() }), { created: 0, updated: 1, unchanged: 0 });
  assert.equal(updated, 1);
  assert.equal(stale.fallbackCode, 'en-US');
  const fresh = fakeEnvironment([{ ...LOCALES[0], update: async () => { throw new Error('must not update'); } }]);
  assert.deepEqual(await ensureLocales(fresh, LOCALES, { log: () => {}, request: (_, fn) => fn() }), { created: 0, updated: 0, unchanged: 1 });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/provision.test.js`
Expected: FAIL, cannot find module `locales.js`.

- [ ] **Step 3: Implement `ensureLocales` and `sameLocale` in `src/provision/locales.js`**

Match by `code`. For an update, assign the five compared properties onto the existing locale object and call `update()` through `request('update locale ja-JP', ...)`. Log one line per locale in the style of `provisionContentTypes` (`created`, `updated`, `unchanged`).

- [ ] **Step 4: Wire it into `scripts/setup.js`**

In the real run, before `provisionContentTypes` and only when `!flags.only`: `const locales = await ensureLocales(environment, LOCALES, { log: console.log, request }); console.log(\`  ${summarise(locales)}\`);`. Add `Locales` to the header comment and to the `--types-only` description.

- [ ] **Step 5: Run the tests and the dry run**

Run: `npm test && node scripts/setup.js --dry-run`
Expected: tests pass; dry run passes (no locale calls happen in a dry run).

- [ ] **Step 6: Commit**

```bash
git add src/provision/locales.js scripts/setup.js test/provision.test.js
git commit -m "Ensure the ja-JP locale during setup"
```

---

### Task 3: Translation overlays in provisioning

**Files:**
- Create: `src/seed/ja-JP/index.js`, `src/seed/ja-JP/GLOSSARY.md`, and one empty overlay per group: `src/seed/ja-JP/specifications.js`, `highlights.js`, `slides.js`, `lineage.js`, `faqs.js`, `categories.js`, `vehicles.js`, `links.js`, `sections.js`, `stories.js`, `pages.js`, `retailers.js`, `site.js`, `enquiry.js`
- Modify: `src/seed/index.js`, `src/provision/fields.js`, `src/provision/validate.js`, `src/provision/entries.js`, `scripts/setup.js`, `scripts/verify-content.js`
- Test: `test/provision.test.js`

**Interfaces:**
- Consumes: `CONTENT_TYPES` with `localized` flags (Task 1).
- Produces:
  - Each overlay file: `export default { [entryId]: { [fieldId]: value } }`. Rich text values use `doc`, `p`, `h2`, `h3`, `ul`, `bold` from `../richtext-helpers.js`.
  - `src/seed/ja-JP/index.js`: `export const JA_JP_BY_GROUP = { specifications, highlights, slides, lineage, faqs, categories, vehicles, links, sections, stories, pages, retailers, site, enquiry }` (keys are the seed group names) and `export const JA_JP = Object.assign({}, ...Object.values(JA_JP_BY_GROUP))`.
  - `src/seed/index.js`: `export const TRANSLATIONS = { 'ja-JP': JA_JP }`.
  - `buildEntryFields(seed, { translations = {} } = {})`: for each `seed.fields` entry emits `{ 'en-US': value, [locale]: translated }` for every locale in `translations` that has `translations[locale][seed.id][fieldId] !== undefined`. `links` and `assets` stay `{ 'en-US': ... }`.
  - `export function needsTranslation(value)`: `true` for a rich text document; for a string, `/\p{L}/u.test(value)`; `false` otherwise (numbers, booleans, objects, empty strings).
  - `validateSeeds(seedGroups, contentTypes, { only, fileExists, translations })`: three new problem kinds for selected groups: `unknown-translation-entry` (overlay id no seed declares; attributed to the group whose overlay holds it, see below), `unknown-translation-field` (field not on the type, or not `localized`), `untranslated` (seed field is localized, `needsTranslation(value)` is true, and the overlay has no value). `translations` is `{ [locale]: { [entryId]: { [fieldId]: value } } }`.
  - `export function translationCoverage(seedGroups, contentTypes, translations, { only } = {})` returning `[{ group, locale, translated, total }]` per selected group and locale, where `total` counts localized fields with `needsTranslation(value)` and `translated` those with an overlay value.
  - `provisionEntries(environment, seedGroups, { only, log, request, translations })` passes `translations` to `buildEntryFields`.

- [ ] **Step 1: Write the failing tests**

```js
test('needsTranslation is true for words and rich text, false for numbers', () => {
  assert.equal(needsTranslation('Top speed'), true);
  assert.equal(needsTranslation('7 speed'), true);
  assert.equal(needsTranslation('750'), false);
  assert.equal(needsTranslation('2.9'), false);
  assert.equal(needsTranslation(''), false);
  assert.equal(needsTranslation(12), false);
  assert.equal(needsTranslation(richText), true);
  assert.equal(needsTranslation({ lat: 1, lon: 2 }), false);
});

test('buildEntryFields merges overlay values under their locale', () => {
  const translations = { 'ja-JP': { x: { label: '最高速度' } } };
  const fields = buildEntryFields({ id: 'x', contentType: 'specification', fields: { label: 'Top speed', order: 2 }, links: { vehicle: 'v' } }, { translations });
  assert.deepEqual(fields.label, { 'en-US': 'Top speed', 'ja-JP': '最高速度' });
  assert.deepEqual(fields.order, { 'en-US': 2 });
  assert.deepEqual(Object.keys(fields.vehicle), ['en-US']);
  assert.deepEqual(buildEntryFields({ id: 'x', contentType: 'specification', fields: { label: 'Top speed' } }).label, { 'en-US': 'Top speed' });
});

test('validateSeeds reports untranslated and unknown overlay keys', () => {
  const groups = validGroups();
  const bad = { 'ja-JP': { 'cat-supercars': { name: 'スーパーカー', slug: 'x' }, 'no-such-entry': { name: 'y' } } };
  const kinds = validateSeeds(groups, CONTENT_TYPES, { translations: bad }).map((p) => `${p.kind}:${p.id}:${p.field ?? ''}`);
  assert.ok(kinds.includes('unknown-translation-field:cat-supercars:slug'));
  assert.ok(kinds.includes('unknown-translation-entry:no-such-entry:'));
  assert.ok(kinds.includes('untranslated:vehicle-750s:name'));
  assert.ok(!kinds.includes('untranslated:cat-supercars:name'));
  assert.ok(!kinds.includes('untranslated:vehicle-750s:order'));
});

test('translationCoverage counts fields that need translation per group', () => {
  const groups = validGroups();
  const rows = translationCoverage(groups, CONTENT_TYPES, { 'ja-JP': { 'cat-supercars': { name: 'スーパーカー' } } });
  const vehicles = rows.find((r) => r.group === 'vehicles' && r.locale === 'ja-JP');
  assert.equal(vehicles.translated, 1);
  assert.ok(vehicles.total > 1);
  assert.equal(rows.find((r) => r.group === 'media').total, 0);
});

test('the repository seeds, overlays and model validate together', () => {
  const problems = validateSeeds(SEED_GROUPS, CONTENT_TYPES, { translations: TRANSLATIONS }).filter((p) => p.kind !== 'untranslated');
  assert.deepEqual(problems, []);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/provision.test.js`
Expected: FAIL on the missing exports.

- [ ] **Step 3: Create the overlay files and the index**

Each overlay file starts as `export default {};` with a one-line comment naming the English seed file it mirrors. Copy the glossary from the spec's "Overlay files" section into `src/seed/ja-JP/GLOSSARY.md`, adding a short "Overlay format" section with the example object from the spec and the rule that rich text mirrors the English block structure.

- [ ] **Step 4: Implement `needsTranslation` and the `translations` option in `src/provision/fields.js`**

Update the module comment to describe the two-locale output.

- [ ] **Step 5: Implement the overlay checks and `translationCoverage` in `src/provision/validate.js`**

Attribution for `unknown-translation-entry`: report it under group `translations` with `id` set to the overlay key. Only check `untranslated` for entries in selected groups. Reuse `entriesById` from pass 1.

- [ ] **Step 6: Wire `translations` through `provisionEntries`, `scripts/setup.js`, and `scripts/verify-content.js`**

`setup.js`: import `TRANSLATIONS` with `SEED_GROUPS`; pass it to `validateSeeds` and `provisionEntries`; after the group table print one line per coverage row: `  ja-JP coverage  specifications   0/213 fields`. `verify-content.js` does not validate seeds; leave it for Task 11.

- [ ] **Step 7: Run the tests and the dry run**

Run: `npm test && node scripts/setup.js --dry-run; echo "exit $?"`
Expected: tests pass. The dry run prints fourteen coverage lines reading `0/<n>` and exits 1 with `untranslated` problems. That is the intended state until Task 4 completes.

- [ ] **Step 8: Commit**

```bash
git add src/seed/ja-JP src/seed/index.js src/provision scripts/setup.js test/provision.test.js
git commit -m "Merge ja-JP translation overlays into entry fields"
```

---

### Task 4: Translate the seed content (nine fast-tier dispatches)

**Files:**
- Modify: one or more of `src/seed/ja-JP/<group>.js` per dispatch. Nothing else.

**Interfaces:**
- Consumes: the overlay format (Task 3), `src/seed/ja-JP/GLOSSARY.md`, the English seed files, the localized field table (Task 1), the dry-run coverage line.

Dispatches, each a fresh fast-tier agent:

| Dispatch | Overlay files | English sources |
|---|---|---|
| A | `specifications.js` | `src/seed/specifications.js` |
| B | `highlights.js` | `src/seed/highlights.js` |
| C | `slides.js`, `lineage.js` | `src/seed/slides.js`, `src/seed/lineage.js` |
| D | `faqs.js` | `src/seed/faqs.js` |
| E | `vehicles.js` | `src/seed/vehicles.js` |
| F | `sections.js` | `src/seed/sections.js` |
| G | `stories.js` | `src/seed/stories.js` |
| H | `links.js`, `pages.js` | `src/seed/links.js`, `src/seed/pages.js` |
| I | `categories.js`, `retailers.js`, `site.js`, `enquiry.js` | the matching files under `src/seed/` |

Each brief contains: the glossary file path, the source file paths, the overlay example, the localized fields per content type, the rule that a field counts only when `needsTranslation` is true (strings with letters and rich text), and the rules below.

- Keys are the entry ids as the English seed declares them (for generated seeds such as specifications, read how the id is built and reproduce it; run `node -e` against the seed module to list ids when in doubt).
- Translate only localized fields. Model names, MSO, and Latin brand terms stay Latin; copy them unchanged into the overlay so coverage counts them.
- Rich text mirrors the English structure: same helpers, same number of blocks and list items.
- Use the polite です/ます register for body copy and noun phrases for headings. Full-width 、and 。in Japanese sentences. Keep numerals and units.
- Do not edit English seeds, tests, or any file outside your overlay files.

- [ ] **Step 1: Write the overlay**

- [ ] **Step 2: Check coverage for your groups**

Run: `node scripts/setup.js --dry-run 2>&1 | grep -E "ja-JP coverage +(<group>|<group2>) "`
Expected: each of your groups reads `n/n fields`. Other groups may still read `0/n`; ignore them. Also run `node scripts/setup.js --dry-run 2>&1 | grep -E "unknown-translation" ; true` and expect no output for your ids.

- [ ] **Step 3: Run the tests**

Run: `npm test`
Expected: all pass (the repository validation test ignores `untranslated` and fails on unknown ids or fields).

- [ ] **Step 4: Commit**

```bash
git add src/seed/ja-JP/<files>
git commit -m "Add Japanese overlay for <groups>"
```

Orchestrator gate after all nine dispatches: `node scripts/setup.js --dry-run` passes with every coverage line at `n/n`.

---

### Task 5: Translation spot check (standard tier)

**Files:**
- Read: every `src/seed/ja-JP/*.js`, `GLOSSARY.md`, the English seeds.
- Modify: overlay files only, for corrections.

- [ ] **Step 1: Sample and review**

Pick forty strings across all overlays, weighted toward body copy (vehicle statements, FAQ answers, story standfirsts, section bodies, enquiry consent text). For each, compare with the English and check: meaning preserved, glossary terms used, register consistent, no untranslated English sentences left in Japanese fields, no Latin model name transliterated, rich text structure mirrors the English.

- [ ] **Step 2: Apply corrections directly**

Edit the overlay values. Do not touch English seeds.

- [ ] **Step 3: Verify**

Run: `npm test && node scripts/setup.js --dry-run`
Expected: pass, every coverage line `n/n`.

- [ ] **Step 4: Commit**

```bash
git add src/seed/ja-JP
git commit -m "Apply translation spot-check corrections"
```

Report back the forty sampled ids and the number corrected.

---

### Task 6: Chrome-string dictionary

**Files:**
- Create: `site/js/i18n.js`
- Modify: `site/index.html` (add `<link rel="modulepreload" href="js/i18n.js">` in alphabetical position)
- Test: `test/i18n.test.js` (new)

**Interfaces:**
- Produces: `export const LANGS = ['en', 'ja']`; `export const DEFAULT_LANG = 'en'`; `export const LOCALES = { en: 'en-US', ja: 'ja-JP' }`; `export function langOf(value)` returning `'ja'` for `'ja'` or `'ja-JP'`, else `'en'`; `export const STRINGS = { en: {...}, ja: {...} }`; `export function t(key, lang = DEFAULT_LANG, vars = {})`.
- `t` looks up `STRINGS[lang]?.[key] ?? STRINGS.en[key] ?? key`, then replaces each `{name}` with `vars[name]`. When every used var is a string, number, or missing, it returns a string (a missing var renders as `''`). When any used var is an object (a `SafeHtml` from `html`), it returns an array of alternating literal strings and var values, which the `html` tag interpolates with the literals escaped and the objects trusted.

Keys and English values (the Japanese column is written in this task; the spot check in Task 5 has already run, so the reviewer of this task reads the Japanese against the glossary):

| Key | English |
|---|---|
| language | Language |
| skip_to_content | Skip to content |
| site_home | {siteName} home |
| menu | Menu |
| main_navigation | Main |
| models | Models |
| follow_us | Follow us |
| subscribe | Subscribe |
| breadcrumb | Breadcrumb |
| home | Home |
| loading | Loading |
| error | Error |
| error_context | Something went wrong while loading this page. |
| unknown_error | Unknown error |
| content_unavailable | Content unavailable |
| back_to_home | Back to home |
| back_home | Back home |
| back_to | Back to {name} |
| page_not_found | Page not found |
| road_leads_nowhere | This road leads nowhere |
| nothing_published_at | Nothing is published at {path}. |
| nothing_published_here | Nothing is published at this address. |
| not_found_hint | Head back to the start, or look at the cars. |
| explore_models | Explore models |
| explore_supercars | Explore supercars |
| demo_footer_note | Demo site. Content served from Contentful and rendered in the browser; imagery is placeholder artwork. |
| configure | Configure |
| enquire | Enquire |
| explore | Explore |
| read_story | Read story |
| model_categories | Model categories |
| models_of | {name} models |
| current_models | Current models |
| legacy | Legacy |
| continue_your_journey | Continue your journey |
| personalise_with_mso | Personalise with MSO |
| read_latest_story | Read the latest story |
| find_a_retailer | Find a retailer |
| no_models_in_category | No models are listed in this category yet. |
| stories | Stories |
| related_models | Related models |
| more_stories | More stories |
| related_stories | Related stories |
| retailers | Retailers |
| retailers_description | Find a McLaren retailer near you. |
| retailers_lead | Speak to the people who sell and service McLaren road cars near you. |
| no_retailers | No retailers are listed yet. |
| other | Other |
| website | Website |
| view_on_map | View on map |
| previous_models | Previous models |
| next_models | Next models |
| sections_of | {title} sections |
| vehicle_navigation | {name} navigation |
| change_model_variant | Change model variant |
| current | (current) |
| downloads | Downloads |
| download | Download |
| watch_the_film | Watch the film |
| overview | Overview |
| overview_slides | Overview slides |
| previous_slide | Previous slide |
| next_slide | Next slide |
| slide_of | Slide {index} of {total} |
| in_detail | In detail |
| exterior | Exterior |
| interior | Interior |
| specifications | Specifications |
| full_specifications | Full specifications |
| spec_group_performance | Performance |
| spec_group_powertrain | Powertrain |
| spec_group_dimensions | Dimensions |
| spec_group_weight | Weight |
| lineage | Lineage |
| explore_the | Explore the {name} |
| faqs | FAQs |
| placeholder | Placeholder |
| placeholder_body | This destination is a placeholder route in the demo. It marks the integration point for a real configurator, lead form, or legal page. |
| configurator | Configurator |
| configure_your | Configure your {name} |
| enquire_about | {title} about {name} |
| contact_mclaren | Contact McLaren |
| legal | Legal |
| legal_slug | Legal: {slug} |
| coming_soon | Coming soon |
| enquiry | Enquiry |
| enquire_title | Enquire |
| send_enquiry | Send enquiry |
| consent_default | I agree to McLaren Automotive contacting me about this enquiry. This is a demo: submissions create a request in a test Workfront queue. |
| thank_you | Thank you |
| success_default | Your enquiry has been received and a request has been raised with our team. |
| error_default | We could not send your enquiry. Please try again in a moment. |
| full_name | Full name |
| email | Email |
| phone_optional | Phone (optional) |
| country | Country |
| model | Model |
| select_a_model | Select a model |
| models_unavailable | Models could not be loaded. Reload the page to try again. |
| message_optional | Message (optional) |
| leave_empty | Leave this field empty |
| sending | Sending… |
| error_name | Enter your name. |
| error_email | Enter a valid email address. |
| error_country | Enter your country. |
| error_model | Choose a model. |
| error_consent | Tick the consent box to continue. |
| error_message | Keep your message under 2000 characters. |

The implementer may add a key when Task 9 turns up a literal not listed here, in both languages.

- [ ] **Step 1: Write the failing tests**

```js
test('both languages define the same keys and placeholders', () => {
  assert.deepEqual(Object.keys(STRINGS.ja).sort(), Object.keys(STRINGS.en).sort());
  for (const [key, en] of Object.entries(STRINGS.en)) {
    const wanted = [...en.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    const got = [...STRINGS.ja[key].matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    assert.deepEqual(got, wanted, key);
    assert.notEqual(STRINGS.ja[key].trim(), '', key);
  }
});

test('t formats strings, falls back, and never prints undefined', () => {
  assert.equal(t('back_to', 'en', { name: '750S' }), 'Back to 750S');
  assert.equal(t('back_to', 'ja', { name: '750S' }), STRINGS.ja.back_to.replace('{name}', '750S'));
  assert.equal(t('no_such_key', 'ja'), 'no_such_key');
  assert.equal(t('back_to', 'en'), 'Back to ');
  assert.equal(t('home', 'xx'), 'Home');
});

test('t returns parts when a var is markup, and html escapes only the literals', () => {
  const parts = t('nothing_published_at', 'en', { path: html`<code>/x</code>` });
  assert.ok(Array.isArray(parts));
  assert.equal(String(html`${parts}`), 'Nothing is published at <code>/x</code>.');
  assert.equal(String(html`${t('back_to', 'en', { name: html`<b>${'<i>'}</b>` })}`), 'Back to <b>&lt;i&gt;</b>');
});

test('langOf and LOCALES', () => {
  assert.equal(langOf('ja-JP'), 'ja');
  assert.equal(langOf('ja'), 'ja');
  assert.equal(langOf(undefined), 'en');
  assert.deepEqual(LOCALES, { en: 'en-US', ja: 'ja-JP' });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/i18n.test.js test/preload.test.js`
Expected: FAIL (module missing; preload test passes until the file exists, then fails until `index.html` lists it).

- [ ] **Step 3: Implement `site/js/i18n.js` and add the preload link**

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add site/js/i18n.js site/index.html test/i18n.test.js
git commit -m "Add the two-language chrome string dictionary"
```

---

### Task 7: Language on routes

**Files:**
- Modify: `site/js/router.js`
- Test: `test/router.test.js`

**Interfaces:**
- Consumes: `DEFAULT_LANG` from `site/js/i18n.js`.
- Produces:
  - `matchRoute(hash)` returns `{ name, params, lang }` for every route, `lang` being `'ja'` when the first segment (after lowercasing) is `ja`, else `'en'`. The `ja` segment is removed before the existing matching runs. `#/ja` and `#/ja/` are home. The `redirect` route's `to` carries the prefix (`#/ja/current-models/supercars`). The `ignore` route has `lang: 'en'`.
  - `export function withLang(href, lang)`: for `lang === 'ja'` and an `href` starting with `#/`, returns `#/ja` for `#/` and `#/ja/<rest>` otherwise; anything else is returned unchanged.
  - `export function hashForLang(hash, lang)`: strips a leading `ja` segment from `hash`, rebuilds `#/<segments>` (`#/` when empty), then applies `withLang`. Query strings are dropped.
  - `routeFor(entry, lang = 'en')` and `linkHref(link, lang = 'en')` apply `withLang` to hash results. `linkHref` applies it to an `externalUrl` that starts with `#/` too.
  - `loadRoute`, `familyRootId`, `navigate`, `onRouteChange`, `currentRoute` unchanged (`onRouteChange` and `currentRoute` return the new shape through `matchRoute`).

- [ ] **Step 1: Write the failing tests**

```js
test('matchRoute carries lang and strips the ja prefix', () => {
  assert.deepEqual(matchRoute('#/750s'), { name: 'page', params: { slug: '750s' }, lang: 'en' });
  assert.deepEqual(matchRoute('#/ja/750s'), { name: 'page', params: { slug: '750s' }, lang: 'ja' });
  for (const hash of ['#/ja', '#/ja/', '#/JA/', '#/ja/home']) assert.deepEqual(matchRoute(hash), { name: 'home', params: {}, lang: 'ja' }, hash);
  assert.deepEqual(matchRoute('#/JA/750s/'), { name: 'page', params: { slug: '750s' }, lang: 'ja' });
  assert.deepEqual(matchRoute('#/ja/current-models'), { name: 'redirect', params: { to: '#/ja/current-models/supercars' }, lang: 'ja' });
  assert.deepEqual(matchRoute('#/ja/enquire/gts'), { name: 'enquire', params: { slug: 'gts' }, lang: 'ja' });
  assert.deepEqual(matchRoute('#/ja/post/w1-designed-by-air'), { name: 'story', params: { slug: 'w1-designed-by-air' }, lang: 'ja' });
  assert.equal(matchRoute('#/en/750s').name, 'page');
  assert.equal(matchRoute('#main').lang, 'en');
});

test('withLang and hashForLang', () => {
  assert.equal(withLang('#/', 'ja'), '#/ja');
  assert.equal(withLang('#/750s', 'ja'), '#/ja/750s');
  assert.equal(withLang('#/750s', 'en'), '#/750s');
  assert.equal(withLang('https://example.com/#/x', 'ja'), 'https://example.com/#/x');
  assert.equal(hashForLang('#/ja/enquire/750s', 'en'), '#/enquire/750s');
  assert.equal(hashForLang('#/enquire/750s', 'ja'), '#/ja/enquire/750s');
  assert.equal(hashForLang('#/ja', 'en'), '#/');
  assert.equal(hashForLang('#/ja/750s', 'ja'), '#/ja/750s');
  assert.equal(hashForLang('', 'ja'), '#/ja');
});

test('routeFor and linkHref prefix hash routes for ja', () => {
  assert.equal(routeFor(entry('vehicle', { slug: '750s' }), 'ja'), '#/ja/750s');
  assert.equal(routeFor(entry('page', { slug: 'home' }), 'ja'), '#/ja');
  assert.equal(routeFor(entry('vehicleCategory', { slug: 'supercars' }), 'ja'), '#/ja/current-models/supercars');
  assert.equal(linkHref(entry('link', { externalUrl: '#/retailers' }), 'ja'), '#/ja/retailers');
  assert.equal(linkHref(entry('link', { externalUrl: 'https://example.com' }), 'ja'), 'https://example.com');
  assert.equal(linkHref(entry('link', { target: entry('story', { slug: 's' }) }), 'ja'), '#/ja/post/s');
  assert.equal(linkHref(entry('link', { externalUrl: '#/retailers' })), '#/retailers');
});
```

Update every existing `matchRoute` deep-equality assertion in `test/router.test.js` to include `lang: 'en'`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/router.test.js`
Expected: FAIL on the missing `lang` and exports.

- [ ] **Step 3: Implement the changes in `site/js/router.js`**

Update the route table comment with the `/ja/...` prefix line.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: all pass. `scripts/verify-content.js` reads only `route.name` and `route.params`, so it is unaffected.

- [ ] **Step 5: Commit**

```bash
git add site/js/router.js test/router.test.js
git commit -m "Carry a language on every route"
```

---

### Task 8: Locale-bound Delivery client

**Files:**
- Modify: `site/js/cda.js`
- Test: `test/cda.test.js`

**Interfaces:**
- Produces: `createClient(config, options)` accepts an optional `config.locale`; every request adds `locale=<code>` when set. `client.forLocale(code)` returns a client with the same API and `config.locale = code`, sharing the response cache and the unknown-type warning set with the client it came from. `client.config` is `{ spaceId, environment, locale }`.

- [ ] **Step 1: Write the failing tests**

```js
test('forLocale adds the locale to every request and shares the cache', async () => {
  const urls = [];
  const fakeFetch = async (url) => { urls.push(new URL(url)); return { ok: true, json: async () => ({ items: [], includes: {} }) }; };
  const base = createClient({ spaceId: 'space', deliveryToken: 'tok' }, { fetch: fakeFetch });
  const ja = base.forLocale('ja-JP');
  const en = base.forLocale('en-US');
  await base.getEntries({ content_type: 'vehicle' });
  await ja.getEntries({ content_type: 'vehicle' });
  await en.getEntries({ content_type: 'vehicle' });
  await ja.getEntries({ content_type: 'vehicle' });
  assert.deepEqual(urls.map((u) => u.searchParams.get('locale')), [null, 'ja-JP', 'en-US']);
  assert.equal(ja.config.locale, 'ja-JP');
  assert.equal(base.config.locale, undefined);
  assert.equal(typeof ja.forLocale, 'function');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/cda.test.js`
Expected: FAIL, `forLocale` is not a function.

- [ ] **Step 3: Implement `forLocale` in `site/js/cda.js`**

Move the API construction into an inner `api(locale)` that closes over the shared `cache`, `warned`, `base`, and `fetchImpl`; `request` merges `locale` into the query before `buildUrl`. `createClient` returns `api(config.locale)`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add site/js/cda.js test/cda.test.js
git commit -m "Bind the Delivery client to a locale"
```

---

### Task 9: Templates, shell, and the enquiry form speak the route's language

**Files:**
- Modify: `site/js/shell.js`, `site/js/render/common.js`, `site/js/render/cards.js`, `category.js`, `ctaGroup.js`, `enquire.js`, `home.js`, `notFound.js`, `page.js`, `placeholder.js`, `retailers.js`, `story.js`, `storyGrid.js`, `vehicle.js`, `site/js/enquiry.js`
- Test: `test/render.test.js`, `test/enquiry.test.js`

**Interfaces:**
- Consumes: `t`, `LOCALES`, `DEFAULT_LANG` (Task 6); `withLang`, `hashForLang`, lang-aware `routeFor` and `linkHref` (Task 7).
- Produces:
  - Context fields every template may use: `ctx.lang` (`'en' | 'ja'`), `ctx.locale` (`'en-US' | 'ja-JP'`), `ctx.t(key, vars)`, `ctx.href(hash)` (`withLang` bound to the lang), and `ctx.routeFor`, `ctx.linkHref` already bound to the lang. Test `makeCtx` in `test/render.test.js` derives `lang` (default `'en'`), `locale`, `t`, `href`, `routeFor`, and `linkHref` from `overrides.lang`, so `makeCtx({ lang: 'ja' })` yields a fully Japanese context.
  - `renderHeader(siteSettings, categories, { lang = 'en', hash = '#/' } = {})` adds, inside `.site-header__inner` after the nav, `<nav class="lang-switch" aria-label="${t('language', lang)}">` with two links `<a href="${hashForLang(hash, 'en')}" hreflang="en" lang="en" data-lang-link="en">EN</a>` and the `ja` one with text `日本語`; the current language's link carries `aria-current="true"`. All header and footer literals go through `t`.
  - `renderFooter(siteSettings, { lang = 'en' } = {})`, `renderBreadcrumbs(trail, { lang = 'en' } = {})`, `renderError(error, context, { lang = 'en' } = {})` (default `context` becomes `t('error_context', lang)` when not given), `renderNotFound(route)` reads `route.lang`, `renderLoading(message)` unchanged (callers pass `t('loading', lang)`).
  - `formatDate(value, locale = 'en-GB')` uses `new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' })`. Templates pass `ctx.locale === 'ja-JP' ? 'ja-JP' : 'en-GB'`.
  - Every literal English string and every literal `'#/...'` href in the listed render files goes through `ctx.t` and `ctx.href` (or `ctx.routeFor`). An `anchor(...)` whose href comes from a CMS URL field (`configureUrl`, `enquiryUrl`, `filmUrl`, the category page's `#/mso` and `#/retailers`) passes the href through `ctx.href` first; `withLang` leaves `https:` URLs alone. `linkButton` already goes through `ctx.linkHref`. A raw `#/` hyperlink typed into rich text is not prefixed (out of scope). The `DEFAULTS` object in `render/enquire.js` becomes dictionary lookups. `label(group)` in `vehicle.js` becomes `ctx.t(\`spec_group_${group}\`)` falling back to the capitalised key when the dictionary has no such key (a custom spec group from the CMS).
  - `render/enquire.js` adds `data-lang="${ctx.lang}"` to the form and uses `ctx.t` for labels, hints, and the honeypot label.
  - `site/js/enquiry.js`: `validate(values, { requireModel = true, lang = 'en' } = {})` uses `t('error_*', lang)`; `buildPayload(values, { vehicles, pageUrl, now, lang = 'en' })` adds `locale: LOCALES[lang]`; `initEnquiry` reads `form.dataset.lang` and passes it to both, and uses `t('sending', lang)`.

- [ ] **Step 1: Write the failing tests**

```js
// render.test.js
test('Japanese context renders chrome strings in Japanese and prefixed routes', () => {
  const { ctx } = makeCtx({ lang: 'ja' });
  const out = String(registry.vehicle(vehicles.coupe, ctx));
  assert.ok(out.includes(STRINGS.ja.specifications));
  assert.ok(out.includes(STRINGS.ja.change_model_variant) || !out.includes('Change model variant'));
  assert.ok(!out.includes('>Specifications<'));
  assert.ok(out.includes('href="#/ja"'));
  assert.ok(!/href="#\/(?!ja)/.test(out), 'every internal href carries the ja prefix');
  const form = String(registry.enquire(enquireData, ctx));
  assert.ok(form.includes('data-lang="ja"'));
  assert.ok(form.includes(STRINGS.ja.full_name));
});

test('header switcher links to the same route in the other language', () => {
  const out = String(renderHeader(site.siteSettings, site.categories, { lang: 'ja', hash: '#/ja/750s' }));
  assert.ok(out.includes('<nav class="lang-switch"'));
  assert.ok(out.includes('href="#/750s" hreflang="en" lang="en" data-lang-link="en"'));
  assert.ok(out.includes('href="#/ja/750s" hreflang="ja" lang="ja" data-lang-link="ja" aria-current="true"'));
  assert.ok(out.includes(`lang="ja" data-lang-link="ja" aria-current="true">日本語<`));
  const en = String(renderHeader(site.siteSettings, site.categories));
  assert.ok(en.includes('data-lang-link="en" aria-current="true"'));
  assert.ok(en.includes('>Skip to content<'));
});

test('formatDate honours the locale', () => {
  assert.equal(formatDate('2026-02-12'), '12 February 2026');
  assert.equal(formatDate('2026-02-12', 'ja-JP'), '2026年2月12日');
  assert.equal(formatDate('nope', 'ja-JP'), '');
});

test('English output is unchanged for the English context', () => {
  // keep the existing English assertions in this file passing untouched
});

// enquiry.test.js
test('validate messages and payload locale follow lang', () => {
  assert.equal(validate({}, { lang: 'ja' }).errors.name, STRINGS.ja.error_name);
  assert.equal(validate({}).errors.name, 'Enter your name.');
  assert.equal(buildPayload({ name: 'a', email: 'a@b.c', country: 'JP', model: '750s' }, { lang: 'ja' }).locale, 'ja-JP');
  assert.equal(buildPayload({ name: 'a' }).locale, 'en-US');
});
```

Add to `test/enquiry.test.js` an `initEnquiry` case where the fake form has `dataset.lang = 'ja'` and an empty name, asserting the `#name-error` text equals `STRINGS.ja.error_name`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/render.test.js test/enquiry.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement the shell changes, then each render module, then `enquiry.js`**

Work file by file. In `shell.js`, pass `lang` into `renderLink`, `renderNavItem`, and the dropdown builders so `routeFor`/`linkHref` get it. Keep the existing English fixture tests green throughout: with `lang: 'en'`, output must be byte-identical to before except for the new `lang-switch` nav in the header.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: all pass.

- [ ] **Step 5: Grep for leftovers**

Run: `grep -nE "href=\"#/|'#/" site/js/shell.js site/js/render/*.js | grep -v "ctx.href\|withLang" ; grep -nE ">(Home|Models|Specifications|Overview|Lineage|Retailers|Downloads|Explore|Configure|Enquire)<" site/js/shell.js site/js/render/*.js`
Expected: no output from either grep.

- [ ] **Step 6: Commit**

```bash
git add site/js test/render.test.js test/enquiry.test.js
git commit -m "Render chrome strings and routes in the route's language"
```

---

### Task 10: App language state and Japanese typography

**Files:**
- Modify: `site/app.js`, `site/styles.css`

**Interfaces:**
- Consumes: `forLocale` (Task 8), `matchRoute(...).lang`, `hashForLang`, `withLang` (Task 7), `t`, `LOCALES`, `DEFAULT_LANG` (Task 6), shell signatures (Task 9).
- Produces, in `site/app.js`:
  - `state.lang` (initially `null`), `state.client` (the locale-bound client in use).
  - `clientFor(lang)` = `cda.forLocale(LOCALES[lang])`.
  - `async function ensureShell(lang, hash)`: no-op when `lang === state.lang`; otherwise loads `getSiteSettings()` and `getCategories()` through `clientFor(lang)` with `Promise.allSettled` (warn on failure as boot does today), sets `state.lang`, `state.client`, `document.documentElement.lang = lang`, and calls `renderShell(hash)`.
  - `renderShell(hash)` passes `{ lang: state.lang, hash }` to `renderHeader` and `{ lang: state.lang }` to `renderFooter`.
  - `updateLangLinks(hash)`: for each `[data-lang-link]`, sets `href` to `hashForLang(hash, link.dataset.langLink)`. Called at the end of every successful `handleRoute` and in the error path.
  - `buildContext(client, route)` adds `lang`, `locale`, `t`, `href`, and binds `routeFor` and `linkHref` to `route.lang`; `cda` is the bound client.
  - `handleRoute(route, cda, preloaded)`: computes `lang = route.lang`, `client = clientFor(lang)`, starts `loading = preloaded || loadRoute(route, client)`, awaits `ensureShell(lang, hash)` before awaiting `loading`, and uses `client` for prefetch. `renderLoading(t('loading', lang))`, `renderError(error, undefined, { lang })`, `fallbackTitle` uses `t('retailers', lang)` and `t('page_not_found', lang)`, `setHead({ title: t('error', lang) })`.
  - `boot()`: `initial = routeFromHash(initialHash)`, `preloaded = loadRoute(initial, clientFor(initial.lang))`, then `await ensureShell(initial.lang, initialHash)` in place of the current settings and categories load and `renderShell()` call. The configuration error path keeps its English text and calls `renderHeader(null, [])`.
- Produces, in `site/styles.css`, at the end of the file under a `/* Japanese */` comment:
  - `html[lang="ja"] { --font-sans: "Hiragino Kaku Gothic ProN", "Hiragino Sans", "Yu Gothic", Meiryo, "Noto Sans JP", <the existing --font-sans value>; }`
  - `html[lang="ja"] body { line-height: 1.8; overflow-wrap: anywhere; }`
  - One rule `html[lang="ja"] :where(<every selector in styles.css that sets text-transform: uppercase or a non-zero letter-spacing>) { letter-spacing: 0; text-transform: none; }`.
  - `.lang-switch` styles: inline links separated by a thin divider, `aria-current` link in the accent colour, placed after the retailer link at desktop width and inside the open mobile menu at narrow widths (follow how `.site-nav__retailer` is positioned).

- [ ] **Step 1: Implement `site/app.js`**

- [ ] **Step 2: Implement the CSS**

- [ ] **Step 3: Run the tests and build the site**

Run: `npm test && npm run build:site`
Expected: tests pass; the build writes `dist/` (or the configured output) without error. The build needs `CONTENTFUL_SPACE_ID` and `CONTENTFUL_DELIVERY_TOKEN` in the environment; if they are absent, report that the build step was skipped.

- [ ] **Step 4: Smoke test in headless Chromium against the local build**

Serve the built site with `node scripts/serve.js` in the background, then drive `/opt/pw-browsers/chromium` over CDP (the orchestrator's `cdp-verify.mjs` pattern) to open `#/ja/750s` and assert: `document.documentElement.lang === 'ja'`, the `h1` is non-empty, the header contains `日本語` with `aria-current`, and every `a[href^="#/"]` inside `main` starts with `#/ja`. Then click the `EN` link and assert `location.hash === '#/750s'` and `document.documentElement.lang === 'en'`. Report the assertions and their results; if the Delivery credentials are not available in your environment, say so and stop after Step 3.

- [ ] **Step 5: Commit**

```bash
git add site/app.js site/styles.css
git commit -m "Switch the site language from the route"
```

---

### Task 11: Verify both locales, payload locale, docs

**Files:**
- Modify: `scripts/verify-content.js`, `fusion/enquiry-scenario.blueprint.json`, `docs/fusion-setup.md`, `README.md`
- Test: `test/fusion.test.js`

**Interfaces:**
- Consumes: `LOCALES` from `src/content-model.js` (Task 1) for the list of extra locales.
- Produces:
  - `scripts/verify-content.js` runs its route, link, and slug checks once per locale in `['en-US', ...LOCALES.map((l) => l.code)]`, passing `locale` on every Delivery request, and prints the table per locale with a `locale` heading line. In the `ja-JP` pass it also checks that these fields contain Japanese script (`/[぀-ヿ一-鿿]/`): every `vehicleCategory.intro`, every `story.standfirst`, `enquiryForm.intro`, and `siteSettings.newsletterText`; a miss is a problem `"<type>/<slug> has no Japanese text in <field>"`. The summary line gains `, <n> locales`.
  - The Fusion blueprint description gains a final line `Locale: {{1.locale}}`; `test/fusion.test.js` adds `locale` to the keys it expects in the description. `docs/fusion-setup.md` payload table gains a `locale` row (`"en-US" or "ja-JP", the language the form was shown in`) and a note that an existing import keeps working without the line, and that re-importing the blueprint adds it.
  - `README.md` gains a "Locales" section after "Seed content": the locale and fallback, where overlays live, the coverage rule, the `#/ja/` prefix and switcher, and the `ja-JP` pass in `npm run verify`.

- [ ] **Step 1: Update `test/fusion.test.js` and run it to see it fail**

Run: `node --test test/fusion.test.js`
Expected: FAIL, description does not map `locale`.

- [ ] **Step 2: Update the blueprint, the verify script, and the docs**

- [ ] **Step 3: Run the tests**

Run: `npm test`
Expected: all pass.

- [ ] **Step 4: Dry-run the verify script against the space if credentials are present**

Run: `npm run verify; echo "exit $?"`
Expected before provisioning: the `ja-JP` pass reports missing Japanese text (the space has no Japanese yet). Report the output; do not treat it as a failure of this task. If credentials are absent, say so.

- [ ] **Step 5: Commit**

```bash
git add scripts/verify-content.js fusion/enquiry-scenario.blueprint.json docs/fusion-setup.md README.md test/fusion.test.js
git commit -m "Verify both locales and record the form language"
```

---

## Orchestrator steps after Task 11

1. `node scripts/setup.js --dry-run` passes with every coverage line at `n/n`.
2. `node scripts/setup.js --types-only` creates the `ja-JP` locale and updates the content types (expect `updated` for every type with a localized field).
3. `node scripts/setup.js` writes the Japanese values (expect `updated` for every entry with a localized field, `unchanged` for links and assets). Re-run once and expect all `unchanged`.
4. `npm run verify` passes for both locales.
5. Push `main`, wait for the Pages deploy, then CDP screenshots of `#/ja/`, `#/ja/750s`, `#/ja/enquire/750s`, and `#/ja/retailers`, plus the switcher round trip `#/ja/750s` to `#/750s` and back.
6. Final whole-branch review on the most capable tier, one fix wave, scoped re-review.
