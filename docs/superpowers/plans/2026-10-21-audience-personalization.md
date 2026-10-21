# Audience personalization implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Editors define audiences and variant content in Contentful, and the static front end renders the variant that matches signals collected in the visitor's browser.

**Architecture:** Three new content types (`audience`, `contentVariant`, `personalizedContent`) carry the editor model. `signals.js` owns the visitor profile, a local provider in `audience.js` turns the profile into a set of audience keys, and `render/personalized.js` picks a variant while the markup is built, so the response cache stays shared across audiences. A demo panel re-renders the current route in place through the existing variant-switch path.

**Tech Stack:** Node 22 with `node --test` and `assert/strict`; vanilla ES modules in the browser; Contentful Delivery API for reads; Contentful Management API (via `npm run setup`) for provisioning.

**Spec:** `docs/superpowers/specs/2026-10-21-audience-personalization-design.md`. It is binding. Read it alongside this plan.

## Global Constraints

- The front end stays a dependency-free static ES-module site with no build step. Add no packages, bundlers or frameworks.
- Every new module under `site/js/` gets a `<link rel="modulepreload">` in `site/index.html`, in the same task that creates the module. `test/preload.test.js` enforces this.
- Modules under `site/js/` touch no `document`, `window`, `localStorage` or `sessionStorage` at import time. Only `site/app.js` touches the DOM at module level.
- All markup goes through the escaping `html` tag from `site/js/dom.js`. Use `raw()` only for fixed literal fragments.
- Prose and comments follow the Google developer documentation style: sentence case, active voice, no em dashes, no exclamation points.
- No model identifiers anywhere in repo files. Each commit message ends with the two attribution trailer lines your harness supplies, unchanged.
- `npm test` passes after every task. The baseline before this plan is 210 passing tests.
- `npm run setup -- --dry-run` passes after Tasks 1 and 2 and stays green after. Make no live writes to Contentful: never run `npm run setup` without `--dry-run`. Provisioning the space is the human's step (Task 8).
- Do not touch `site/config.js` (generated, git-ignored).
- Tests use `import { test } from 'node:test'` and `assert/strict`, run DOM-free, use fixtures or inline builders, and make no network calls. Follow TDD: failing test, run it, implement, run it.
- Values pinned by the spec, used verbatim in code and tests:
  - Profile key `mcl.profile`, session marker `mcl.session`, profile `version: 1`, viewed vehicles capped at 20.
  - Campaign parameters `utm_campaign` then `audience`, read from the real query string and then the hash query string, stored lowercase.
  - Region comes from the region subtag of `navigator.language`. No geolocation, no IP lookup.
  - Data attributes `data-personalized` (wrapper `sys.id`) and `data-variant` (audience key, or `default`).
  - The panel opens on `?demo=1` or Shift+D three times within two seconds. Its open state lives in `sessionStorage`.
  - Audiences query: `content_type: audience`, `include: 1`, `limit: 100`.
  - Home, modular page, story and vehicle queries use `include: 6`.
  - Seed audience keys: `supercar-fans`, `returning`, `trackday`, `uk`, `vip`. `vip` has `source: external` and no rules.

## Review Focus

Inputs the spec implies but its own tests do not exercise, most likely first. Each line is pinned by a named test in the owning task.

1. A variant or default whose link did not resolve (an unpublished entry arrives as `null`). Expected: the variant is skipped, an unresolved default renders nothing, and the page still renders. Pinned in Task 5 by `pick returns no content and one warning when the default does not resolve`.
2. Browser language tags without a plain region: `en`, `es-419`, `zh-Hans-CN`, `en_GB`, empty, undefined. Expected: the region is the first two-letter region subtag, else null, and never an error. Pinned in Task 3 by `regionFromLanguage reads the region subtag only`.
3. A blank, padded or mixed-case campaign value (`utm_campaign=` with `audience=%20TrackDay%20`). Expected: a blank value falls through to the next parameter, and the stored value is trimmed and lowercase. Pinned in Task 3 by `campaignFromLocation prefers utm_campaign, then the real query string, and normalises`.
4. A stored profile with `version: 1` but wrong-shaped fields (hand-edited, or written by a different build). Expected: fields normalise to safe values and the site still boots. Pinned in Task 3 by `load normalises a version 1 profile with wrong-shaped fields` and in Task 4 by `the local provider tolerates a profile with missing or wrong-shaped fields`.
5. Shift+D typed into a form field, held down (key repeat) or pressed with another modifier. Expected: never counts toward opening the panel. Pinned in Task 7 by `Shift+D in a form field, held down or with another modifier never counts`.

---

### Task 1: Content model for audiences and personalized content

**Files:**
- Modify: `src/content-model.js` (constants near lines 61-63; new types after `ctaGroup`, before `story` at line 265; `story.sections` line 285; `vehicle.enquiryUrl` and `vehicle.msoBanner` lines 317 and 326; `page.sections` line 379)
- Create: `test/content-model.test.js`
- Modify: `test/provision.test.js:105-118` (expected type list)

**Interfaces:**
- Consumes: the existing helpers `symbolIn`, `entryLink`, `entryLinks`, `defaultValue`, `SECTION_TYPES`, `STORY_SECTION_TYPES`, and `getContentType(id)`.
- Produces: content types `audience`, `contentVariant`, `personalizedContent` with the field IDs below, and the new field `vehicle.enquiryCta`. Later tasks and seeds use these field IDs verbatim.
  - `audience` (display `name`): `name` Symbol required; `key` Symbol required, `unique`, regexp `^[a-z0-9]+(-[a-z0-9]+)*$`; `description` Text; `source` Symbol in `local|external`, default `local`; `interestCategories` links to `vehicleCategory`; `interestVehicles` links to `vehicle`; `visitorType` Symbol in `any|first-time|returning`, default `any`; `minVisits` Integer; `campaigns` Array of Symbol; `regions` Array of Symbol; `matchMode` Symbol in `all|any`, default `all`.
  - `contentVariant` (display `title`): `title` Symbol required; `audience` Link to `audience`, required; `content` Link required, to the seven section types plus `link`.
  - `personalizedContent` (display `title`): `title` Symbol required; `default` Link required, same allowed types as `contentVariant.content`; `variants` links to `contentVariant`.
  - `page.sections` and `story.sections` also accept `personalizedContent`. `vehicle.msoBanner` accepts `bannerButton` or `personalizedContent`. `vehicle.enquiryCta` is a Link to `link` or `personalizedContent`. `vehicle.enquiryUrl` stays.

- [ ] **Step 1: Write the failing tests**

Create `test/content-model.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getContentType } from '../src/content-model.js';

const field = (type, id) => getContentType(type).fields.find((f) => f.id === id);
const allowed = (f) => (f.items ?? f).validations.find((v) => v.linkContentType).linkContentType;
const SECTIONS = ['textBlock', 'imageBlock', 'bannerButton', 'cardGrid', 'vehicleGrid', 'storyGrid', 'ctaGroup'];

test('audience has the pinned fields, defaults and key pattern', () => {
  const audience = getContentType('audience');
  assert.equal(audience.displayField, 'name');
  assert.deepEqual(audience.fields.map((f) => f.id), [
    'name', 'key', 'description', 'source', 'interestCategories', 'interestVehicles',
    'visitorType', 'minVisits', 'campaigns', 'regions', 'matchMode',
  ]);
  assert.equal(field('audience', 'name').required, true);
  assert.equal(field('audience', 'key').required, true);
  const keyValidations = field('audience', 'key').validations;
  assert.ok(keyValidations.some((v) => v.unique === true));
  assert.ok(keyValidations.some((v) => v.regexp?.pattern === '^[a-z0-9]+(-[a-z0-9]+)*$'));
  assert.deepEqual(field('audience', 'source').validations, [{ in: ['local', 'external'] }]);
  assert.deepEqual(field('audience', 'visitorType').validations, [{ in: ['any', 'first-time', 'returning'] }]);
  assert.deepEqual(field('audience', 'matchMode').validations, [{ in: ['all', 'any'] }]);
  assert.deepEqual(
    ['source', 'visitorType', 'matchMode'].map((id) => field('audience', id).defaultValue['en-US']),
    ['local', 'any', 'all'],
  );
  assert.deepEqual(allowed(field('audience', 'interestCategories')), ['vehicleCategory']);
  assert.deepEqual(allowed(field('audience', 'interestVehicles')), ['vehicle']);
  assert.equal(field('audience', 'minVisits').type, 'Integer');
  for (const id of ['campaigns', 'regions']) {
    assert.equal(field('audience', id).type, 'Array');
    assert.equal(field('audience', id).items.type, 'Symbol');
  }
});

test('contentVariant and personalizedContent accept any section type or a link', () => {
  assert.equal(getContentType('contentVariant').displayField, 'title');
  assert.equal(field('contentVariant', 'audience').required, true);
  assert.deepEqual(allowed(field('contentVariant', 'audience')), ['audience']);
  assert.equal(field('contentVariant', 'content').required, true);
  assert.deepEqual(allowed(field('contentVariant', 'content')), [...SECTIONS, 'link']);
  assert.equal(getContentType('personalizedContent').displayField, 'title');
  assert.equal(field('personalizedContent', 'default').required, true);
  assert.deepEqual(allowed(field('personalizedContent', 'default')), [...SECTIONS, 'link']);
  assert.equal(field('personalizedContent', 'variants').type, 'Array');
  assert.deepEqual(allowed(field('personalizedContent', 'variants')), ['contentVariant']);
});

test('existing types accept personalizedContent and the vehicle gains enquiryCta', () => {
  assert.deepEqual(allowed(field('page', 'sections')), [...SECTIONS, 'personalizedContent']);
  assert.deepEqual(allowed(field('story', 'sections')), ['textBlock', 'imageBlock', 'ctaGroup', 'personalizedContent']);
  assert.deepEqual(allowed(field('vehicle', 'msoBanner')), ['bannerButton', 'personalizedContent']);
  assert.equal(field('vehicle', 'enquiryCta').type, 'Link');
  assert.deepEqual(allowed(field('vehicle', 'enquiryCta')), ['link', 'personalizedContent']);
  assert.equal(field('vehicle', 'enquiryUrl').type, 'Symbol', 'enquiryUrl stays as the fallback');
});
```

In `test/provision.test.js`, add `'audience', 'contentVariant', 'personalizedContent'` to the `expected` array in `the content model covers every type in the design`. The existing `ids.length === expected.length` assertion then requires 26 types.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/content-model.test.js test/provision.test.js`
Expected: FAIL (`getContentType('audience')` is undefined; the coverage test reports a missing type).

- [ ] **Step 3: Implement the content model changes in `src/content-model.js`**

Add `const PERSONALIZED_TYPES = [...SECTION_TYPES, 'link'];` beside the other constants. Insert the three types after `ctaGroup`, with descriptions in the existing style (one sentence each; the `personalizedContent` one states that resolution never nests). Extend the four existing fields as listed under Produces. Use `symbolIn(..., defaultValue(...))`, `entryLink` and `entryLinks` as the neighbouring fields do. Keep each type description under 500 characters (`validateContentModel` enforces it).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test test/content-model.test.js test/provision.test.js && npm test && npm run setup -- --dry-run`
Expected: all tests pass; the dry run prints `26 content types` and `Dry run passed: no problems found.`

- [ ] **Step 5: Commit**

```bash
git add src/content-model.js test/content-model.test.js test/provision.test.js
git commit -m "Add audience and personalized content types to the content model"
```

---

### Task 2: Seed audiences, wrappers and variants

**Files:**
- Create: `src/seed/audiences.js`
- Modify: `src/seed/index.js:17` (add the group after `SECTIONS_GROUP`)
- Modify: `src/seed/sections.js` (three banners after the banner block, lines 128-144)
- Modify: `src/seed/links.js` (two links after line 223)
- Modify: `src/seed/pages.js:27` (home sections)
- Modify: `src/seed/vehicles.js:234-244` (750S links)
- Test: `test/provision.test.js`

**Interfaces:**
- Consumes: the Task 1 field IDs; the seed shape `{ id, contentType, fields, links, assets }`; existing IDs `cat-supercars`, `banner-mcl-6gt`, `banner-mso-generic`, `link-cta-vehicle-750s`, `link-cta-register-track-day`, `link-cta-customise`, assets `img-750s-hero`, `img-experience-track-day`, `img-mso-banner`.
- Produces: `AUDIENCES_GROUP = { name: 'audiences', assets: [], entries }` exported from `src/seed/audiences.js`, holding audience entries `aud-supercar-fans`, `aud-returning`, `aud-trackday`, `aud-uk`, `aud-vip`; `contentVariant` entries `variant-home-banner-supercar-fans`, `variant-home-banner-trackday`, `variant-750s-mso-returning`, `variant-750s-enquiry-uk`; and `personalizedContent` entries `pc-home-banner`, `pc-750s-mso-banner`, `pc-750s-enquiry-cta`.
  - New banners in `sections.js`: `banner-supercar-fans` (CTA `link-cta-vehicle-750s`, image `img-750s-hero`), `banner-trackday` (CTA `link-cta-register-track-day`, image `img-experience-track-day`), `banner-mso-returning` (CTA `link-cta-customise`, image `img-mso-banner`). Headings: `Your next supercar is waiting`, `Take it to the circuit`, `Welcome back to MSO`. Copy is original placeholder text in the style of `banner-mcl-6gt`.
  - New links in `links.js`: `link-cta-enquire-750s` (label `Enquire`, url `#/enquire/750s`, style `secondary`) and `link-cta-uk-retailer` (label `Visit a UK retailer`, url `#/retailers`, style `secondary`).
  - Rules: `aud-supercar-fans` links `interestCategories: ['cat-supercars']`; `aud-returning` has `visitorType: 'returning'`; `aud-trackday` has `campaigns: ['trackday']`; `aud-uk` has `regions: ['GB']`; `aud-vip` has `source: 'external'` and no rules. The others set `source: 'local'` and `matchMode: 'all'`.
  - Wiring: `pc-home-banner` has default `banner-mcl-6gt` and variants `[supercar-fans, trackday]` in that order; home `sections` becomes `['text-home-intro', 'pc-home-banner', 'stories-latest', 'cta-home']`. `pc-750s-mso-banner` has default `banner-mso-generic` and a `returning` variant. `pc-750s-enquiry-cta` has default `link-cta-enquire-750s` and a `uk` variant pointing at `link-cta-uk-retailer`. Only `vehicle-750s` gets `msoBanner: 'pc-750s-mso-banner'` and `enquiryCta: 'pc-750s-enquiry-cta'`. Every other vehicle, `banner-mcl-6gt` on the category pages, and `enquiryUrl` stay as they are.

- [ ] **Step 1: Write the failing tests**

Append to `test/provision.test.js`:

```js
const allSeeds = () => SEED_GROUPS.flatMap((group) => group.entries);

test('audience seeds: five audiences with the pinned keys and rules', () => {
  const group = SEED_GROUPS.find((g) => g.name === 'audiences');
  const audiences = group.entries.filter((e) => e.contentType === 'audience');
  assert.deepEqual(audiences.map((e) => e.fields.key), ['supercar-fans', 'returning', 'trackday', 'uk', 'vip']);
  const byKey = Object.fromEntries(audiences.map((e) => [e.fields.key, e]));
  assert.deepEqual(byKey['supercar-fans'].links.interestCategories, ['cat-supercars']);
  assert.equal(byKey.returning.fields.visitorType, 'returning');
  assert.deepEqual(byKey.trackday.fields.campaigns, ['trackday']);
  assert.deepEqual(byKey.uk.fields.regions, ['GB']);
  assert.equal(byKey.vip.fields.source, 'external');
  assert.equal(byKey.vip.links, undefined);
  for (const rule of ['campaigns', 'regions', 'minVisits', 'visitorType']) assert.equal(byKey.vip.fields[rule], undefined);
});

test('personalized seeds wrap the home banner, the 750S MSO banner and the 750S enquiry CTA', () => {
  const byId = new Map(allSeeds().map((e) => [e.id, e]));
  const keysOf = (id) => byId.get(id).links.variants.map((v) => byId.get(byId.get(v).links.audience).fields.key);
  const contentOf = (id) => byId.get(id).links.variants.map((v) => byId.get(v).links.content);
  assert.deepEqual(byId.get('page-home').links.sections, ['text-home-intro', 'pc-home-banner', 'stories-latest', 'cta-home']);
  assert.equal(byId.get('pc-home-banner').links.default, 'banner-mcl-6gt');
  assert.deepEqual(keysOf('pc-home-banner'), ['supercar-fans', 'trackday']);
  const coupe = byId.get('vehicle-750s');
  assert.equal(coupe.links.msoBanner, 'pc-750s-mso-banner');
  assert.equal(coupe.links.enquiryCta, 'pc-750s-enquiry-cta');
  assert.equal(coupe.fields.enquiryUrl, '#/enquire/750s', 'the fallback stays');
  assert.equal(byId.get('pc-750s-mso-banner').links.default, 'banner-mso-generic');
  assert.deepEqual(keysOf('pc-750s-mso-banner'), ['returning']);
  assert.equal(byId.get('pc-750s-enquiry-cta').links.default, 'link-cta-enquire-750s');
  assert.deepEqual(keysOf('pc-750s-enquiry-cta'), ['uk']);
  assert.deepEqual(contentOf('pc-750s-enquiry-cta'), ['link-cta-uk-retailer']);
  assert.equal(byId.get('link-cta-uk-retailer').fields.externalUrl, '#/retailers');
  const spider = byId.get('vehicle-750s-spider');
  assert.equal(spider.links.msoBanner, 'banner-mso-generic');
  assert.equal(spider.links.enquiryCta, undefined);
});

test('the full seed set validates against the content model, with every link resolving', () => {
  assert.deepEqual(validateSeeds(SEED_GROUPS, CONTENT_TYPES), []);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/provision.test.js`
Expected: FAIL (`find` returns undefined for the `audiences` group).

- [ ] **Step 3: Implement the seeds**

Create `src/seed/audiences.js` exporting `AUDIENCES_GROUP`, with a short header comment in the style of `sections.js` naming the ID conventions (`aud-<key>`, `variant-<slot>-<key>`, `pc-<slot>`). Add the banners to `sections.js`, the links to `links.js`, change the home `sections` array in `pages.js`, and add the two 750S links in `vehicles.js` by spreading `...(v.slug === '750s' ? { msoBanner: ..., enquiryCta: ... } : {})` after the existing `msoBanner` line. Register `AUDIENCES_GROUP` in `src/seed/index.js`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test && npm run setup -- --dry-run`
Expected: all tests pass, including `every seeded internal href resolves to a real route or a placeholder`; the dry run lists a group `audiences` and ends with `Dry run passed: no problems found.`

- [ ] **Step 5: Commit**

```bash
git add src/seed test/provision.test.js
git commit -m "Seed audiences and personalized variants for home and the 750S"
```

---

### Task 3: Visitor profile and signals

**Files:**
- Create: `site/js/signals.js`
- Create: `test/signals.test.js`
- Modify: `site/index.html` (add `<link rel="modulepreload" href="js/signals.js">` after the `js/shell.js` line)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces, all from `site/js/signals.js` (no DOM or storage access at import):

```js
export const PROFILE_KEY = 'mcl.profile';
export const SESSION_KEY = 'mcl.session';
export const PROFILE_VERSION = 1;
export const MAX_VIEWED_VEHICLES = 20;

/** Storage and clock are injected so tests run without a browser. `local` and `session` return a Storage. */
export function createSignals({ local = () => globalThis.localStorage, session = () => globalThis.sessionStorage, now = () => new Date() } = {}):
  { load, recordBoot, recordView, setOverrides, setEnabled, reset }
// The module also exports those six functions bound to a default instance:
export const { load, recordBoot, recordView, setOverrides, setEnabled, reset } = createSignals();

load(): Profile                                              // a normalised copy
recordBoot(location: { search: string, hash: string }, navigator: { language?: string }): Profile
recordView({ vehicleSlug?: string, categorySlug?: string }): Profile
setOverrides({ audiences?: string[] | null, region?: string | null }): Profile
setEnabled(enabled: boolean): void
reset(): Profile

export function campaignFromLocation(location): string | null
export function regionFromLanguage(tag: string | undefined): string | null
export function effectiveRegion(profile): string | null      // overrides.region, else region
export function viewFrom(view: string, data): { vehicleSlug?: string, categorySlug?: string } | null
```

`Profile` is the spec's shape: `{ version: 1, visits, firstSeen, lastSeen, viewed: { vehicles: string[], categories: { [slug]: number } }, campaign, region, overrides: { audiences: string[] | null, region: string | null } }`. A fresh profile has `visits: 0`, null dates, empty `viewed`, null `campaign` and `region`, and null overrides.

- [ ] **Step 1: Write the failing tests**

Create `test/signals.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSignals, campaignFromLocation, regionFromLanguage, effectiveRegion, viewFrom } from '../site/js/signals.js';

const store = (seed = {}) => {
  const map = new Map(Object.entries(seed));
  return { map, getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => void map.set(k, String(v)), removeItem: (k) => void map.delete(k) };
};
const blocked = () => { throw new Error('blocked'); };
const brokenStore = { getItem: blocked, setItem: blocked, removeItem: blocked };
const T0 = '2026-10-21T10:00:00.000Z';
const FRESH = {
  version: 1, visits: 0, firstSeen: null, lastSeen: null, viewed: { vehicles: [], categories: {} },
  campaign: null, region: null, overrides: { audiences: null, region: null },
};
const setup = ({ local = store(), session = store(), clock = { iso: T0 } } = {}) => ({
  signals: createSignals({ local: () => local, session: () => session, now: () => new Date(clock.iso) }),
  local, session, clock,
});
const here = (search = '', hash = '#/') => ({ search, hash });
const stored = (local) => JSON.parse(local.map.get('mcl.profile'));

test('a first boot writes the version 1 profile under mcl.profile', () => {
  const { signals, local } = setup();
  signals.recordBoot(here(), { language: 'en-GB' });
  assert.deepEqual(stored(local), {
    version: 1, visits: 1, firstSeen: T0, lastSeen: T0, viewed: { vehicles: [], categories: {} },
    campaign: null, region: 'GB', overrides: { audiences: null, region: null },
  });
});

test('visits count sessions, not boots', () => {
  const { signals, local, session, clock } = setup();
  signals.recordBoot(here(), { language: 'en-GB' });
  signals.recordBoot(here(), { language: 'en-GB' });
  assert.equal(stored(local).visits, 1);
  assert.equal(session.map.has('mcl.session'), true);
  clock.iso = '2026-10-21T10:05:00.000Z';
  const next = setup({ local, session: store(), clock }).signals.recordBoot(here(), { language: 'en-GB' });
  assert.equal(next.visits, 2);
  assert.equal(next.firstSeen, T0);
  assert.equal(next.lastSeen, '2026-10-21T10:05:00.000Z');
});

test('recordView keeps vehicles most recent first without duplicates and counts categories', () => {
  const { signals } = setup();
  signals.recordView({ vehicleSlug: '750s', categorySlug: 'supercars' });
  signals.recordView({ vehicleSlug: '750s-spider', categorySlug: 'supercars' });
  signals.recordView({ categorySlug: 'gt' });
  signals.recordView({ vehicleSlug: 'w1' });
  let viewed = signals.load().viewed;
  assert.deepEqual(viewed.vehicles, ['w1', '750s-spider', '750s']);
  assert.deepEqual(viewed.categories, { supercars: 2, gt: 1 }, 'a view without a category adds no key');
  signals.recordView({ vehicleSlug: '750s' });
  viewed = signals.load().viewed;
  assert.deepEqual(viewed.vehicles, ['750s', 'w1', '750s-spider'], 'a revisit moves to the front');
});

test('viewed vehicles are capped at 20 entries', () => {
  const { signals } = setup();
  for (let i = 0; i < 25; i += 1) signals.recordView({ vehicleSlug: `v${i}` });
  const { vehicles } = signals.load().viewed;
  assert.equal(vehicles.length, 20);
  assert.equal(vehicles[0], 'v24');
  assert.equal(vehicles[19], 'v5');
});

test('campaignFromLocation prefers utm_campaign, then the real query string, and normalises', () => {
  const cases = [
    [here('?utm_campaign=trackday', '#/750s'), 'trackday'],
    [here('', '#/750s?audience=trackday'), 'trackday'],
    [here('?audience=a', '#/x?utm_campaign=b'), 'b'],
    [here('?utm_campaign=a', '#/x?utm_campaign=b'), 'a'],
    [here('?utm_campaign=&audience=%20TrackDay%20', '#/'), 'trackday'],
    [here('?utm_campaign=%20%20', '#/'), null],
    [here('', '#/'), null],
  ];
  for (const [location, expected] of cases) assert.equal(campaignFromLocation(location), expected, JSON.stringify(location));
});

test('a later boot without a campaign keeps the stored one', () => {
  const { signals, local } = setup();
  signals.recordBoot(here('?utm_campaign=TrackDay'), { language: 'en-GB' });
  signals.recordBoot(here(), { language: 'en-GB' });
  assert.equal(stored(local).campaign, 'trackday');
});

test('regionFromLanguage reads the region subtag only', () => {
  const cases = [['en-GB', 'GB'], ['en-gb', 'GB'], ['zh-Hans-CN', 'CN'], ['en_GB', 'GB'],
    ['en', null], ['es-419', null], ['en-u-ca-gregory', null], ['', null], [undefined, null]];
  for (const [tag, expected] of cases) assert.equal(regionFromLanguage(tag), expected, String(tag));
});

test('boot derives the region once and the override wins', () => {
  const { signals } = setup();
  signals.recordBoot(here(), { language: 'en-GB' });
  assert.equal(signals.recordBoot(here(), { language: 'fr-FR' }).region, 'GB', 'derived only while unset');
  assert.equal(effectiveRegion(signals.load()), 'GB');
  assert.equal(effectiveRegion(signals.setOverrides({ region: 'fr' })), 'FR');
});

test('setOverrides normalises, leaves absent keys alone and clears on null', () => {
  const { signals, local } = setup();
  signals.setOverrides({ audiences: ['returning', 'returning', 'uk'], region: ' gb ' });
  assert.deepEqual(stored(local).overrides, { audiences: ['returning', 'uk'], region: 'GB' });
  assert.deepEqual(signals.setOverrides({ region: 'GBR' }).overrides, { audiences: ['returning', 'uk'], region: null });
  assert.deepEqual(signals.setOverrides({ audiences: null }).overrides, { audiences: null, region: null });
});

test('setEnabled(false) stops all writes and reads, and true resumes them', () => {
  const { signals, local } = setup();
  signals.setEnabled(false);
  signals.recordBoot(here(), { language: 'en-GB' });
  signals.recordView({ vehicleSlug: '750s' });
  signals.setOverrides({ region: 'FR' });
  assert.equal(local.map.size, 0);
  assert.deepEqual(signals.load(), FRESH);
  signals.setEnabled(true);
  signals.recordBoot(here(), { language: 'en-GB' });
  assert.equal(stored(local).visits, 1);
});

test('reset removes the profile and the session marker', () => {
  const { signals, local, session } = setup();
  signals.recordBoot(here(), { language: 'en-GB' });
  signals.reset();
  assert.equal(local.map.has('mcl.profile'), false);
  assert.equal(session.map.has('mcl.session'), false);
  assert.deepEqual(signals.load(), FRESH);
});

test('blocked storage keeps an in-memory first-time profile for the page lifetime', () => {
  const now = () => new Date(T0);
  for (const stores of [{ local: () => brokenStore, session: () => brokenStore }, { local: blocked, session: blocked }]) {
    const signals = createSignals({ ...stores, now });
    assert.doesNotThrow(() => signals.recordBoot(here(), { language: 'en-GB' }));
    signals.recordView({ vehicleSlug: '750s', categorySlug: 'supercars' });
    const profile = signals.load();
    assert.equal(profile.visits, 1);
    assert.deepEqual(profile.viewed.vehicles, ['750s']);
    assert.doesNotThrow(() => signals.reset());
  }
});

test('an older version or malformed JSON is discarded and started fresh', () => {
  for (const raw of ['{"version":0,"visits":9}', '{not json', 'null', '[]']) {
    const { signals, local } = setup({ local: store({ 'mcl.profile': raw }) });
    assert.deepEqual(signals.load(), FRESH, raw);
    assert.equal(signals.recordBoot(here(), { language: 'en-GB' }).visits, 1);
    assert.equal(stored(local).version, 1);
  }
});

test('load normalises a version 1 profile with wrong-shaped fields', () => {
  const bad = { version: 1, visits: '3', firstSeen: 5, lastSeen: {}, viewed: null, campaign: 7, region: 'gbr', overrides: 'x' };
  assert.deepEqual(setup({ local: store({ 'mcl.profile': JSON.stringify(bad) }) }).signals.load(), FRESH);
  const partial = { ...FRESH, visits: 2, viewed: { vehicles: ['750s', 3, null], categories: { supercars: 2, gt: 'x', bad: -1 } } };
  const { viewed, visits } = setup({ local: store({ 'mcl.profile': JSON.stringify(partial) }) }).signals.load();
  assert.equal(visits, 2);
  assert.deepEqual(viewed, { vehicles: ['750s'], categories: { supercars: 2 } });
});

test('viewFrom maps vehicle and category views and ignores every other route', () => {
  const vehicle = { entry: { fields: { slug: '750s', category: { fields: { slug: 'supercars' } } } } };
  assert.deepEqual(viewFrom('vehicle', vehicle), { vehicleSlug: '750s', categorySlug: 'supercars' });
  assert.deepEqual(viewFrom('vehicle', { entry: { fields: { slug: 'x', category: null } } }), { vehicleSlug: 'x' });
  assert.deepEqual(viewFrom('vehicleCategory', { entry: { fields: { slug: 'gt' } } }), { categorySlug: 'gt' });
  for (const view of ['home', 'page', 'story', 'retailers', 'enquire', 'placeholder', 'notFound']) {
    assert.equal(viewFrom(view, vehicle), null, view);
  }
  assert.equal(viewFrom('vehicle', null), null);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/signals.test.js`
Expected: FAIL (`Cannot find module '../site/js/signals.js'`).

- [ ] **Step 3: Implement `site/js/signals.js`**

Write a header comment in the style of `prefetch.js` stating that this module owns everything the site knows about the visitor and is the only profile reader and writer, so a CDP swap replaces this file. The signatures are above. The spec fixes the behavior; these rules cover what it leaves open:

- `load()` reads storage, parses, and normalises. Wrong version, unparsable or non-object JSON gives a fresh profile. For version 1: `visits` is a non-negative integer else 0; dates are strings else null; `viewed.vehicles` keeps strings only, capped at 20; `viewed.categories` keeps positive integers only; `campaign` is a string else null; `region` is two ASCII letters, uppercased, else null; `overrides.audiences` is an array of strings else null; `overrides.region` follows the region rule. While disabled, `load()` returns a fresh profile without reading storage. Keep the last written profile in memory and fall back to it when a storage read or write throws.
- `recordBoot`: if `mcl.session` is absent from `sessionStorage` (or session storage throws and this instance has not counted yet), increment `visits` and set the marker. Set `firstSeen` when null, always set `lastSeen`. A non-null `campaignFromLocation` replaces the stored campaign; null leaves it. Set `region` from `regionFromLanguage(navigator.language)` only when it is null.
- `campaignFromLocation({ search, hash })`: parse the query string of `search` and the part of `hash` after its first `?`. For each name in order `utm_campaign`, `audience`, check the real query string and then the hash query string. Trim the value, skip blanks, return the first, lowercased.
- `regionFromLanguage(tag)`: split on `-` or `_`, skip the language subtag, stop at any one-character subtag (an extension), and return the first remaining subtag that is exactly two ASCII letters, uppercased.
- `recordView`: move `vehicleSlug` to the front without a duplicate, cap at 20, and increment `categories[categorySlug]` only when a slug is given.
- `setOverrides`: an absent key is unchanged, `null` clears, audiences are deduplicated strings, a region that is not two letters becomes null.
- While disabled, `recordBoot`, `recordView` and `setOverrides` change nothing. `reset()` always removes both keys and the in-memory copy.
- `viewFrom`: `vehicle` gives `vehicleSlug` from `data.entry.fields.slug` and `categorySlug` from `fields.category?.fields?.slug` when present; `vehicleCategory` gives `categorySlug`; every other view, and null data, gives null.

Add `<link rel="modulepreload" href="js/signals.js">` to `site/index.html`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test test/signals.test.js && npm test`
Expected: PASS (the preload test passes with the new link).

- [ ] **Step 5: Commit**

```bash
git add site/js/signals.js site/index.html test/signals.test.js
git commit -m "Add the visitor profile and signals module"
```

---

### Task 4: Audience resolution

**Files:**
- Create: `site/js/audience.js`
- Create: `test/audience.test.js`
- Modify: `site/index.html` (add `<link rel="modulepreload" href="js/audience.js">` between the `app.js` and `js/cda.js` lines)

**Interfaces:**
- Consumes: `effectiveRegion(profile)` from `site/js/signals.js` (Task 3); the `Profile` shape; resolved `audience` entries (`{ sys, fields }`, with `interestCategories` and `interestVehicles` resolved at include 1, and `null` for unresolved links).
- Produces, from `site/js/audience.js`:

```js
/** audiences: resolved audience entries; null and non-entries are ignored. */
export function createLocalProvider(audiences): { resolve(profile): Set<string> }

/** warn defaults to console.warn. A provider that throws is skipped with one warning. */
export function createResolver({ providers = [], warn = console.warn } = {}): { audiencesFor(profile): Set<string> }
```

Override semantics: `profile.overrides?.audiences` that is an array, even an empty one, replaces the computed set. `null` or undefined means no override.

- [ ] **Step 1: Write the failing tests**

Create `test/audience.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLocalProvider, createResolver } from '../site/js/audience.js';

const aud = (key, fields = {}) => ({ sys: { id: `aud-${key}` }, fields: { name: key, key, ...fields } });
const cat = (slug) => ({ sys: { id: `cat-${slug}` }, fields: { slug } });
const veh = (slug) => ({ sys: { id: `veh-${slug}` }, fields: { slug } });
const profile = (over = {}) => ({
  version: 1, visits: 1, firstSeen: null, lastSeen: null, viewed: { vehicles: [], categories: {} },
  campaign: null, region: null, overrides: { audiences: null, region: null }, ...over,
});
const keys = (audiences, p) => [...createLocalProvider(audiences).resolve(p)].sort();

test('each rule matches alone', () => {
  const cases = [
    [aud('a', { interestCategories: [cat('supercars')] }), profile({ viewed: { vehicles: [], categories: { supercars: 2 } } }), true],
    [aud('a', { interestCategories: [cat('supercars')] }), profile({ viewed: { vehicles: [], categories: { supercars: 0, gt: 1 } } }), false],
    [aud('a', { interestVehicles: [veh('750s')] }), profile({ viewed: { vehicles: ['750s'], categories: {} } }), true],
    [aud('a', { interestVehicles: [veh('750s')] }), profile({ viewed: { vehicles: ['artura'], categories: {} } }), false],
    [aud('a', { visitorType: 'first-time' }), profile({ visits: 1 }), true],
    [aud('a', { visitorType: 'first-time' }), profile({ visits: 0 }), true],
    [aud('a', { visitorType: 'first-time' }), profile({ visits: 2 }), false],
    [aud('a', { visitorType: 'returning' }), profile({ visits: 2 }), true],
    [aud('a', { visitorType: 'returning' }), profile({ visits: 1 }), false],
    [aud('a', { minVisits: 3 }), profile({ visits: 3 }), true],
    [aud('a', { minVisits: 3 }), profile({ visits: 2 }), false],
    [aud('a', { campaigns: ['TrackDay'] }), profile({ campaign: 'trackday' }), true],
    [aud('a', { campaigns: ['trackday'] }), profile({ campaign: null }), false],
    [aud('a', { regions: ['GB'] }), profile({ region: 'gb' }), true],
    [aud('a', { regions: ['GB'] }), profile({ region: 'FR', overrides: { audiences: null, region: 'GB' } }), true],
    [aud('a', { regions: ['GB'] }), profile({ region: 'GB', overrides: { audiences: null, region: 'FR' } }), false],
  ];
  for (const [audience, p, matches] of cases) assert.deepEqual(keys([audience], p), matches ? ['a'] : [], JSON.stringify(audience.fields));
});

test('matchMode all needs every populated rule and any needs one; unknown values use the defaults', () => {
  const rules = { visitorType: 'returning', campaigns: ['trackday'] };
  const returningOnly = profile({ visits: 2 });
  assert.deepEqual(keys([aud('a', { ...rules, matchMode: 'all' })], returningOnly), []);
  assert.deepEqual(keys([aud('a', { ...rules, matchMode: 'any' })], returningOnly), ['a']);
  assert.deepEqual(keys([aud('a', rules)], returningOnly), [], 'the default is all');
  assert.deepEqual(keys([aud('a', { ...rules, matchMode: 'sometimes' })], returningOnly), [], 'unknown matchMode is all');
  assert.deepEqual(keys([aud('a', { visitorType: 'weekly' })], profile({ visits: 5 })), [], 'unknown visitorType is any, so no rule is populated');
});

test('an audience with no populated rules, or an external source, never matches locally', () => {
  const busy = profile({ visits: 9, campaign: 'trackday', region: 'GB' });
  assert.deepEqual(keys([aud('none'), aud('empty', { interestCategories: [], visitorType: 'any', campaigns: [] })], busy), []);
  assert.deepEqual(keys([aud('vip', { source: 'external', visitorType: 'returning' })], busy), []);
});

test('unresolved rule links are ignored', () => {
  const seen = profile({ viewed: { vehicles: [], categories: { supercars: 1 } } });
  assert.deepEqual(keys([aud('a', { interestCategories: [null] })], seen), [], 'a rule of only unresolved links is empty');
  assert.deepEqual(keys([aud('a', { interestCategories: [null, cat('supercars')] })], seen), ['a']);
});

test('the local provider tolerates a profile with missing or wrong-shaped fields', () => {
  const audiences = [null, {}, aud('a', { visitorType: 'returning' }), aud('b', { interestCategories: [cat('supercars')] })];
  for (const bad of [{}, { visits: 'x', viewed: null }, { viewed: { vehicles: 'no', categories: [] }, campaign: 7 }]) {
    assert.doesNotThrow(() => createLocalProvider(audiences).resolve(bad));
    assert.deepEqual([...createLocalProvider(audiences).resolve(bad)], []);
  }
  assert.deepEqual([...createLocalProvider(undefined).resolve(profile())], []);
});

test('the resolver unions providers and an override replaces the computed set', () => {
  const fixed = (...found) => ({ resolve: () => new Set(found) });
  const resolver = createResolver({ providers: [fixed('uk'), fixed('uk', 'vip')] });
  assert.deepEqual([...resolver.audiencesFor(profile())].sort(), ['uk', 'vip']);
  const forced = (audiences) => profile({ overrides: { audiences, region: null } });
  assert.deepEqual([...resolver.audiencesFor(forced(['returning']))], ['returning'], 'replaced, not added to');
  assert.deepEqual([...resolver.audiencesFor(forced([]))], [], 'an empty array forces the defaults');
  assert.deepEqual([...resolver.audiencesFor(forced(null))].sort(), ['uk', 'vip']);
  assert.deepEqual([...createResolver().audiencesFor(profile())], []);
});

test('a provider that throws is skipped with one warning', () => {
  const warnings = [];
  const resolver = createResolver({
    providers: [{ resolve: () => { throw new Error('cdp down'); } }, { resolve: () => new Set(['uk']) }],
    warn: (message) => warnings.push(message),
  });
  assert.deepEqual([...resolver.audiencesFor(profile())], ['uk']);
  assert.equal(warnings.length, 1);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/audience.test.js`
Expected: FAIL (`Cannot find module '../site/js/audience.js'`).

- [ ] **Step 3: Implement `site/js/audience.js`**

The spec's rule table fixes the behavior. Decisions it leaves open:

- Skip any entry that is not a resolved entry, has no `fields.key`, or has `source === 'external'`.
- A rule is populated when: a link list still has entries after dropping unresolved ones; `visitorType` is `first-time` or `returning`; `minVisits` is a finite number (zero counts); `campaigns` or `regions` is a non-empty array.
- No populated rules means no match. `matchMode: 'any'` needs one passing rule, anything else needs all of them.
- Read the profile defensively: non-finite `visits` is 0, a non-array `viewed.vehicles` is empty, a non-object `viewed.categories` is empty, a non-string `campaign` is null. Compare campaigns and regions case-insensitively, with the region from `effectiveRegion(profile)`.
- `audiencesFor` unions provider results in a `Set`, catches a throwing provider (one `warn` call), then applies the override rule above.

Add `<link rel="modulepreload" href="js/audience.js">` to `site/index.html`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test test/audience.test.js && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add site/js/audience.js site/index.html test/audience.test.js
git commit -m "Add local audience resolution behind a provider interface"
```

---

### Task 5: Pick a variant and render it in sections and the vehicle page

**Files:**
- Create: `site/js/render/personalized.js`
- Modify: `site/js/render/sections.js:11-24`
- Modify: `site/js/render/vehicle.js` (imports at line 9-27; enquire button at line 85; banner at lines 343-347)
- Modify: `test/render.test.js` (imports at the top; new tests appended)
- Modify: `site/index.html` (add `<link rel="modulepreload" href="js/render/personalized.js">` between `page.js` and `placeholder.js`)

**Interfaces:**
- Consumes: `contentTypeOf`, `isEntry`, `anchor` from `render/common.js`; `attrs`, `raw` from `dom.js`; `ctx.audiences` (a `Set` of audience keys, undefined means empty; supplied by Task 6); `ctx.linkHref`.
- Produces, from `site/js/render/personalized.js`:

```js
/** Returns the first variant content whose audience key is active, else the default. variant is the audience key, or null for the default. */
export function pick(entry, audienceKeys, { warn = console.warn } = {}): { content: Entry | null, variant: string | null }

/** Adds data-personalized, data-variant and data-personalized-title to the first opening tag of markup. */
export function stampPersonalization(markup, entry, variant): SafeHtml | ''

/** pick, then render the chosen content with renderContent(content, ctx), then stamp it. Passes ctx.warn to pick when present. */
export function renderPersonalized(entry, ctx, renderContent): SafeHtml | ''
```

and from `site/js/render/sections.js`: `export function renderSection(entry, ctx): markup | ''`, which renders any section entry, resolving a `personalizedContent` entry through `renderPersonalized(entry, ctx, renderSection)`. `renderSections` calls it for each item.

The spec says the panel reads `data-personalized` and `data-variant`. The panel label also needs the wrapper title, so the stamp adds a third attribute, `data-personalized-title`, and the panel label (Task 7) reads it.

- [ ] **Step 1: Write the failing tests**

Add to the imports of `test/render.test.js`:

```js
import { pick, stampPersonalization } from '../site/js/render/personalized.js';
import { renderSections } from '../site/js/render/sections.js';
```

Append to `test/render.test.js`:

```js
// ---------------------------------------------------------------------------
// personalized content
// ---------------------------------------------------------------------------

const typed = (type, fields, id) => ({ sys: { id, type: 'Entry', contentType: { sys: { type: 'Link', linkType: 'ContentType', id: type } } }, fields });
const audienceOf = (key) => typed('audience', { name: key, key }, `aud-${key}`);
const variantOf = (key, content) => typed('contentVariant', { title: `For ${key}`, audience: audienceOf(key), content }, `var-${key}`);
const wrapperOf = (id, fallback, variants = []) => typed('personalizedContent', { title: `Slot ${id}`, default: fallback, variants }, id);
const bannerOf = (heading) => typed('bannerButton', { heading, theme: 'carbon' }, `banner-${heading}`);
const linkOf = (label, url, id) => typed('link', { label, externalUrl: url, style: 'secondary' }, id);
const recorder = () => { const log = []; return { log, warn: (message) => log.push(message) }; };
const joined = (list, ctx) => renderSections(list, ctx).map(String).join('');

test('pick returns the first variant whose audience is active, else the default', () => {
  const slot = wrapperOf('w1', bannerOf('Default'), [variantOf('uk', bannerOf('UK')), variantOf('returning', bannerOf('Returning'))]);
  const both = pick(slot, new Set(['returning', 'uk']));
  assert.equal(both.variant, 'uk');
  assert.equal(both.content.fields.heading, 'UK');
  assert.equal(pick(slot, new Set(['returning'])).variant, 'returning');
  assert.deepEqual(pick(slot, new Set()), { content: slot.fields.default, variant: null });
  assert.equal(pick(slot, undefined).content, slot.fields.default);
});

test('pick skips broken variants and nested wrappers with one warning each', () => {
  const { log, warn } = recorder();
  const slot = wrapperOf('w2', bannerOf('Default'), [
    null,
    typed('contentVariant', { title: 'No audience', audience: null, content: bannerOf('A') }, 'v-a'),
    typed('contentVariant', { title: 'No content', audience: audienceOf('uk'), content: null }, 'v-b'),
    variantOf('uk', wrapperOf('inner', bannerOf('Inner'))),
    variantOf('uk', bannerOf('Good')),
  ]);
  const picked = pick(slot, new Set(['uk']), { warn });
  assert.equal(picked.content.fields.heading, 'Good');
  assert.equal(picked.variant, 'uk');
  assert.equal(log.length, 4);
  assert.ok(log.some((message) => /nested/i.test(message)));
});

test('pick returns no content and one warning when the default does not resolve', () => {
  const { log, warn } = recorder();
  const unresolved = wrapperOf('w3', null, [variantOf('uk', bannerOf('UK'))]);
  assert.deepEqual(pick(unresolved, new Set(), { warn }), { content: null, variant: null });
  assert.equal(log.length, 1);
  assert.equal(pick(unresolved, new Set(['uk']), { warn }).variant, 'uk', 'a matching variant does not need the default');
  const nested = wrapperOf('w4', wrapperOf('inner', bannerOf('Inner')));
  assert.equal(pick(nested, new Set(), { warn }).content, null);
  assert.equal(log.length, 2);
});

test('stampPersonalization marks the first opening tag, even after leading whitespace', () => {
  const { ctx } = makeCtx();
  const slot = wrapperOf('pc-1', bannerOf('Default'));
  const markup = String(registry.bannerButton(slot.fields.default, ctx));
  assert.match(markup, /^\s+<section /);
  const stamped = String(stampPersonalization(markup, slot, null));
  assert.match(stamped, /^\s*<section data-personalized="pc-1" data-variant="default" data-personalized-title="Slot pc-1" class="banner /);
  assert.equal((stamped.match(/data-personalized=/g) || []).length, 1);
  assert.match(String(stampPersonalization(markup, slot, 'uk')), /data-variant="uk"/);
  assert.equal(String(stampPersonalization('  ', slot, null)), '', 'empty markup stays empty');
  assert.equal(String(stampPersonalization('plain text', slot, null)), 'plain text');
  const quoted = wrapperOf('pc-2', bannerOf('x'));
  quoted.fields.title = 'A "quoted" slot';
  assert.match(String(stampPersonalization('<a href="#/">x</a>', quoted, null)), /data-personalized-title="A &quot;quoted&quot; slot"/);
});

test('renderSections resolves a personalizedContent section from ctx.audiences', () => {
  const slot = wrapperOf('pc-home', bannerOf('Default banner'), [variantOf('trackday', bannerOf('Trackday banner'))]);
  const intro = typed('textBlock', { heading: 'Intro', body: { nodeType: 'document', data: {}, content: [] }, variant: 'header' }, 'tb');
  const fired = joined([intro, slot], makeCtx({ audiences: new Set(['trackday']) }).ctx);
  assert.match(fired, /Intro[\s\S]*Trackday banner/);
  assert.match(fired, /data-personalized="pc-home" data-variant="trackday"/);
  assert.doesNotMatch(fired, /Default banner/);
  const fallback = joined([slot], makeCtx().ctx);
  assert.match(fallback, /Default banner/);
  assert.match(fallback, /data-variant="default"/);
  assert.equal(joined([wrapperOf('pc-empty', typed('ctaGroup', { heading: 'x', links: [] }, 'cta'))], makeCtx().ctx), '', 'empty markup stays empty');
  assert.equal(joined([wrapperOf('pc-link', linkOf('L', '#/x', 'l'))], makeCtx().ctx), '', 'a link has no section renderer');
});

test('vehicle: a personalized MSO banner resolves per audience', () => {
  const entry = clone(vehicles.full);
  entry.fields.msoBanner = wrapperOf('pc-mso', entry.fields.msoBanner, [variantOf('returning', bannerOf('Welcome back'))]);
  const returning = renderView('vehicle', { entry, variants: [] }, { audiences: new Set(['returning']) }).out;
  assert.match(returning, /data-personalized="pc-mso" data-variant="returning"[^>]*>/);
  assert.match(returning, /Welcome back/);
  assert.doesNotMatch(returning, /Make it yours/);
  const base = renderView('vehicle', { entry, variants: [] }, { audiences: new Set() }).out;
  assert.match(base, /Make it yours/);
  assert.match(base, /data-variant="default"/);
});

test('vehicle: enquiryCta replaces the Enquire button and enquiryUrl is the fallback', () => {
  const withCta = (cta) => { const entry = clone(vehicles.full); entry.fields.enquiryCta = cta; return entry; };
  const quiet = { warn: () => {} };
  const slot = wrapperOf('pc-cta', linkOf('Enquire now', '#/enquire/750s', 'l-default'), [variantOf('uk', linkOf('Visit a UK retailer', '#/retailers', 'l-uk'))]);
  const uk = renderView('vehicle', { entry: withCta(slot), variants: [] }, { audiences: new Set(['uk']) }).out;
  assert.match(uk, /<a data-personalized="pc-cta" data-variant="uk" data-personalized-title="Slot pc-cta" class="btn btn-secondary btn--sm" href="#\/retailers">Visit a UK retailer<\/a>/);
  assert.doesNotMatch(uk, /href="#\/enquire\/750s"[^>]*>Enquire</);
  const base = renderView('vehicle', { entry: withCta(slot), variants: [] }, { audiences: new Set() }).out;
  assert.match(base, /data-variant="default"[^>]*>Enquire now</);
  const direct = renderView('vehicle', { entry: withCta(linkOf('Talk to us', '#/contact', 'l-direct')), variants: [] }).out;
  assert.match(direct, /class="btn btn-secondary btn--sm" href="#\/contact">Talk to us</);
  assert.doesNotMatch(direct, /data-personalized/);
  const unresolved = renderView('vehicle', { entry: withCta(wrapperOf('pc-none', null)), variants: [] }, quiet).out;
  assert.match(unresolved, /href="#\/enquire\/750s"[^>]*>Enquire</, 'an empty slot falls back to enquiryUrl');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/render.test.js`
Expected: FAIL (`Cannot find module '../site/js/render/personalized.js'`).

- [ ] **Step 3: Implement `site/js/render/personalized.js` and the integrations**

Write `pick`, `stampPersonalization` and `renderPersonalized` as specified above. Decisions the signatures leave open:

- `pick` copies `audienceKeys` into a `Set` (undefined is empty). It walks `fields.variants` in order. A null variant, a variant with no resolved audience (or one without a key), a variant with no resolved content, and a variant whose content is `personalizedContent` each log one warning through `warn` and are skipped. The first valid variant whose key is in the set wins. Otherwise it returns the default. A default that is null or `personalizedContent` logs one warning and returns `{ content: null, variant: null }`.
- `stampPersonalization` returns `''` for markup that is empty after trimming. Otherwise it inserts `attrs({ 'data-personalized': entry.sys.id, 'data-variant': variant ?? 'default', 'data-personalized-title': entry.fields.title })` immediately after the tag name of the first element tag, matched with `/<([a-zA-Z][\w:-]*)/`, and returns it wrapped with `raw()`. Markup with no element tag comes back unchanged.
- `renderPersonalized` returns `''` when `pick` finds no content.

In `sections.js`, extract `renderSection(entry, ctx)` (the renderer-map lookup, or `renderPersonalized(entry, ctx, renderSection)` for `personalizedContent`) and have `renderSections` call it. `registry` keys do not change.

In `vehicle.js`:
- Add `function enquiryItem(ctx, entry)` returning the `<li>` for the enquire slot. When `f.enquiryCta` is a resolved entry, render it with `renderPersonalized(cta, ctx, renderCtaLink)` for a `personalizedContent` entry, or `renderCtaLink(cta, ctx)` otherwise, where `renderCtaLink(link, ctx)` returns `anchor(ctx.linkHref(link), 'btn btn-secondary btn--sm', link.fields.label)` for a `link` entry and `''` for any other type. When that markup is non-empty, wrap it in `<li>`. Otherwise fall back to today's `enquiryUrl` button, or nothing when `enquiryUrl` is unset.
- Replace the inline Enquire `<li>` at line 85 with `${enquiryItem(ctx, entry)}`.
- Resolve the banner with `renderPersonalized(f.msoBanner, ctx, renderSection)` when it is a `personalizedContent` entry (import `renderSection` from `./sections.js`). An unwrapped banner still goes through `renderBanner`.

Add the modulepreload link.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test test/render.test.js && npm test`
Expected: PASS, including every existing render test (the unwrapped banner and `enquiryUrl` paths are unchanged).

- [ ] **Step 5: Commit**

```bash
git add site/js/render site/index.html test/render.test.js
git commit -m "Render personalized sections, the vehicle banner and the enquiry CTA"
```

---

### Task 6: Load audiences, deepen includes and wire the profile into the app

**Files:**
- Modify: `site/js/cda.js:196` (add `getAudiences`) and `:253-271` (returned object)
- Modify: `site/js/router.js:194-230` (include depth; export `CONTENT_INCLUDE`)
- Modify: `site/js/prefetch.js:46-55` (include depth)
- Modify: `scripts/verify-content.js:95` (`include: 4` to `include: 6`)
- Modify: `site/app.js` (imports; `state`; `buildContext` at line 164; `handleRoute` at line 286; `boot` at lines 321-337)
- Test: `test/cda.test.js`, `test/router.test.js`, `test/prefetch.test.js`

**Interfaces:**
- Consumes: `createLocalProvider`, `createResolver` (Task 4); `load`, `recordBoot`, `recordView`, `viewFrom` (Task 3); `ctx.audiences` is read by the renderers (Task 5).
- Produces: `cda.getAudiences(): Promise<Entry[]>`; `export const CONTENT_INCLUDE = 6` from `site/js/router.js`; in `app.js`, `state.audiences`, `state.audiencesFailed`, `state.resolver`, `state.matched` (the `Set` used for the latest render), and `ctx.audiences: Set<string>` on every render context. Task 7 reads those state fields.

Prefetch must use the same include depth as the route loader. The client caches by full URL, and `include` is part of the URL, so a prefetch at another depth would never serve the route load.

- [ ] **Step 1: Write the failing tests**

Append to `test/cda.test.js`:

```js
test('getAudiences requests audience entries at include 1 with limit 100', async () => {
  const calls = [];
  const fakeFetch = async (url) => {
    calls.push(new URL(url));
    return { ok: true, status: 200, json: async () => ({ items: [{ sys: { id: 'aud-uk', type: 'Entry' }, fields: { key: 'uk', name: 'United Kingdom' } }], includes: {} }) };
  };
  const client = createClient({ spaceId: 'space', deliveryToken: 'tok' }, { fetch: fakeFetch });
  const audiences = await client.getAudiences();
  assert.equal(audiences[0].fields.key, 'uk');
  assert.equal(calls[0].searchParams.get('content_type'), 'audience');
  assert.equal(calls[0].searchParams.get('include'), '1');
  assert.equal(calls[0].searchParams.get('limit'), '100');
});

test('getAudiences returns an empty list, with one warning, before the audience type exists', async () => {
  const warnings = [];
  const fakeFetch = async () => ({ ok: false, status: 400, statusText: 'Bad Request', json: async () => ({ details: { errors: [{ name: 'unknownContentType' }] } }) });
  const client = createClient({ spaceId: 's', deliveryToken: 't' }, { fetch: fakeFetch, warn: (m) => warnings.push(m) });
  assert.deepEqual(await client.getAudiences(), []);
  assert.equal(warnings.length, 1);
});
```

In `test/router.test.js`, add `CONTENT_INCLUDE` to the import from `../site/js/router.js` and append:

```js
test('loadRoute: home, modular pages, stories and vehicles load at include depth 6', async () => {
  const cda = fakeCda({
    page: { home: entry('page', { slug: 'home' }, 'p-home'), legacy: entry('page', { slug: 'legacy' }, 'p-legacy') },
    vehicle: { '750s': entry('vehicle', { slug: '750s' }, 'v-750s') },
    story: { 'five-facts': entry('story', { slug: 'five-facts' }, 's-1') },
  });
  for (const hash of ['#/', '#/750s', '#/legacy', '#/post/five-facts']) await loadRoute(matchRoute(hash), cda);
  assert.equal(CONTENT_INCLUDE, 6);
  assert.deepEqual(cda.includes, [
    ['page', 'home', 6],
    ['vehicle', '750s', 6],
    ['vehicle', 'legacy', 6],
    ['page', 'legacy', 6],
    ['story', 'five-facts', 6],
  ]);
});
```

In `test/prefetch.test.js`, rename the test `prefetchFamily fetches each sibling at include depth 4 through the scheduler and can be cancelled` to say depth 6, and change its expectation to `assert.deepEqual(calls, [['vehicle', '750s', 6]]);`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/cda.test.js test/router.test.js test/prefetch.test.js`
Expected: FAIL (`client.getAudiences is not a function`; `CONTENT_INCLUDE` is not exported; the prefetch call still uses depth 4).

- [ ] **Step 3: Implement the data layer**

- `cda.js`: `getAudiences()` calls `getEntries({ content_type: 'audience', include: 1, limit: 100 })`, with a one-line doc comment. Add it to the returned object.
- `router.js`: `export const CONTENT_INCLUDE = 6;` with a comment that the personalized wrapper adds two link levels. Pass it as the third argument of `cda.getBySlug` for the home page, the vehicle, the modular page and the story (the home call has no third argument today). Leave the category call at 3 and every other query alone.
- `prefetch.js`: import `CONTENT_INCLUDE` from `./router.js` and use it in `prefetchFamily`; update the doc comment that says "include depth 4".
- `scripts/verify-content.js`: `include: 6`, so its dangling-link check can reach the personalized chain.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test test/cda.test.js test/router.test.js test/prefetch.test.js && npm test`
Expected: PASS.

- [ ] **Step 5: Wire `site/app.js`**

`app.js` touches the DOM and has no unit tests. Make these changes, then read the diff against this list.

1. Import `createLocalProvider`, `createResolver` from `./js/audience.js` and `load`, `recordBoot`, `recordView`, `viewFrom` from `./js/signals.js`.
2. Extend `state` with `audiences: []`, `audiencesFailed: false`, `resolver: null`, `matched: new Set()`.
3. In `boot`, call `recordBoot(window.location, navigator)` right after `bindShell()`, before the first route load, so the first render sees the campaign and visit count.
4. Add `cda.getAudiences()` as a third entry in the `Promise.allSettled` with site settings and categories. When it is fulfilled, set `state.audiences`. When it is rejected, log one `console.warn('audiences unavailable:', reason)` and set `state.audiencesFailed = true`. Then set `state.resolver = createResolver({ providers: [createLocalProvider(state.audiences)] })`.
5. In `buildContext`, compute the audience set once per call: `state.resolver ? state.resolver.audiencesFor(load()) : new Set()`. Store it in `state.matched` and return it as `audiences` on the context.
6. In `handleRoute`, after `state.current = { view, data }` (the end of the success path, so never on an error or a stale request), call `const seen = viewFrom(view, data); if (seen) recordView(seen);`.

- [ ] **Step 6: Verify the wiring**

Run: `node --check site/app.js && npm test`
Expected: no output from `node --check` (exit 0); all tests pass. Then check the diff for the six points above.

- [ ] **Step 7: Commit**

```bash
git add site scripts/verify-content.js test
git commit -m "Load audiences, deepen includes to 6 and record views after render"
```

---

### Task 7: Demo panel with in-place re-render

**Files:**
- Create: `site/js/panel.js`
- Create: `test/panel.test.js`
- Modify: `site/app.js` (`state`, `handleRoute`, a new `rerenderCurrent`, `boot`)
- Modify: `site/styles.css` (append a `.demo-panel` block at the end of the file)
- Modify: `site/index.html` (add `<link rel="modulepreload" href="js/panel.js">` between `js/motion.js` and `js/prefetch.js`)

**Interfaces:**
- Consumes: `load`, `setOverrides`, `reset`, `effectiveRegion` (Task 3); `state.audiences`, `state.audiencesFailed`, `state.matched` (Task 6); `swapInPlace(content, isCurrent)` and `buildContext` in `app.js`; the `data-personalized`, `data-variant` and `data-personalized-title` attributes (Task 5).
- Produces, from `site/js/panel.js` (no DOM access at import):

```js
export const PANEL_KEY = 'mcl.panel';            // sessionStorage; value '1' while open

export function wantsPanel(location: { search: string, hash: string }): boolean   // ?demo=1 in either query string

/** Returns a keydown handler. Calls onTrigger when Shift+D is pressed three times, the third at most 2000 ms after the first of the three. */
export function createShortcut({ onTrigger, now = Date.now }): (event) => void

/** Markup for the panel; '' when closed. audiences are resolved audience entries; matched is a Set of keys. */
export function renderPanel({ open, profile, audiences, matched, unavailable }): SafeHtml | ''

/** control: { action: 'force-audience', key, checked } | { action: 'region', value } | { action: 'clear-overrides' } | { action: 'reset-profile' } */
export function applyControl(control, { signals, audienceKeys }): void   // signals: { load, setOverrides, reset }

/** storage returns a Storage. Wires listeners on mount and keydownTarget. */
export function initPanel({ mount, location, storage, keydownTarget, signals, getModel, rerender }): { refresh(): void, destroy(): void }
```

Markup contract for `renderPanel` (tests read it): root `<aside class="demo-panel" aria-label="Personalization demo">`. Read-only values sit in elements carrying `data-panel-visits`, `data-panel-campaign`, `data-panel-region` (the effective region), and the lists `data-panel-categories` (items `slug: count`), `data-panel-vehicles` and `data-panel-matched` (items `Name (source)`, `source` defaulting to `local`). Each audience gets `<input type="checkbox" data-control="force-audience" data-key="<key>">` plus `checked` when forced. The region field is `<input data-control="region" name="region" maxlength="2" value="<override>">`. Buttons carry `data-control="clear-overrides"`, `data-control="reset-profile"` and `data-control="close"`. When `unavailable` is true the panel shows the text `Audiences unavailable` and no checkboxes.

- [ ] **Step 1: Write the failing tests**

Create `test/panel.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderPanel, applyControl, createShortcut, wantsPanel } from '../site/js/panel.js';

const audience = (key, name, source = 'local') => ({ fields: { key, name, source } });
const AUDIENCES = [
  audience('supercar-fans', 'Supercar fans'), audience('returning', 'Returning visitors'), audience('trackday', 'Track day campaign'),
  audience('uk', 'United Kingdom'), audience('vip', 'VIP guests', 'external'),
];
const KEYS = AUDIENCES.map((a) => a.fields.key);
const PROFILE = {
  version: 1, visits: 3, firstSeen: null, lastSeen: null,
  viewed: { vehicles: ['750s', '750s-spider'], categories: { supercars: 2, gt: 1 } },
  campaign: 'trackday', region: 'GB', overrides: { audiences: null, region: null },
};
const model = (over = {}) => ({ open: true, profile: PROFILE, audiences: AUDIENCES, matched: new Set(['returning', 'vip']), unavailable: false, ...over });
const panel = (over) => String(renderPanel(model(over)));

test('a closed panel renders nothing', () => {
  assert.equal(String(renderPanel(model({ open: false }))), '');
});

test('the open panel shows the profile and the matched audiences with their source', () => {
  const out = panel();
  assert.match(out, /<aside class="demo-panel" aria-label="Personalization demo">/);
  assert.match(out, /data-panel-visits[^>]*>3</);
  assert.match(out, /data-panel-campaign[^>]*>trackday</);
  assert.match(out, /data-panel-region[^>]*>GB</);
  assert.match(out, /data-panel-categories[\s\S]*?supercars: 2[\s\S]*?gt: 1/);
  assert.match(out, /data-panel-vehicles[\s\S]*?750s[\s\S]*?750s-spider/);
  const matched = out.match(/data-panel-matched[\s\S]*?<\/ul>/)[0];
  assert.match(matched, /Returning visitors \(local\)/);
  assert.match(matched, /VIP guests \(external\)/);
  assert.doesNotMatch(matched, /Track day campaign/);
});

test('force controls list every audience and reflect the overrides', () => {
  assert.equal((panel().match(/data-control="force-audience"/g) || []).length, 5);
  const forced = panel({ profile: { ...PROFILE, overrides: { audiences: ['uk'], region: 'fr' } } });
  assert.match(forced, /data-control="force-audience" data-key="uk" checked/);
  assert.doesNotMatch(forced, /data-key="vip" checked/);
  assert.match(forced, /data-panel-region[^>]*>FR</, 'the shown region is the effective one');
  assert.match(forced, /name="region"[^>]*value="fr"/);
  for (const action of ['clear-overrides', 'reset-profile', 'close']) assert.match(panel(), new RegExp(`data-control="${action}"`));
});

test('an unavailable audience list is stated and offers no force controls; names are escaped', () => {
  const out = panel({ audiences: [], matched: new Set(), unavailable: true });
  assert.match(out, /audiences unavailable/i);
  assert.equal((out.match(/force-audience/g) || []).length, 0);
  const hostile = panel({ audiences: [audience('x', '<script>alert(1)</script>')], matched: new Set(['x']) });
  assert.doesNotMatch(hostile, /<script>/);
  assert.match(hostile, /&lt;script&gt;/);
});

function fakeSignals(overrides = { audiences: null, region: null }) {
  const calls = [];
  return { calls, load: () => ({ overrides }), setOverrides: (value) => calls.push(['setOverrides', value]), reset: () => calls.push(['reset']) };
}

test('force-audience builds the forced set in audience order and clears it when empty', () => {
  const add = fakeSignals({ audiences: ['uk'], region: null });
  applyControl({ action: 'force-audience', key: 'returning', checked: true }, { signals: add, audienceKeys: KEYS });
  assert.deepEqual(add.calls, [['setOverrides', { audiences: ['returning', 'uk'] }]]);
  const remove = fakeSignals({ audiences: ['uk'], region: null });
  applyControl({ action: 'force-audience', key: 'uk', checked: false }, { signals: remove, audienceKeys: KEYS });
  assert.deepEqual(remove.calls, [['setOverrides', { audiences: null }]]);
});

test('region, clear-overrides and reset-profile call the matching signals functions', () => {
  const s = fakeSignals();
  applyControl({ action: 'region', value: ' gb ' }, { signals: s, audienceKeys: KEYS });
  applyControl({ action: 'region', value: '' }, { signals: s, audienceKeys: KEYS });
  applyControl({ action: 'clear-overrides' }, { signals: s, audienceKeys: KEYS });
  applyControl({ action: 'reset-profile' }, { signals: s, audienceKeys: KEYS });
  assert.deepEqual(s.calls, [
    ['setOverrides', { region: 'gb' }],
    ['setOverrides', { region: null }],
    ['setOverrides', { audiences: null, region: null }],
    ['reset'],
  ]);
});

test('wantsPanel reads ?demo=1 from the real or the hash query string', () => {
  const cases = [['?demo=1', '#/', true], ['', '#/750s?demo=1', true], ['?x=1&demo=1', '#/', true],
    ['?demo=0', '#/', false], ['?demo=10', '#/', false], ['', '#/', false]];
  for (const [search, hash, expected] of cases) assert.equal(wantsPanel({ search, hash }), expected, `${search}${hash}`);
});

const press = (extra = {}) => ({
  key: 'D', shiftKey: true, ctrlKey: false, metaKey: false, altKey: false, repeat: false,
  target: { tagName: 'BODY', isContentEditable: false }, ...extra,
});
function shortcut() {
  let clock = 0;
  let fired = 0;
  const onKey = createShortcut({ onTrigger: () => { fired += 1; }, now: () => clock });
  return { at(ms, event = press()) { clock = ms; onKey(event); }, get fired() { return fired; } };
}

test('three Shift+D presses within two seconds fire once, then the count starts over', () => {
  const s = shortcut();
  s.at(0); s.at(900);
  assert.equal(s.fired, 0);
  s.at(1800);
  assert.equal(s.fired, 1);
  s.at(1900); s.at(2000);
  assert.equal(s.fired, 1);
  s.at(2100);
  assert.equal(s.fired, 2);
});

test('slow presses never fire, and the window slides', () => {
  const s = shortcut();
  s.at(0); s.at(1000); s.at(2500);
  assert.equal(s.fired, 0);
  s.at(2900);
  assert.equal(s.fired, 1, 'the last three presses span 1900 ms');
});

test('Shift+D in a form field, held down or with another modifier never counts', () => {
  const s = shortcut();
  const ignored = [
    press({ target: { tagName: 'INPUT' } }), press({ target: { tagName: 'TEXTAREA' } }), press({ target: { tagName: 'SELECT' } }),
    press({ target: { tagName: 'DIV', isContentEditable: true } }), press({ repeat: true }), press({ ctrlKey: true }),
    press({ metaKey: true }), press({ altKey: true }), press({ key: 'd', shiftKey: false }), press({ key: 'E' }),
  ];
  ignored.forEach((event, index) => s.at(index, event));
  assert.equal(s.fired, 0);
  s.at(20); s.at(30);
  assert.equal(s.fired, 0, 'ignored events left no count behind');
  s.at(40);
  assert.equal(s.fired, 1);
});

test('the stylesheet carries the panel and the slot outline', () => {
  const css = readFileSync(new URL('../site/styles.css', import.meta.url), 'utf8');
  assert.match(css, /\.demo-panel\s*\{/);
  assert.match(css, /body\.demo-open \[data-personalized\]\s*\{/);
  assert.match(css, /body\.demo-open \[data-personalized\]::before\s*\{[^}]*attr\(data-personalized-title\)/);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/panel.test.js`
Expected: FAIL (`Cannot find module '../site/js/panel.js'`).

- [ ] **Step 3: Implement `site/js/panel.js`**

Signatures and the markup contract are above. Decisions they leave open:

- `createShortcut` keeps the times of the last three counted presses. An event counts only when `event.key.toLowerCase() === 'd'`, `shiftKey` is true, none of `ctrlKey`, `metaKey`, `altKey` or `repeat` is set, and `event.target.tagName` is not `INPUT`, `TEXTAREA` or `SELECT` and `isContentEditable` is not true. When three presses are held and the newest is at most 2000 ms after the oldest, call `onTrigger` and clear the list.
- `wantsPanel` parses the real query string and the part of `hash` after its first `?`, and is true when `demo` equals `1` in either.
- `applyControl` maps `force-audience` to the ticked set in `audienceKeys` order (adding or removing `key` from the current forced set, and `audiences: null` when none remain), trims the `region` value and sends `null` for an empty one, `clear-overrides` to `setOverrides({ audiences: null, region: null })`, and `reset-profile` to `reset()`. `close` is handled by `initPanel`, not here.
- `renderPanel` escapes everything through `html`. The matched list shows each matched audience as `Name (source)`, in the order of `audiences`. A key in `matched` with no audience entry (a forced external key) shows as `key (forced)`.
- `initPanel` opens when `wantsPanel(location)` or `storage()` has `PANEL_KEY`, saving `'1'` (or removing the key) whenever the open state changes. Every storage access is in `try`/`catch`. Open state toggles the `demo-open` class on `mount.ownerDocument.body`, so the slot outlines need no re-render. `refresh()` sets `mount.innerHTML` from `renderPanel({ open, ...getModel() })`. A `click` on `[data-control]` and a `change` on a force checkbox or the region field build a control object, call `applyControl` with `audienceKeys` from `getModel().audiences`, then `await rerender()` and `refresh()`. The `close` button closes the panel. `keydownTarget` gets `createShortcut` with `onTrigger` toggling the open state. `destroy()` removes every listener.

Add the modulepreload link.

- [ ] **Step 4: Add the styles**

Append to `site/styles.css`, under a comment `/* Demo panel */`, using the existing tokens (`--bg-elevated`, `--fg`, `--line`, `--accent`, `--text-sm`, `--text-xs`, `--font-mono`, `--space-*`):

- `.demo-panel`: `position: fixed`, bottom-right at `var(--space-4)`, `z-index` above the sticky header's 100, width `min(22rem, calc(100vw - 2rem))`, `max-height: 70vh` with `overflow: auto`, elevated background, a 1px `--line` border with a 3px `--accent` left border, `font-size: var(--text-sm)`, padding `var(--space-4)`. Add small rules for its headings, lists and buttons so it reads cleanly, and none for the closed state (nothing is rendered).
- `body.demo-open [data-personalized]`: `position: relative`, `outline: 2px dashed var(--accent)`, `outline-offset: -2px`.
- `body.demo-open [data-personalized]::before`: `content: attr(data-personalized-title) ': ' attr(data-variant)`, absolutely positioned top-left, above the slot content, `--font-mono` at `--text-xs`, `--accent` background with dark text, `white-space: nowrap`, `pointer-events: none`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --test test/panel.test.js && npm test`
Expected: PASS.

- [ ] **Step 6: Wire the panel and the in-place re-render in `site/app.js`**

`app.js` has no unit tests. Make these changes, then read the diff against this list.

1. Import `initPanel` from `./js/panel.js`, and `setOverrides` and `reset` from `./js/signals.js` beside the existing signals imports.
2. Store the route on the current view: `state.current = { view, data, route }`. Update the `state.current` doc comment. `isFamilySwitch` reads only `view` and `data`, so it is unaffected.
3. Add `async function rerenderCurrent(cda)`. With no `state.current`, return. Otherwise capture `const requestId = state.requestId` (do not bump it, so a navigation already in flight is never cancelled and a navigation that starts later skips the swap), build `isCurrent = () => requestId === state.requestId`, render with `registry[current.view] || registry.notFound` and `buildContext(cda, current.route)`, and call `swapInPlace(content, isCurrent)`. It must not call `recordView`, scroll, move focus or start a prefetch.
4. In `boot`, after `renderShell()`, create `const mount = document.createElement('div'); mount.id = 'demo-panel'; document.body.append(mount);` and call `state.panel = initPanel({ mount, location: window.location, storage: () => window.sessionStorage, keydownTarget: document, signals: { load, setOverrides, reset }, getModel: () => ({ profile: load(), audiences: state.audiences, matched: state.matched, unavailable: state.audiencesFailed }), rerender: () => rerenderCurrent(cda) })`. Add `panel: null` to `state`.
5. Call `state.panel?.refresh()` at the end of the `handleRoute` success path, after `recordView`, so the panel shows the updated profile and matched set.

- [ ] **Step 7: Verify the wiring**

Run: `node --check site/app.js && npm test`
Expected: no output from `node --check`; all tests pass. Then check the diff for the five points above.

- [ ] **Step 8: Commit**

```bash
git add site test/panel.test.js
git commit -m "Add the demo panel with in-place re-render"
```

---

### Task 8: Document personalization and hand off the live checks

**Files:**
- Modify: `README.md` (Content model section at lines 55-72; Seed content at lines 74-88; a new "Personalization" section between "Front end" and "Enquiry form"; Tests at the end)

**Interfaces:**
- Consumes: everything above.
- Produces: user-facing documentation only. No code and no new tests; the README has no test coverage in this repo.

- [ ] **Step 1: Update the README**

Write in the Google developer documentation style (sentence case, active voice, no em dashes, no exclamation points):

- Content model: change "22 content types" to "26", and add a table row `Personalization` with `audience`, `contentVariant`, `personalizedContent`. Add one sentence that `vehicle.enquiryCta` replaces the enquire button built from `enquiryUrl`, which stays as the fallback.
- Seed content: add a bullet for the five audiences and the three personalized slots (home banner, 750S MSO banner, 750S enquiry CTA).
- New "Personalization" section covering, in short paragraphs or numbered lists:
  - The editor workflow, as the spec's four steps.
  - What the browser stores: the `mcl.profile` key in `localStorage`, the `mcl.session` marker in `sessionStorage`, nothing sent anywhere. Name the signals (visits, viewed vehicles and categories, campaign from `utm_campaign` or `audience`, region from the browser language) and that enquiry form submissions are never recorded.
  - How a variant is chosen: first matching variant in editor order, else the default, and that `include: 6` is needed because the wrapper adds two link levels.
  - How to add a CDP: implement `resolve(profile)` and add it to `providers` in `app.js`; `setEnabled(false)` in `signals.js` is the consent hook.
  - The demo panel: opens with `?demo=1` or Shift+D three times within two seconds, forces audiences or a region, clears overrides, resets the profile, and outlines each slot with its wrapper title and the variant that fired.
- Tests: add the new suites (signals, audience, panel, content model) to the list of what `npm test` covers.

- [ ] **Step 2: Verify**

Run: `npm test && npm run setup -- --dry-run`
Expected: all tests pass and the dry run ends with `Dry run passed: no problems found.`

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "Document audience personalization"
```

- [ ] **Step 4: Hand off the live checks (human steps, not run by the implementer)**

The implementer stops here and tells the human to run these against the space. The spec's Playwright check belongs to a measurement script that does not exist in this repository, so the check is written as a manual list. If you keep that script elsewhere, add the same three assertions to it.

1. Provision: `npm run setup`, then `npm run verify`. Both write to or read from the live space.
2. Serve the site with `npm run dev`. Load `http://localhost:4173/?utm_campaign=trackday#/` and confirm `[data-personalized="pc-home-banner"]` has `data-variant="trackday"`.
3. Open the panel (add `&demo=1`, or press Shift+D three times), tick `returning`, then open `#/750s`. Confirm `[data-personalized="pc-750s-mso-banner"]` has `data-variant="returning"`. Untick it and confirm the attribute becomes `default` with no page reload and no scroll jump.
