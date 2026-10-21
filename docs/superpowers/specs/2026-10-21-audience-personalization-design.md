# Audience personalization design

Date: 2026-10-21.

## Goal

Editors define audiences in Contentful and attach alternate content to them.
The front end works out which audiences a visitor belongs to from signals
collected in the browser and renders the matching variant. The first version
covers page sections on the home page and modular pages, plus the banner and
enquire call to action on vehicle pages.

The site stays a dependency-free static front end on GitHub Pages. No paid
Contentful add-on, no server, no account. Everything the site knows about a
visitor lives in that visitor's browser.

## Why this shape

The design splits the problem the way a production stack does. Contentful
decides what each audience sees. A provider decides which audiences a visitor
is in. The join between them is the audience key. The first provider evaluates
rules locally. A customer data platform (CDP) provider can replace or join it
later behind the same interface without changes to the content model, the
renderers, or the editor workflow.

Approaches considered and rejected:

- Audience fields on every section type. Editors would see every variant mixed
  into a page's section list, the default would be implicit, and single-link
  fields such as the vehicle banner cannot hold several entries.
- Entry tags. No schema change, but the rules would be hard-coded in the front
  end instead of authored by editors.

## Content model

Three new content types, provisioned by `npm run setup` with fixed IDs so the
script stays idempotent.

### `audience`

Display field: `name`.

| Field | Type | Notes |
| --- | --- | --- |
| `name` | Symbol | Required. |
| `key` | Symbol | Required, unique, lowercase slug (`^[a-z0-9]+(-[a-z0-9]+)*$`). The contract with any future CDP. |
| `description` | Text | For editors. |
| `source` | Symbol | `local` or `external`. Default `local`. External audiences carry no rules and come from a provider. |
| `interestCategories` | Links to `vehicleCategory` | Rule. |
| `interestVehicles` | Links to `vehicle` | Rule. |
| `visitorType` | Symbol | `any`, `first-time`, `returning`. Default `any`. Rule. |
| `minVisits` | Integer | Rule. |
| `campaigns` | Array of Symbol | Rule. Matched case-insensitively against the campaign parameter. |
| `regions` | Array of Symbol | Rule. Two-letter ISO 3166-1 country codes. |
| `matchMode` | Symbol | `all` or `any`. Default `all`. |

A rule field that is empty does not participate. `visitorType` set to `any`
counts as empty.

### `contentVariant`

Display field: `title`.

| Field | Type | Notes |
| --- | --- | --- |
| `title` | Symbol | Required. |
| `audience` | Link to `audience` | Required. |
| `content` | Link | Required. Any section type (`textBlock`, `imageBlock`, `bannerButton`, `cardGrid`, `vehicleGrid`, `storyGrid`, `ctaGroup`) or `link`. |

### `personalizedContent`

Display field: `title`.

| Field | Type | Notes |
| --- | --- | --- |
| `title` | Symbol | Required. |
| `default` | Link | Required. Same allowed types as `contentVariant.content`. |
| `variants` | Links to `contentVariant` | Ordered. The first match wins. |

### Changes to existing types

- `page.sections` and `story.sections` accept `personalizedContent`.
- `vehicle.msoBanner` accepts `bannerButton` or `personalizedContent`.
- New `vehicle.enquiryCta`, a link to `link` or `personalizedContent`. When
  set, it replaces the button built from `enquiryUrl`. `enquiryUrl` stays as
  the fallback so existing content keeps working.

Resolution never nests. A variant or default whose content is itself
`personalizedContent` renders nothing and logs a warning.

### Include depth

The wrapper adds two link levels (wrapper, variant, section). The home
page, modular pages, stories, and vehicles load with `include: 4`, which
leaves a card grid inside a personalized slot one level short. Those four
queries move to `include: 6`. The payload grows a little. No request is
added.

## Visitor profile and signals

`site/js/signals.js` owns everything the site knows about the visitor. It is
the only module that reads or writes storage, so a CDP swap replaces this
file.

### Profile

Stored in `localStorage` under one key, `mcl.profile`:

```js
{
  version: 1,
  visits: 3,
  firstSeen: '2026-10-21T10:00:00.000Z',
  lastSeen: '2026-10-21T10:05:00.000Z',
  viewed: { vehicles: ['750s', '750s-spider'], categories: { supercars: 2, gt: 1 } },
  campaign: 'trackday',
  region: 'GB',
  overrides: { audiences: null, region: null }
}
```

`visits` counts sessions. It is incremented once per `sessionStorage`
lifetime, using a marker key `mcl.session`. `viewed.vehicles` is most recent
first and capped at 20 entries. `viewed.categories` maps category slug to a
view count. `overrides` is written only by the demo panel.

### When the profile updates

- Boot: increment `visits` if this is a new session, set `firstSeen` on first
  run, set `lastSeen`, read the campaign parameter, derive the region if it is
  unset.
- After every successful route render: a vehicle page records the vehicle slug
  and its category slug; a category page records the category slug. Other
  routes record nothing. The current page therefore does not see its own view.
- Enquiry form submissions are not recorded. They carry personal data.

### Campaign

Read from `utm_campaign`, falling back to `audience`. The real URL query
string is checked first, then a query string after the hash route, so both
`?utm_campaign=trackday#/750s` and `#/750s?audience=trackday` work. The value
is stored lowercase. The URL is not rewritten.

### Region

The demo override first, then the region subtag of `navigator.language`, for
example `GB` from `en-GB`. A language tag without a region leaves the region
null. No geolocation API and no IP lookup.

### Exports

```js
load()                 // profile, from storage or the in-memory fallback
recordBoot(location, navigator)
recordView({ vehicleSlug, categorySlug })
setOverrides({ audiences, region })
setEnabled(boolean)    // consent hook; default true; false stops writes
reset()
```

### Failure behaviour

Every storage read and write is wrapped in `try`/`catch`. If storage is
unavailable, blocked, or throws, the module keeps an in-memory profile for the
page lifetime and the site behaves as a first-time visitor. A stored profile
with a different `version` or that fails to parse is discarded and started
fresh.

## Audience resolution

### Loading audiences

Audiences are fetched once per boot alongside site settings and categories,
through the cached Delivery API client, with the query
`content_type: audience`, `include: 1`, `limit: 100`. If the request fails,
every slot renders its default and one warning is logged.

### Provider boundary

`site/js/audience.js`:

```js
createLocalProvider(audiences)   // → { resolve(profile) → Set<key> }
createResolver({ providers })    // → { audiencesFor(profile) → Set<key> }
```

The resolver asks every provider, unions the results, then applies
`profile.overrides.audiences`. An override replaces the computed set rather
than adding to it, so an editor can isolate one variant.

The local provider evaluates the rule fields against the profile:

| Rule | Matches when |
| --- | --- |
| `interestCategories` | Any listed category slug has a view count above zero. |
| `interestVehicles` | Any listed vehicle slug appears in `viewed.vehicles`. |
| `visitorType` | `first-time`: `visits <= 1`. `returning`: `visits >= 2`. |
| `minVisits` | `visits >= minVisits`. |
| `campaigns` | The stored campaign equals a listed value, case-insensitive. |
| `regions` | The region equals a listed code, case-insensitive. |

Empty rules are skipped. `matchMode` `all` needs every populated rule to pass,
`any` needs one. An audience with no populated rules never matches locally, so
an external audience cannot fire by accident. Unknown `visitorType` or
`matchMode` values are treated as the defaults.

A CDP provider implements the same `resolve` and is added to `providers` in
`app.js`. Nothing else changes.

### Picking a variant

`site/js/render/personalized.js`:

```js
pick(entry, audienceKeys) // → { content, variant | null }
```

Walks `variants` in editor order and returns the first whose audience key is
in the set, else `default`. Variants with an unresolved audience or content
link, and content that is itself `personalizedContent`, are skipped with a
warning.

`pick` returns the chosen entry. The caller renders it with the existing
renderer and then adds `data-personalized="<wrapper sys.id>"` and
`data-variant="<audience key>"` (or `data-variant="default"`) to the first
opening tag of the returned markup. Empty markup stays empty. Tests and the
demo panel read these attributes.

### Integration

- `renderSections` resolves a `personalizedContent` section through `pick`
  and dispatches the result to the existing renderer map.
- The vehicle renderer resolves `msoBanner` and `enquiryCta` the same way.
  A resolved `link` for `enquiryCta` renders in the enquire button's place
  with the same button classes, using the link's label and `linkHref`.
- The audience set is computed once per route render from the profile at that
  moment and passed in the render context as `ctx.audiences`. Variants do not
  change while the visitor stays on a page.

### Performance

No request is added after boot. Variant selection is part of the markup build,
so the response cache stays shared across audiences and the in-place variant
switch keeps working.

## Demo panel

`site/js/panel.js` renders a collapsible panel fixed to the bottom-right
corner. It is hidden by default. It opens when the URL has `?demo=1` or when
`Shift+D` is pressed three times within two seconds. Its open state is kept in
`sessionStorage` so it survives route changes.

Read-only section: visits, viewed categories and vehicles, campaign, region,
and the matched audiences with their source.

Controls:

- Force audiences: one checkbox per audience. Ticking any sets
  `overrides.audiences` to the ticked set.
- Region override: a text field for a two-letter code.
- Clear overrides.
- Reset profile: calls `reset()`.

Every control re-renders the current route in place through the same path as
the variant switcher. While the panel is open, each personalized slot gets a
thin outline and a label showing the wrapper title and the variant that fired.
With the panel closed, nothing is shown.

The panel ships in the production build. It exposes nothing a visitor cannot
read from their own `localStorage`. Its styles live in a `.demo-panel` block
in `site/styles.css`.

## Editor workflow

1. Create an `audience` with a key and rules, or `source: external` for a
   CDP-fed one.
2. Create the alternate content as a normal section entry.
3. Create a `contentVariant` pairing the audience with that entry.
4. Create a `personalizedContent` with the original section as `default` and
   the variant in `variants`. Put it in the page's `sections` list where the
   original was, or in the vehicle's `msoBanner` or `enquiryCta` field.

## Seed content

New seed group `audiences` in `src/seed/audiences.js`:

| Key | Rule |
| --- | --- |
| `supercar-fans` | `interestCategories`: Supercars. |
| `returning` | `visitorType`: returning. |
| `trackday` | `campaigns`: `trackday`. |
| `uk` | `regions`: `GB`. |
| `vip` | `source: external`, no rules. |

Home page: the existing banner wrapped in `personalizedContent` with a variant
for `supercar-fans` and one for `trackday`. 750S vehicle page: the MSO banner
wrapped with a `returning` variant, and an `enquiryCta` whose default is the
existing enquire link and whose `uk` variant points at the retailers page.

## Error handling

| Condition | Behaviour |
| --- | --- |
| Audience fetch fails | Defaults everywhere, one warning, panel shows "audiences unavailable". |
| Storage throws or is blocked | In-memory profile for the page lifetime. No error shown. |
| Profile has an older `version` or malformed JSON | Discarded, started fresh. |
| Variant with an unresolved audience or content link | Skipped with a warning. |
| Nested `personalizedContent` | Skipped with a warning. |
| Audience no variant references | Harmless. |
| Unknown `visitorType` or `matchMode` | Treated as `any` and `all`. |

## Testing

All in the `node --test` suite with fixtures. No browser needed for the unit
tests.

- `test/signals.test.js`: profile creation, visit counting across a fake
  `sessionStorage`, view recording and the 20-entry cap, campaign parsing
  from both query positions, region from a fake `navigator.language`,
  disabled mode, reset, recovery from a broken store.
- `test/audience.test.js`: every rule alone, `all` versus `any`, empty rules
  never match, external audiences never match locally, union across
  providers, override replaces the computed set.
- `test/render.test.js`: `pick` ordering and skipping, the two data
  attributes, vehicle banner and CTA resolution, `enquiryUrl` fallback.
- `test/content-model.test.js` and `test/provision.test.js`: the three new
  types validate, seed links resolve, the four queries use `include: 6`.
- `test/panel.test.js`: panel markup from a profile and audience list, and
  that controls call the right functions.
- One Playwright check added to the measurement script and run by hand: load
  with `?utm_campaign=trackday`, confirm the trackday banner fires, open the
  panel, force `returning`, confirm the vehicle banner swaps without a reload.

## Out of scope

- A real CDP provider, consent banner, cross-device identity.
- Personalizing the home hero, header, footer, or retailer search.
- Server or edge rendering.
- Analytics on which variants were seen.

## Files

New: `site/js/signals.js`, `site/js/audience.js`, `site/js/panel.js`,
`site/js/render/personalized.js`, `src/seed/audiences.js`, the tests above.

Changed: `src/content-model.js`, `src/seed/{pages,vehicles,sections,links,index}.js`,
`site/js/cda.js` (a `getAudiences` query), `site/js/router.js` (include
depth), `site/app.js` (boot loads audiences, signals, panel, `ctx.audiences`),
`site/js/render/{sections,vehicle}.js`, `site/styles.css`, `site/index.html`
(module preloads), `README.md`.
