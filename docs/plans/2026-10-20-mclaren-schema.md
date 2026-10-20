# McLaren-style content schema: implementation plan

Design: `2026-10-20-mclaren-schema-design.md`. Read it first; this plan
references its content model and page inventory without repeating them.

Each task is sized for one subagent. Tasks list the files they own, the
steps, and how to verify. Tasks in the same phase run in parallel and must
not edit each other's files. Only the orchestrator runs `npm run setup`
against the Contentful space; task agents write code and seed files and
verify with unit tests, dry runs, or read-only Delivery API calls.

Repository: `/home/user/contentful-demo`. Node 22, ES modules, no
framework. Existing conventions: `src/config.js` loads env,
`src/clients.js` builds API clients (the management client must keep its
axios adapter workaround), scripts live in `scripts/`, the site in `site/`.

## Phase A: foundations (parallel)

### A1. Content model and provisioning engine

Owns: `src/content-model.js`, `scripts/setup.js`, `scripts/teardown-blog.js`,
`src/provision/*.js`, `package.json` scripts `setup`, `teardown:blog`.

1. Rewrite `src/content-model.js` to export `CONTENT_TYPES` for every type
   in the design, with field validations (`in`, `unique`, `linkContentType`,
   `linkMimetypeGroup: ['image']` for image assets, `size` limits) and a
   `description` carrying the McLaren component code. Keep the array in
   dependency order so types referenced by link validations exist first.
   Contentful lets validations reference types created later in the same
   run only if they exist when the referencing type is published, so
   provision in two passes: create/update all types unpublished, then
   publish all.
2. Create `src/provision/entries.js` exporting
   `provisionEntries(environment, seedGroups, { only })` where a seed group is
   `{ name, assets: [], entries: [] }`. Entry seeds are
   `{ id, contentType, fields, links: { fieldId: 'entryId' | ['id', ...] }, assets: { fieldId: 'assetId' | [...] } }`.
   Plain `fields` values are localised to `en-US` automatically; rich text
   values are passed through when they already have `nodeType: 'document'`.
   Process assets first (create or update, `processForAllLocales`, wait
   until processed, publish), then entries in the order given. Create with
   fixed IDs, update when present, publish after each write. Serialise
   requests and retry on HTTP 429 using the `X-Contentful-RateLimit-Reset`
   header, max 5 attempts.
3. Create `src/provision/assets.js` with the asset upload helper used
   above. An asset seed is
   `{ id, title, description, file: 'assets/placeholders/<name>.svg', contentType: 'image/svg+xml' }`.
   Upload via `environment.createUpload({ file: stream })` then
   `createAssetWithId` using `uploadFrom`.
4. Rewrite `scripts/setup.js` to: load `src/seed/index.js` (which exports
   `SEED_GROUPS`; create a stub exporting `[]` if Phase B hasn't landed yet),
   provision content types, then call `provisionEntries`. Support
   `--only=<group>` and `--types-only`. Print one line per created, updated,
   or unchanged item.
5. Create `scripts/teardown-blog.js`: unpublish and delete all entries of
   `blogPost` and `author`, then unpublish and delete those content types.
   Idempotent when they are already gone. Add `teardown:blog` to
   `package.json`.
6. Add a dry-run flag `--dry-run` to `setup.js` that validates seeds
   against the content model (unknown fields, missing required fields,
   links to unknown IDs within the same run) without calling the API, and
   exits non-zero on problems. This is what task agents use to verify.

Verify: `node scripts/setup.js --dry-run --types-only` passes;
`node --test test/provision.test.js` passes (write tests for localisation,
link mapping, and dry-run validation). Do not run `npm run setup` without
`--dry-run`.

### A2. Placeholder image generator

Owns: `scripts/generate-placeholders.js`, `src/placeholders/*.js`,
`assets/placeholders/` (generated, committed), `package.json` script
`placeholders`, `src/seed/assets.js`.

1. Write a generator that, from a manifest in `src/placeholders/manifest.js`,
   writes one SVG per asset. Manifest entries:
   `{ id, label, kind: 'hero' | 'card' | 'portrait' | 'detail', palette }`.
   Sizes: hero 1920x1080, card 1200x900, portrait 900x1200, detail 1600x1000.
2. Draw a generic mid-engined coupe or spider silhouette (two body
   variants, choose by a `silhouette` key) from simple paths, on a themed
   background (carbon, midnight, mist, white, papaya), with subtle
   diagonal texture, the label text bottom-left in uppercase, and a small
   "PLACEHOLDER" tag top-right. Keep each SVG under 20 KB. No external
   fonts or images.
3. Manifest covers every asset the seed data needs; name IDs
   `img-<slug>-<purpose>`. Minimum set:
   - per current vehicle (artura, artura-spider, 750s, 750s-spider, gts, w1,
     artura-gt4): `hero`, `card`, `overview-1`, `overview-2`, `exterior`,
     `interior`, `mso`
   - per legacy vehicle (720s, 765lt, p1, f1): `hero`, `card`
   - lineage portraits: `lineage-765lt`, `lineage-720s`, `lineage-f1`,
     `lineage-p1`
   - categories: `cat-supercars`, `cat-grand-tourer`, `cat-ultimate`,
     `cat-motorsport` (hero)
   - pages: `home-hero`, `legacy-hero`, `legacy-2010s-hero`,
     `legacy-1990s-hero`, `ownership-hero`, `experiences-hero`, `mso-hero`,
     `mso-banner`, `mcl-6gt-banner`, `experience-winter-ball`,
     `experience-arctic`, `experience-track-day`
   - stories: `story-750s-facts-hero`, `story-artura-spider-hero`,
     `story-w1-hero`, `story-mso-hero`, and one `story-*-inline` each
   - `og-default` (card)
4. Export `ASSET_SEEDS` from `src/seed/assets.js`, generated from the
   manifest, in the asset seed shape from A1 step 3.

Verify: `npm run placeholders` writes the files; every file parses as XML
(`xmllint --noout` if available, else a Node XML sanity check);
`node --test test/placeholders.test.js` checks counts and sizes; open two
SVGs in headless Chromium and screenshot them to confirm they render.

### A3. Front-end core

Owns: `site/js/cda.js`, `site/js/router.js`, `site/js/richtext.js`,
`site/js/shell.js`, `site/js/dom.js`, `site/index.html`, `site/styles.css`,
`site/app.js` (becomes a thin bootstrap), `test/fixtures/*.json`,
`test/cda.test.js`, `test/richtext.test.js`, `test/router.test.js`.
Do not create `site/js/render/*` (B3 owns those); export the registry hook
they plug into.

1. `cda.js`: `createClient(config)` returning `{ getEntries(query), getEntry(id, query) }`
   that fetch from `cdn.contentful.com`, then `resolve(payload)` that replaces
   every `{ sys: { type: 'Link' } }` in `items` with the matching entry or
   asset from `includes`, recursively, tolerating cycles and unresolvable
   links (leave as `null`). Asset URLs get `https:` prepended.
2. `router.js`: `matchRoute(hash)` returning
   `{ name, params }` for: `/` and `/home` → home; `/current-models` →
   redirect supercars; `/current-models/:category` → category;
   `/post/:slug` → story; `/retailers` → retailers; `/legacy`,
   `/legacy/:decade`, `/ownership`, `/ownership/:slug`, `/experiences`,
   `/mso`, and any other single or double segment → page (slug is the full
   path); a reserved list of vehicle slugs is not needed: the loader first
   tries `vehicle` by slug, then `page`. Export `navigate(hash)` and
   `onRouteChange(fn)`.
3. `richtext.js`: `renderRichText(document, { assetUrl })` producing HTML
   for paragraphs, headings 2 to 4, bold, italic, underline, code,
   hyperlinks, ordered and unordered lists, blockquote, hr, and
   `embedded-asset-block` (figure with img). Escape all text.
4. `dom.js`: `html` tagged template with auto-escaping and a `raw()` escape
   hatch; `escapeHtml`.
5. `shell.js`: `renderHeader(siteSettings, categories)`,
   `renderFooter(siteSettings)`, `renderBreadcrumbs(trail)`. Header has the
   site name as a wordmark, main navigation with a Models dropdown built
   from categories, and the retailer link. Mobile: hamburger toggling a
   full-screen menu. Footer renders link groups, social links, newsletter
   text, legal links.
6. `styles.css`: design tokens (colours for carbon, midnight, mist, white,
   papaya accent; type scale; spacing), theme classes `.theme-carbon`,
   `.theme-mist`, `.theme-white`, utilities for eyebrow labels, buttons
   (primary, secondary, text), container widths, and the header/footer.
   Leave section-specific styles to B3 but define the shared class names
   they should use: `.section`, `.eyebrow`, `.btn`, `.btn-primary`,
   `.btn-secondary`, `.grid-cards`, `.card`.
7. `app.js`: boot sequence: load config, fetch `siteSettings` (include=2)
   and all `vehicleCategory` entries, render shell, register renderers
   from `site/js/render/index.js` via a `registry` object
   (`registry.vehicle(entry, ctx)`, etc.), and dispatch routes. Show a
   loading state and a 404 view. Until B3 lands, import a stub
   `site/js/render/index.js` that renders `<pre>` of the entry; B3 replaces
   it.
8. `index.html`: update structure for header, main, footer mount points.

Verify: `node --test` passes for the three test files with fixtures that
include nested links, a cycle, and an unresolvable link; `npm run dev` then
headless Chromium screenshot shows the header and footer rendered from the
live `siteSettings` once Phase B seeds exist (before that, it shows the
shell with an empty navigation and no console errors).

## Phase B: content and templates (parallel, after A)

### B1. Vehicle seed data

Owns: `src/seed/vehicles.js`, `src/seed/specifications.js`,
`src/seed/highlights.js`, `src/seed/slides.js`, `src/seed/lineage.js`,
`src/seed/categories.js`, `src/seed/faqs.js`.

1. Write seeds for the four categories and all eleven vehicles in the
   design's inventory, with every field populated for current vehicles
   (statement, 2 overview slides, 4 highlights split exterior/interior,
   8 to 10 specifications with exactly 3 featured, performance blurb,
   lineage with 2 to 3 entries, MSO banner link to `banner-mso-generic`
   from B2, related stories by ID from B2, 2 FAQs). Legacy vehicles:
   statement, 3 specifications all featured, short description,
   `yearIntroduced`. Motorsport vehicle: statement, 3 specs, 2 highlights.
2. Spiders set `parentModel` to their coupé. Specifications are shared
   where identical by ID convention `spec-<slug>-<label-slug>`.
3. Export each file's array and a combined `VEHICLE_SEED_GROUPS` from
   `src/seed/vehicles.js` in dependency order: specifications, highlights,
   slides, lineage, faqs, categories, vehicles.
4. Original copy in McLaren's register. Headline figures may use publicly
   known numbers; mark nothing as official.

Verify: `node scripts/setup.js --dry-run --only=vehicles` passes with no
unknown fields or dangling links (B2 IDs it depends on are listed in this
plan: `banner-mso-generic`, story IDs `story-750s-five-key-facts`,
`story-artura-spider-performance`, `story-w1-designed-by-air`,
`story-mso-project-placeholder`; the dry run treats IDs declared in any seed
group as known).

### B2. Pages, stories, navigation, retailers seed data

Owns: `src/seed/site.js`, `src/seed/links.js`, `src/seed/pages.js`,
`src/seed/stories.js`, `src/seed/sections.js`, `src/seed/retailers.js`,
`src/seed/index.js`.

1. `links.js`: main navigation (Models with children per category, MSO,
   Ownership, Experiences, Legacy), footer groups (More links, Useful links,
   Contact us, Follow us), legal links, retailer link, and the CTA links
   pages and banners need (`link-configure-<slug>` style IDs are not
   needed; vehicles use URL fields).
2. `sections.js`: textBlocks (rich text documents built with a small helper
   `doc(paragraphs...)` exported from `src/seed/richtext-helpers.js`),
   imageBlocks, bannerButtons (`banner-mso-generic`, `banner-mcl-6gt`),
   cards, cardGrids, vehicleGrids (legacy hub, 2010s, 1990s), storyGrids,
   ctaGroups ("Continue your journey" variants).
3. `pages.js`: the eight pages in the inventory with `parent` set for
   `ownership/roadside-assistance` (parent `ownership`) and the decade
   pages (parent `legacy`). Home has `heroStyle = full`.
4. `stories.js`: four stories, each with 3 to 5 sections (text, image,
   text, ctaGroup) and `relatedVehicles`.
5. `retailers.js`: six retailers with real-looking but fictional addresses
   across UK, Germany, USA, UAE, and a `location` lat/lng each.
6. `site.js`: the `siteSettings` singleton with ID `site`.
7. `index.js`: `export const SEED_GROUPS = [assets, ...VEHICLE_SEED_GROUPS, links, sections, stories, pages, retailers, site]`
   importing from A2 and B1.

Verify: `node scripts/setup.js --dry-run` passes for all groups.

### B3. Front-end templates

Owns: `site/js/render/*.js`, section styles appended to `site/styles.css`
under a `/* sections */` marker (coordinate: A3 owns the top of the file;
append only).

1. `render/index.js` exports the registry: `vehicle`, `vehicleCategory`,
   `page`, `story`, `retailers`, `home`, `notFound`, plus section renderers
   keyed by content type ID (`textBlock`, `imageBlock`, `bannerButton`,
   `cardGrid`, `vehicleGrid`, `storyGrid`, `ctaGroup`).
2. `render/vehicle.js`: VLP in this order: hero (image, name, tagline),
   product sub-nav (sticky; Configure, Enquire, variant switch to
   `parentModel` or children found via a query on `fields.parentModel.sys.id`,
   Downloads), statement, overview carousel (scroll-snap), in-detail tabs
   (exterior/interior, keyboard accessible), specs tiles (featured) plus
   full specification table grouped by `group` behind a disclosure,
   performance blurb, MSO banner, lineage timeline, related stories, FAQs
   as `<details>`.
3. `render/category.js`: tabs across all categories, intro, product cards
   (image, name, short description, Explore and Configure or Enquire),
   featured banner, continue-your-journey group, breadcrumb.
4. `render/page.js`: hero (full or compact, kicker), sibling sub-navigation
   when `parent` is set or the page has children, sections in order.
5. `render/story.js`: hero with kicker and date, standfirst, sections,
   related vehicles as cards.
6. `render/retailers.js`: grouped by country, each with address, phone,
   website, and a "View on map" link to `https://www.openstreetmap.org/?mlat=..&mlon=..`.
7. `render/home.js`: delegates to `page` for slug `home`.
8. Every template sets `document.title` from `seo.title` or the entry title
   and updates a `<meta name="description">`.
9. Styles: hero, sub-nav, statement, carousel, tabs, spec tiles and table,
   timeline, cards, banner, cta group, story layout, retailer list. Mobile
   first, breakpoints at 768px and 1024px.

Verify: write `test/render.test.js` rendering each template from fixtures
in `test/fixtures/` (build fixtures by hand from the design's field lists)
and asserting key strings and no `undefined`/`[object Object]` in output.
`npm run dev` plus headless Chromium screenshots of `#/750s`,
`#/current-models/supercars`, `#/post/750s-five-key-facts` once content is
provisioned; before that, use the fixtures through a `?fixture=` dev switch
is not required, tests are enough.

## Phase C: integrate, verify, ship (sequential, orchestrator plus review agents)

### C1. Provision and verify (orchestrator)

1. `npm run teardown:blog`, then `npm run setup`. Fix seed errors and
   re-run until clean; it is idempotent.
2. Write `scripts/verify-content.js` (`npm run verify`): for each slug in
   the inventory query the Delivery API and assert published, hero asset
   present, featured spec count ≤ 3, slugs unique across vehicles, pages,
   and stories, and no unresolved links at include=4. Exit non-zero on
   failure and print a table.
3. `npm run dev`, screenshot every route at 1280px and 375px with headless
   Chromium into the scratchpad, inspect for layout breaks and missing
   content, and fix.

### C2. Code review (review agent)

Review the full diff against `main` for correctness, XSS (every user string
must pass through the escaping template), accessibility basics (alt text,
tab order, focus styles, reduced motion), and consistency with the design.
Report findings; orchestrator applies fixes.

### C3. Ship

1. Update `README.md`: new content model summary, scripts, link to the
   design doc.
2. Commit in logical units (model and provisioning; placeholders; front-end
   core; seeds; templates; docs). Push to `main`; the Pages workflow deploys.
3. Verify the live URL renders `#/750s` and `#/current-models/supercars`.
