# contentful-demo

A demo site for Strada Nova, a fictional supercar maker, built on Contentful.
The Node.js scripts
provision a content model and seed content into the space
[za8ljzyomqr0](https://app.contentful.com/spaces/za8ljzyomqr0/home). A
dependency-free static front end reads the published content through the
Delivery API and is hosted on GitHub Pages at
<https://judgedicewt.github.io/contentful-demo/>.

The content model and page inventory mirror the information architecture of
[mclaren.com/cars/gl_en](https://www.mclaren.com/cars/gl_en), with the brand
replaced by Strada Nova. The design
document in `docs/plans/2026-10-20-mclaren-schema-design.md` maps each
McLaren page component to a content type and lists every seeded page. The
delivery plan is in `docs/plans/2026-10-20-mclaren-schema.md`.

## Prerequisites

- Node.js 22 or later.
- A Contentful Management API token and a Delivery API token for the space.

## Configuration

The scripts read these environment variables. Values already present in the
process environment take precedence over `.env`.

| Name | Purpose |
| --- | --- |
| `CONTENTFUL_SPACE_ID` | Space to operate on. Defaults to `za8ljzyomqr0` in `.env`. |
| `CONTENTFUL_ENVIRONMENT` | Environment within the space. Defaults to `master` in `.env`. |
| `CONTENTFUL_MANAGEMENT_TOKEN` | Used by `setup` and `teardown:blog` to write content. |
| `CONTENTFUL_DELIVERY_TOKEN` | Used by `check`, `fetch`, `verify`, and the front end to read published content. |
| `CONTENTFUL_PREVIEW_TOKEN` | Optional. Reserved for reading draft content. |

To change the non-secret defaults, edit `.env`. Don't put tokens in `.env`.
`.env` is listed in `.gitignore`, and `.env.example` documents the expected
shape.

## Scripts

```sh
npm install
npm run check          # Verifies env vars and that both APIs accept the tokens.
npm run setup          # Creates or updates the content model, assets, and entries.
npm run verify         # Compares the published space against the seed data.
npm run fetch          # Lists the published vehicles through the Delivery API.
npm run placeholders   # Regenerates the SVG placeholder images.
npm run photos -- --input=<dir>   # Converts downloaded renders in <dir> to WebP under assets/photos/.
npm run teardown:blog  # Removes the original blogPost and author demo content.
npm run dev            # Generates site/config.js and serves the front end on :4173.
npm test               # Runs the unit tests.
```

`setup` accepts a few flags:

```sh
node scripts/setup.js --dry-run              # Validate seeds and print the plan without writing.
node scripts/setup.js --types-only           # Create or update content types only.
node scripts/setup.js --only=vehicles,pages  # Provision selected seed groups.
```

`setup` is idempotent. Content types, assets, and entries use fixed IDs, so
running it again updates and republishes them instead of creating duplicates.
It validates every seed against the content model before it writes anything,
publishes entries in two passes so circular links resolve, and retries on
rate limits.

To add the personalization types to a space that already has content, run
`npm run setup -- --dry-run` to check the model and seeds, then run
`npm run setup` to create them. Until setup has created the `audience` type,
the browser console shows one 400 response for the audience query and a
warning that the content type does not exist. The site treats the missing
type as empty and renders the default content.

## Content model

`src/content-model.js` defines 26 content types in dependency order. Each
description names the McLaren component it stands in for.

| Group | Content types |
| --- | --- |
| Site | `siteSettings`, `seoMetadata`, `link`, `linkGroup`, `bannerButton`, `enquiryForm` |
| Vehicles | `vehicle`, `vehicleCategory`, `specification`, `featureHighlight`, `mediaSlide`, `lineageEntry`, `faqItem` |
| Sections | `textBlock`, `imageBlock`, `card`, `cardGrid`, `ctaGroup`, `vehicleGrid`, `storyGrid` |
| Pages | `page`, `story`, `retailer` |
| Personalization | `audience`, `contentVariant`, `personalizedContent` |

A `vehicle` carries its hero, strapline, specifications, highlights, carousel
slides, lineage, FAQs, and SEO metadata, and links to a `vehicleCategory`. A
`page` is a slug plus an ordered list of sections drawn from the section
types, which is how home, legacy, ownership, experiences, and Su Misura pages
are composed. Field validations restrict link targets, enforce unique slugs, and
constrain enumerated values such as body style and status. `vehicle.enquiryCta`
replaces the enquire button built from `enquiryUrl`, which stays as the
fallback.

## Seed content

`src/seed/` holds the seed data as plain objects grouped by type. `setup`
creates:

- 11 vehicles across 4 categories (Supercars, Grand Tourers, Hypercars, and
  Motorsport): Artura, Artura Spider, 750S, 750S Spider,
  GTS, and W1 as current models; Artura GT4 as a race car; and
  720S, 765LT, P1, and F1 as legacy models.
- 8 composed pages: home, legacy, legacy/2010s, legacy/1990s, ownership,
  ownership/roadside-assistance, experiences, and su-misura.
- 4 stories, 6 retailers, and one `siteSettings` singleton that drives the
  header navigation and footer.
- 5 audiences, 9 content variants, and 4 personalized content slots: the home
  page hero, the home page banner, the 750S Su Misura banner, and the 750S
  enquiry CTA. The audiences are `supercar-fans`, `returning`, `trackday`, `uk`, and `vip`. The `vip` audience
  is external and has no rules, so a customer data platform (CDP) supplies it.
- 86 SVG placeholder images under `assets/placeholders/`, generated by
  `npm run placeholders` from `src/placeholders/manifest.js`. Photos replace
  them when present.

## Locales

The space has two locales: `en-US` is the default, and `ja-JP` (Japanese) falls
back to `en-US` when a value is missing. `setup` creates the `ja-JP` locale if
it doesn't exist.

The Japanese text lives in overlay files at `src/seed/ja-JP/<group>.js`, with
one file per seed group. Each overlay is keyed by entry ID, then by field ID,
and `src/seed/ja-JP/GLOSSARY.md` beside them holds the translation glossary and
describes the overlay format. The English seed files stay unchanged.

Every localized text field needs a `ja-JP` value. `scripts/setup.js` fails
validation when one is missing, and `node scripts/setup.js --dry-run` prints a
`ja-JP coverage` line for each group so you can see the gap before you write
anything.

On the site, routes under the `#/ja/` prefix show the Japanese content, for
example `#/ja/750s`. Routes without the prefix show English. The language
switcher in the header moves you between the two versions of the current page.

`npm run verify` checks each locale in turn. The `ja-JP` pass runs the same
route, link, and slug checks with `locale=ja-JP`, and also confirms that the
category intros, story standfirsts, enquiry form intro, and newsletter text
contain Japanese script. If the space doesn't have the `ja-JP` locale yet, the
Delivery API rejects the request, and `verify` reports that as a problem and
exits with a non-zero code.

## Imagery

`src/photos/manifest.js` defines the 30 studio photos the site uses: 11
vehicle heroes at 16:9, 11 vehicle cards at 4:3, and 8 page and story heroes.
`src/photos/slots.js` maps all 86 asset IDs onto these shots, so several slots
can share one photo.

Generating the photos is a manual step. Run it from a Claude session through
the Figma connector. Each image spends Figma AI credits, so generate only the
shots you need. The generated frames live in a Figma file named
"McLaren demo imagery".

List the prompts for shots that still lack a photo:

```sh
node scripts/generate-photos.js --prompts
```

Save each downloaded render as `<shot-id>.png` in a folder, then convert the
folder:

```sh
npm run photos -- --input=<dir>
# or directly:
node scripts/generate-photos.js --input=<dir>
```

To redo a shot that already has a photo, add `--force=<id>`, for example
`--force=shot-750s-hero`. A space works in place of `=` for both `--input` and
`--force`. A forced shot with no matching render keeps its current photo, and an
id that is not in the manifest prints a warning.

The converter never upscales. It applies EXIF orientation, then crops each render to the shot's aspect ratio
and writes WebP at quality 82. If the result is larger than 600 KB, it writes
the file again at quality 75.

A slot without a photo keeps its SVG placeholder, so the site always renders.
After you add or replace photos, run `node scripts/setup.js --only=assets`.
It re-uploads only the slots whose file changed.

## Brand

Strada Nova is a fictional brand. Its bespoke division is Su Misura, at
`#/su-misura`. The logo is two smooth curves, a road sweeping away, with a
subtle papaya gradient. It's drawn as an SVG stand-in until a final version
replaces it. To generate that version, use the prompt and replacement steps
in [`docs/brand/figma-logo-prompt.md`](docs/brand/figma-logo-prompt.md).

`site/js/brand.js` renders the mark inline, and the header, footer, home hero,
loading state, and 404 page use it. `site/favicon.svg` is a heavier version
for small sizes, and `site/brand/strada-nova-mark.svg` is the file that the
first loading screen and the "Continue your journey" watermark use. Every
eyebrow label starts with a short line in the brand gradient.

Entry IDs, asset IDs, and field IDs keep their original names, such as
`page-mso` and `msoBanner`, so `setup` updates the existing entries in place.

## Front end

`site/` is a static ES-module app with no build step. It uses hash routing so
GitHub Pages needs no rewrites. Routes mirror McLaren's paths:

| Route | View |
| --- | --- |
| `#/` | Home page |
| `#/<vehicle-slug>` | Vehicle page, for example `#/750s` |
| `#/current-models/<category-slug>` | Category listing |
| `#/post/<story-slug>` | Story |
| `#/retailers` | Retailer finder |
| `#/<page-slug>` or `#/<parent>/<child>` | Composed page, for example `#/legacy/2010s` |

`site/js/cda.js` wraps the Delivery API and resolves links. `site/js/router.js`
matches routes and loads data. `site/js/render/` holds one renderer per view
and one per section type. `site/js/dom.js` provides a tagged template that
escapes interpolated values.

The client caches every Delivery API response for the life of the page, and
a vehicle page prefetches the other variants in its family at idle. Switching
between variants then updates the page in place: no loading state, the
scroll position is kept, and browsers that support view transitions
crossfade the hero. Module preload hints in `site/index.html` let the browser
fetch all ES modules in parallel; `test/preload.test.js` fails if a module
is added without one.

The page reads its settings from `site/config.js`, which is generated and not
committed. Run `npm run dev` to generate it from your environment and serve
the site locally.

The delivery token ends up in the page source. That's expected for Contentful
delivery tokens, which can only read published content, but don't use a
management or preview token here.

## Personalization

Editors define audiences in Contentful and attach alternate content to them.
The site works out which audiences a visitor belongs to from signals collected
in the browser, then renders the matching variant. Editors can personalize
the home page hero, sections on pages and stories, the vehicle Su Misura
banner, and the vehicle enquire call to action. The
[audience personalization design](docs/superpowers/specs/2026-10-21-audience-personalization-design.md)
records the reasoning behind the feature.

### Editor workflow

1. Create an `audience` with a `key` and its rules. For an audience that a
   CDP feeds, set `source` to `external` instead.
2. Create the alternate content as a section entry of any section type, or as a
   `link`.
3. Create a `contentVariant` that pairs the audience with that entry.
4. Create a `personalizedContent` entry with the original section as `default`
   and the variants in `variants`. Place it in the page's `sections` list where
   the original was, in the home page's `heroBanner` field, or in the vehicle's
   `msoBanner` or `enquiryCta` field. The variants of a `heroBanner` or an
   `msoBanner` must be `bannerButton` entries, and the variants of an
   `enquiryCta` must be `link` entries.

The home page hero comes from `heroBanner` when that field is set. The chosen
banner fills the full-height hero with its image, eyebrow, heading, body, and
call to action. Without `heroBanner`, the hero shows the page's hero image and
the site name. The seeded `pc-home-hero` slot has a variant for every audience,
so each audience changes the first screen of the site.

Nesting is not supported. A variant or default that is itself a
`personalizedContent` entry is not rendered, and the console logs a warning.

### What the browser stores

The site keeps a visitor profile in `localStorage`, under the `mcl.profile` key.
It also writes an `mcl.session` marker to `sessionStorage`, so that each browser
session counts as one visit. Nothing is sent to a server. The profile holds
these signals:

- Visits, which counts browser sessions.
- Viewed vehicles and categories. The vehicles are most recent first, up to 20,
  and each category has a view count.
- Campaign, from the `utm_campaign` parameter, or from `audience` when that is
  absent. The value is stored in lowercase. The site checks the real query
  string and the query string after the hash route, so
  `?utm_campaign=trackday#/750s` and `#/750s?audience=trackday` both work.
- Region, from the region part of the browser language, for example `GB` from
  `en-GB`. The site uses no geolocation and no IP lookup.

A vehicle page records its vehicle and category, and a category page records
its category. Other pages record nothing. Enquiry form submissions are never
recorded, because they carry personal data. If storage is blocked or throws,
the profile stays in memory until the page reloads.

### How a variant is chosen

Each audience has rules that the site compares with the profile. An empty rule
does not count. With `matchMode` set to `all`, the default, every populated rule
must match. Set it to `any` to require one match.

| Rule | Matches when |
| --- | --- |
| `interestCategories` | The visitor has viewed a listed category. |
| `interestVehicles` | The visitor has viewed a listed vehicle. |
| `visitorType` | `first-time` matches one visit or fewer. `returning` matches two or more. `any` is also accepted, and it adds no rule. |
| `minVisits` | The visit count is at least this value. |
| `campaigns` | The campaign matches a listed value, ignoring case. |
| `regions` | The region matches a listed two-letter code, ignoring case. |

An audience with no populated rules never matches locally. For a personalized
slot, the site walks the variants in the order the editor listed them and
renders the first variant whose audience matches. If none matches, it renders
the `default`.

The wrapper adds two link levels, the wrapper and the variant, on top of the
deepest existing chain. The home page, modular page, story, and vehicle queries
therefore load with `include: 6`, set by `CONTENT_INCLUDE` in
`site/js/router.js`. With a lower depth, a card grid inside a personalized slot
does not resolve. The sibling prefetch uses the same value, because the client
caches responses by full URL.

### Add a CDP

A CDP provider can replace the local rules or join
them. Implement `resolve(profile)`, which returns the audience keys the visitor
belongs to as a `Set` or an array. Then add the provider to the `providers`
array passed to `createResolver` in `site/app.js`. No other code changes.

To honor a visitor's consent, use the consent hook. Call `setEnabled(false)`,
exported from `site/js/signals.js`, to stop profile writes. Reads keep working,
and `reset()` still clears the profile. The flag lives in memory only, so a
consent manager calls `setEnabled` on every boot, from the consent it has
stored, before `site/app.js` runs its boot code. Boot records the visit at once.
When consent is withdrawn, call `setEnabled(false)` and then `reset()`. A
consent manager can run before `boot()` only if it is an ES module that imports
`./js/signals.js`, is loaded before `app.js` (as a module script placed earlier
in `index.html`, or as a module that `app.js` imports), and reads the stored
consent synchronously. An asynchronous consent platform cannot stop the
boot-time write, so it should call `reset()` once consent is denied.

### Demo panel

The demo panel shows what the site knows about the visitor, and it can force
the result so that you can show each variant without changing browsers. Open
it with `?demo=1` in the URL, for example `http://localhost:4173/?demo=1#/750s`,
or press Shift+D three times within two seconds. To close it, press Shift+D
three times again, or select Close. The panel stays open as the visitor moves
through the site in the same browser session.

The panel shows the visit count, campaign, region, viewed categories and
vehicles, and the matched audiences with their source. Its controls are:

- Force audiences. Tick one or more audiences to replace the matched audiences
  with the ticked set.
- Region override. Enter a two-letter country code.
- Clear overrides. Remove the forced audiences and the region override.
- Reset profile. Clear the stored profile and the session marker, so the next
  page load counts as a new visit.

Each control re-renders the current page in place, with no reload and no scroll
change. While the panel is open, each personalized slot has a dashed outline and
a label that shows the wrapper title and the variant that fired, or `default`.
The panel ships in the production build. It shows the visitor's own profile,
plus the published audience names and keys, and nothing private.

## Enquiry form

`#/enquire` and `#/enquire/<model-slug>` show an enquiry form whose copy and
webhook URL come from the `enquiryForm` entry in Contentful. Each submission
goes to an Adobe Workfront Fusion webhook that creates a request in a Workfront
queue. To import the Fusion scenario, see [`docs/fusion-setup.md`](docs/fusion-setup.md).

## Hosting on GitHub Pages

`.github/workflows/pages.yml` builds `site/config.js` and deploys `site/` on
every push to `main`. One-time setup in the GitHub repository:

1. In **Settings > Pages**, set **Source** to **GitHub Actions**.
2. In **Settings > Secrets and variables > Actions**, add:
   - Variable `CONTENTFUL_SPACE_ID` = `za8ljzyomqr0`
   - Variable `CONTENTFUL_ENVIRONMENT` = `master`
   - Secret `CONTENTFUL_DELIVERY_TOKEN` = your delivery token
3. Push to `main` or run the workflow manually from the **Actions** tab.

The site is then served at `https://<owner>.github.io/<repo>/`.

## Running behind an HTTPS proxy

`contentful-management` bundles its own axios, which at 1.15.x doesn't tunnel
HTTPS through a proxy correctly and fails with `405 Method Not Allowed`.
`src/clients.js` works around this by passing the installed top-level axios
HTTP adapter to the management client. Keep `axios` at 1.16.1 or later.

## Tests

`npm test` runs the `node --test` suites in `test/`. They cover the
content model, seed validation and the provisioning request layer, placeholder
generation, the Delivery API client and link resolver, rich text rendering,
routing, the view renderers, visitor signals, audience resolution, and the demo
panel. The tests use fixtures and make no network calls.
