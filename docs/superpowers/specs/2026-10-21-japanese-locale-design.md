# Japanese locale design

## Goal

Add a second locale, Japanese (`ja-JP`), to the demo end to end: the
Contentful space gets the locale and localized fields, every seeded entry gets
Japanese values, and the site renders in Japanese under a `#/ja/` route prefix
with a header switcher. English stays the default and keeps today's URLs.
Contentful's locale fallback (`ja-JP` falls back to `en-US`) is part of the
demo: anything missing in Japanese renders in English.

## Constraints

- English seed files are not edited for content. Japanese lives in overlay
  files so the two can be reviewed apart.
- Translation work runs on the cheapest model tier, one dispatch per seed
  group, with a mid-tier spot check. No translation runs on the most capable
  tier.
- Imagery, slugs, routes, order, status, URLs, emails, phone numbers, and the
  enquiry webhook endpoint are shared across locales (not localized).
- Existing conventions hold: fixed-ID idempotent provisioning, `html`
  escaping, templates never touch `document`, `node --test` with fake DOM
  objects, no secrets in the repo or page.
- The Fusion scenario and Workfront side do not change.

## Space and content model

### Locale

`scripts/setup.js` ensures the locale as part of the content-type pass
(`--types-only` and full runs): if no locale with code `ja-JP` exists, create
`{ code: 'ja-JP', name: 'Japanese (Japan)', fallbackCode: 'en-US',
optional: true, contentDeliveryApi: true, contentManagementApi: true }`; if it
exists, update it when any of those differ. `en-US` stays the default locale.
New module `src/provision/locales.js` exports `ensureLocales(environment,
LOCALES, { request, log })` and the constant `LOCALES` lives in
`src/content-model.js` next to `CONTENT_TYPES`.

### Localized fields

`src/content-model.js` marks `localized: true` on these fields and nothing
else:

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

`specification.value` is localized because units and phrasing differ
("7 speed" versus "7速"); numeric-only values are copied unchanged. Asset
titles stay English.

A test asserts the localized set equals this table (so a new text field has to
make an explicit choice).

## Seeds and translations

### Overlay files

`src/seed/ja-JP/<group>.js`, one per seed group name (`assets` has none):
`vehicles`, `links`, `sections`, `stories`, `pages`, `retailers`, `site`,
`enquiry`, plus whatever `VEHICLE_SEED_GROUPS` splits into (match the existing
group names exactly; the plan lists them). Each exports a plain object:

```js
export default {
  'vehicle-750s': { name: '750S', tagline: '...', shortDescription: '...' },
  'faq-750s-1': { question: '...', answer: doc(p('...')) },
};
```

Keys are entry ids; values map localized field ids to Japanese values. Rich
text uses the same helpers from `src/seed/richtext-helpers.js`, matching the
English block structure (same number of paragraphs, headings, and list items)
so layout is comparable. `src/seed/ja-JP/index.js` merges them into
`TRANSLATIONS = { 'ja-JP': { [entryId]: { [fieldId]: value } } }`.

`src/seed/ja-JP/GLOSSARY.md` fixes terms for translators: マクラーレン for
McLaren; model names, MSO, GTS, W1, Artura, Senna, Speedtail, GT4, F1, P1, LT,
Spider, Coupé in Latin script; スーパーカー, グランドツアラー, アルティメット
(Ultimate Series), モータースポーツ, レガシー, オーナーシップ, エクスペリエンス;
polite です/ます register for body copy, noun-phrase headings; full-width
punctuation (、。) in Japanese sentences; keep numerals and units as in English
except "speed" → 速 and "mph" alongside km/h unchanged; retailer addresses stay
in English except the country name.

### Provisioning

`buildEntryFields(seed, { translations })` in `src/provision/fields.js`
emits, for each field in `seed.fields`, `{ 'en-US': value }` plus
`'ja-JP': translated` when the overlay has that entry and field. `links` and
`assets` stay `en-US` only. `provisionEntries` and `validateSeeds` receive
`TRANSLATIONS` from `scripts/setup.js` and `scripts/verify-content.js`.

`validateSeeds` adds three checks: an overlay entry id that no seed defines
is a problem; an overlay field id that is not localized for that content type
is a problem; and a localized field present in an English seed with no
Japanese value is a problem ("untranslated"), so `--dry-run` fails until
coverage is complete. The dry run prints a coverage line per group
(`ja-JP: 128/128 fields`).

`sameFields` already compares the whole localized object, so re-runs stay
idempotent.

## Front end

### Locale in the route

- `site/js/i18n.js` exports `LOCALES = { en: 'en-US', ja: 'ja-JP' }`,
  `DEFAULT_LANG = 'en'`, `langFromLocale(locale)`, `t(key, lang)`, and the
  dictionary `STRINGS` (see below).
- `matchRoute(hash)` recognises a leading `ja` segment: `#/ja`, `#/ja/750s`,
  `#/ja/enquire/gts`. It strips the segment, matches the rest as today, and
  returns `{ name, params, lang: 'ja' }`; routes without the prefix return
  `lang: 'en'`. `#/en/...` is not a route (404). The `ignore` route (in-page
  anchors) is unchanged.
- `routeFor(entry, lang)` and `linkHref(href, lang)` prefix `#/ja` when
  `lang === 'ja'`. Internal `#/` hrefs in CMS content (CTA links, nav links)
  pass through `linkHref` already, so they pick up the prefix; external links
  do not.
- `app.js` holds `state.lang`, derived from the current route on every
  navigation. When it changes, the app reloads site settings and categories
  for that locale, re-renders the shell, and sets
  `document.documentElement.lang` to `ja` or `en`.
- The CDA client takes the locale per call: `createClient(config)` returns
  the same API, and every query helper accepts the client's current
  `locale`, set with `cda.setLocale('ja-JP')`. Requests add `locale=<code>`.
  The default is `en-US`.

### Switcher

`renderHeader(siteSettings, categories, { lang, route })` adds a
`nav.lang-switch` with two links, `EN` and `日本語`, `aria-label` from the
dictionary ("Language"), the current one marked `aria-current="true"`.
Each link targets the current route in the other language
(`#/ja/750s` ↔ `#/750s`). On the enquire success panel and 404 views the
switcher still works because it derives from `route`, not from loaded data.

### Dictionary

`STRINGS` holds every chrome string the templates hard-code today, in both
languages, keyed in English snake case. The plan enumerates the keys from a
grep of `site/js/shell.js`, `site/js/render/*.js`, `site/js/enquiry.js`,
and `site/app.js`; the set includes: skip_to_content, menu, main_navigation,
breadcrumb, home, back_home, back_to (with a `{name}` placeholder), models,
current_models, explore, explore_models, find_a_retailer, retailers,
retailers_intro, no_retailers, follow_us, subscribe, downloads, overview,
in_detail, specifications, full_specifications, lineage, related_models,
related_stories, more_stories, continue_your_journey, change_model_variant,
previous_slide, next_slide, slide_of (`{index}` `{total}`), previous_models,
next_models, model_categories, page_not_found, road_leads_nowhere,
content_unavailable, error, demo_footer_note, placeholder, placeholder_body,
configure_your (`{name}`), configurator, enquire, enquire_about (`{name}`),
contact, legal, coming_soon, enquiry, select_a_model, message_optional,
leave_empty, models_unavailable, sending, and the six validation messages.
A test asserts both locales define exactly the same key set and that every
`{placeholder}` in an English string appears in the Japanese one.

Templates receive `ctx.t(key, vars)` bound to the route's language, and
`ctx.lang`. `site/js/enquiry.js` receives `lang` from a `data-lang`
attribute on the form and uses `t` for its messages.

### Typography and formatting

- `site/styles.css`: when `html[lang="ja"]`, the body font stack becomes
  `"Hiragino Kaku Gothic ProN", "Hiragino Sans", "Yu Gothic", Meiryo,
  "Noto Sans JP", sans-serif` ahead of the existing stack; headings drop
  letter-spacing and uppercase transforms (Japanese has no case);
  `line-height` for body copy rises to 1.8; `word-break: normal` with
  `overflow-wrap: anywhere` so long katakana strings wrap.
- Story dates use `new Intl.DateTimeFormat(locale, { dateStyle: 'long' })`
  with the route's locale.
- The copyright line keeps the site name from Contentful (localized).

### Enquiry form

Copy comes from the localized `enquiryForm` entry; field labels and messages
come from the dictionary. `buildPayload` adds `locale: 'ja-JP' | 'en-US'`.
The Fusion blueprint and doc gain one line in the description
(`Locale: {{1.locale}}`) and the payload table; the scenario otherwise
stands.

## Verification

- Tests: router prefix handling and `routeFor`/`linkHref` prefixing; CDA
  `locale` query param and `setLocale`; dictionary key parity; content-model
  localized set; `buildEntryFields` with and without an overlay;
  `validateSeeds` untranslated and unknown-field problems; header switcher
  markup; a Japanese render fixture for the vehicle page proving localized
  strings and `lang` on the form; `Intl` date formatting.
- `scripts/verify-content.js` runs its route and link checks twice, once per
  locale (`locale=en-US`, `locale=ja-JP`), and reports both.
- Provisioning: `setup.js --dry-run` passes with full coverage;
  `--types-only` creates the locale and updates the fields; a full entry run
  writes the Japanese values; verify passes.
- Live: CDP screenshots of `#/ja/`, `#/ja/750s`, `#/ja/enquire/750s`, and
  `#/ja/retailers` on Pages, plus one check that the switcher round-trips.

## Translation process

One cheapest-tier agent per overlay file, each given: the glossary, the
English seed file(s) for its group, the overlay format, and the list of
localized fields per content type. It writes the overlay and runs
`node scripts/setup.js --dry-run` to confirm its group reaches full coverage
(other groups may still report untranslated until their agents finish, so
the agent reads only its own group's coverage line). One mid-tier agent then
reads a sample of forty strings across all overlays against the glossary and
returns corrections, which a cheapest-tier agent applies.

## Out of scope

Per-locale SEO metadata beyond the localized `seoMetadata` fields, hreflang,
locale-specific imagery or assets, translating Workfront or Fusion, a third
locale, right-to-left support, and machine-translation tooling in the repo.
