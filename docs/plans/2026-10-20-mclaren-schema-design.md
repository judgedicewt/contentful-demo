# McLaren-style content schema: design

Status: approved for implementation on 2026-10-20.
Companion plan: `2026-10-20-mclaren-schema.md`.

## Goal

Turn the demo into a convincing model of how McLaren's cars site
(`mclaren.com/cars/gl_en`) could be modelled in Contentful and rendered as a
static site on GitHub Pages. The schema matters more than the pixels: a
McLaren content editor should recognise every content type and section, and
the ~25 pages should read as a coherent, navigable site.

Non-goals: pixel-matching the McLaren design, real imagery, configurator or
enquiry forms (CTAs link to placeholder routes), localisation beyond a single
`gl_en` locale value, authentication, and any server-side code.

## What the real site looks like

Captured by rendering the live pages in headless Chromium. McLaren uses a
coded component library; the codes are kept here as the `componentCode`
reference so the mapping to their system is obvious.

Main navigation: MODELS, MSO, OWNERSHIP, EXPERIENCES, ABOUT, PRE-OWNED, plus a
persistent "Find a retailer" link. Footer: More links, Useful links, Contact,
Follow us, Subscribe, locale picker, legal links.

Vehicle landing page (VLP), e.g. `/750s`, `/gts`, `/W1`:

| Section | McLaren code | Content |
| --- | --- | --- |
| Hero | `h010-vlp-hero` | Full-bleed video/image, model wordmark, "Skip intro" |
| Product sub-nav | `product-sub-nav` | Model name, Configure, Enquire, Change model variant, Downloads (brochure, options guide) |
| Statement | `t006-statement` | One long animated sentence, optional "Watch the film" |
| Overview carousel | `c060-full-bleed-carousel` | Slides with heading, body, media ("Dramatic power") |
| In detail | `in-detail` | Exterior / Interior tabs, each with highlights ("Carved by air", tags like "Exhaust", "Dihedral doors") |
| Specifications | `x003-specs` | Three featured tiles (332 km/h top speed, 800 Nm torque, 750 PS power), "See full specifications", performance blurb |
| MSO banner | `mso` | Customise CTA with reveal image |
| Lineage | `P001EvolutionLineage` | Intro plus year-stamped predecessors (2020 765LT, 2017 720S, 1992 F1) |
| Stories | `relevant-content-section` | Related post cards |

Category page, e.g. `/current-models/supercars`: category tabs (Supercars,
Grand Tourers, Hypercars, Motorsport), header text (`t002-header`), product
cards with Explore / Configure / Enquire (`P110ProductCards`), Explore
models forward/back (`C012NextStepsForwardBack`), "Continue your journey" CTA
group, banner with button (`c002-banner-button`, "Legend-Inspired" McL 6GT),
breadcrumb.

Story page, e.g. `/post/750s-five-key-facts`: hero with kicker ("CUSTOMER")
and title (`h001-hero`), text blocks (`t001-text`), image blocks
(`m020-image`).

Legacy decade page, e.g. `/legacy/2010s`: hero (kicker "PAST MODELS"), sticky
sub-navigation across decades (`n010-sub-navigation`), header text, product
cards for the decade's models.

Ownership page, e.g. `/ownership/roadside-assistance`: hero with kicker
"McLAREN OWNERSHIP", sticky sub-navigation across sibling ownership pages,
text block, "Continue your journey" CTAs.

Experiences page: hero, text block, card grid (Winter Ball, Arctic
Experience) with Discover / Register interest CTAs, image block.

## Content model

Field types use Contentful names. `Link<X>` is a reference validated to
content type X. `[Link<X>]` is an ordered references array. All text is
single-locale `en-US`. Every type has a `componentCode` note in its
description where it maps to a McLaren section code.

### Site and navigation

**siteSettings** (singleton, id `site`)
- `siteName` Symbol, required
- `locale` Symbol, default `gl_en`
- `mainNavigation` [Link<link>]
- `footerGroups` [Link<linkGroup>]
- `socialLinks` [Link<link>]
- `newsletterText` Text
- `retailerLink` Link<link>
- `legalLinks` [Link<link>]
- `homePage` Link<page>

**link** — a labelled pointer used for navigation and CTAs
- `label` Symbol, required
- `target` Link<page | vehicle | vehicleCategory | story> (any of these)
- `externalUrl` Symbol (used when `target` is empty; validated as URL)
- `style` Symbol, in [primary, secondary, text], default `text`
- `children` [Link<link>] (nav dropdowns only)

**linkGroup** — footer column or sub-navigation group
- `heading` Symbol, required
- `links` [Link<link>]

**seoMetadata**
- `title` Symbol, required
- `description` Text
- `ogImage` Link<Asset>
- `noIndex` Boolean, default false

### Vehicles

**vehicleCategory** — Supercars, Grand Tourers, Hypercars, Motorsport
- `name` Symbol, required
- `slug` Symbol, required, unique (`supercars`, `grand-tourer`, `ultimate`, `motorsport`)
- `intro` Text (the `t002-header` copy)
- `order` Integer
- `heroImage` Link<Asset>
- `featuredBanner` Link<bannerButton>
- `seo` Link<seoMetadata>

Vehicles in a category are queried, not curated: `vehicle.category == this`,
ordered by `vehicle.order`. The front end builds the category tabs from all
categories ordered by `order`.

**vehicle** — one entry per model variant; the VLP
- `name` Symbol, required ("750S Spider")
- `slug` Symbol, required, unique (`750s-spider`)
- `category` Link<vehicleCategory>, required
- `status` Symbol, in [current, legacy, motorsport], required
- `bodyStyle` Symbol, in [coupe, spider, gt, race]
- `order` Integer (position within its category)
- `parentModel` Link<vehicle> (Spider → Coupé; powers "Change model variant")
- `shortDescription` Text (product card copy, ≤ 200 chars)
- `tagline` Symbol (hero)
- `statement` Text (`t006-statement`)
- `heroImage` Link<Asset>, required
- `cardImage` Link<Asset>
- `filmUrl` Symbol (optional "Watch the film")
- `configureUrl` Symbol
- `enquiryUrl` Symbol
- `downloads` [Link<Asset>] (brochure, options guide)
- `overviewSlides` [Link<mediaSlide>] (`c060-full-bleed-carousel`)
- `highlights` [Link<featureHighlight>] (`in-detail`; grouped by `area`)
- `specifications` [Link<specification>] (`x003-specs`; tiles are those with `featured = true`, max 3)
- `performanceHeading` Symbol, `performanceBody` Text (the blurb under the spec tiles)
- `lineageIntro` Text, `lineage` [Link<lineageEntry>] (`P001EvolutionLineage`)
- `msoBanner` Link<bannerButton>
- `relatedStories` [Link<story>]
- `faqs` [Link<faqItem>]
- `yearIntroduced` Integer (legacy grouping and lineage)
- `seo` Link<seoMetadata>

Legacy vehicles reuse this type with `status = legacy`; their pages render
the same template with whatever sections are populated.

**specification**
- `label` Symbol, required ("Top speed")
- `value` Symbol, required ("332")
- `unit` Symbol ("km/h")
- `group` Symbol, in [performance, powertrain, dimensions, weight], required
- `featured` Boolean, default false
- `order` Integer

**featureHighlight** (`in-detail` item)
- `title` Symbol, required ("Carved by air")
- `body` Text
- `area` Symbol, in [exterior, interior], required
- `tag` Symbol ("Dihedral doors")
- `image` Link<Asset>

**mediaSlide** (`c060-full-bleed-carousel` slide)
- `heading` Symbol, required
- `body` Text
- `media` Link<Asset>, required

**lineageEntry** (`P001EvolutionLineage` item)
- `year` Integer, required
- `title` Symbol, required ("765LT")
- `body` Text
- `image` Link<Asset>
- `vehicle` Link<vehicle> (optional deep link)

**faqItem**
- `question` Symbol, required
- `answer` RichText

### Pages and sections

**page** — modular page for everything that isn't a vehicle, category, or story
- `title` Symbol, required
- `slug` Symbol, required, unique; nested paths use `/` (`ownership/roadside-assistance`, `legacy/2010s`)
- `kicker` Symbol (hero eyebrow: "McLAREN OWNERSHIP", "PAST MODELS")
- `heroImage` Link<Asset>
- `heroStyle` Symbol, in [full, compact], default `compact`
- `parent` Link<page> (siblings sharing a parent form the sticky `n010-sub-navigation`)
- `order` Integer (position within siblings)
- `sections` [Link<textBlock | imageBlock | bannerButton | cardGrid | vehicleGrid | storyGrid | ctaGroup>]
- `seo` Link<seoMetadata>

**story** (`/post/...`)
- `title` Symbol, required
- `slug` Symbol, required, unique
- `kicker` Symbol ("Customer", "MSO", "Engineering")
- `publishDate` Date, required
- `standfirst` Text
- `heroImage` Link<Asset>, required
- `cardImage` Link<Asset>
- `sections` [Link<textBlock | imageBlock | ctaGroup>]
- `relatedVehicles` [Link<vehicle>]
- `seo` Link<seoMetadata>

**textBlock** (`t001-text`, `t002-header`)
- `heading` Symbol
- `body` RichText, required
- `variant` Symbol, in [text, header], default `text`
- `theme` Symbol, in [white, mist, carbon], default `white`

**imageBlock** (`m020-image`)
- `image` Link<Asset>, required
- `caption` Symbol
- `layout` Symbol, in [contained, full], default `contained`

**bannerButton** (`c002-banner-button`, also the VLP `mso` banner)
- `eyebrow` Symbol
- `heading` Symbol, required
- `body` Text
- `image` Link<Asset>
- `cta` Link<link>
- `theme` Symbol, in [carbon, colnbrook, white], default `carbon`

**card** — experience or generic promo card
- `title` Symbol, required
- `body` Text
- `image` Link<Asset>
- `cta` Link<link>

**cardGrid**
- `heading` Symbol
- `cards` [Link<card>], required

**vehicleGrid** (`P110ProductCards`, curated; category pages query instead)
- `heading` Symbol
- `vehicles` [Link<vehicle>], required

**storyGrid** (`relevant-content-section`)
- `heading` Symbol, default "Stories"
- `stories` [Link<story>] (empty means "latest 3 by publishDate")

**ctaGroup** ("Continue your journey")
- `heading` Symbol, default "Continue your journey"
- `links` [Link<link>], required

### Retailers

**retailer**
- `name` Symbol, required
- `city` Symbol, required
- `country` Symbol, required
- `address` Text
- `phone` Symbol
- `website` Symbol
- `location` Location (lat/lng; rendered as a list with a map link)

The `retailers` route queries all retailers ordered by country then city.
It exists to show the Location field type and a query-driven page.

### Removed

`blogPost` and `author` from the first demo are replaced by `story`. A
teardown step unpublishes and deletes their entries and content types.

## Page inventory

Routes are hash-based (`#/...`) and mirror McLaren's paths without the
locale segment. 26 routes total.

Vehicles (11), each rendered by the VLP template:

| Slug | Category | Status | Notes |
| --- | --- | --- | --- |
| `artura` | supercars | current | hybrid; parent of `artura-spider` |
| `artura-spider` | supercars | current | |
| `750s` | supercars | current | parent of `750s-spider`; lineage 765LT, 720S, F1 |
| `750s-spider` | supercars | current | |
| `gts` | grand-tourer | current | |
| `w1` | ultimate | current | lineage P1, F1 |
| `artura-gt4` | motorsport | motorsport | lighter content |
| `720s` | supercars | legacy | 2017 |
| `765lt` | supercars | legacy | 2020 |
| `p1` | ultimate | legacy | 2013 |
| `f1` | ultimate | legacy | 1992 |

Categories (4): `current-models/supercars`, `current-models/grand-tourer`,
`current-models/ultimate`, `current-models/motorsport`. `current-models`
alone redirects to supercars.

Pages (7): `home`, `legacy` (hub: vehicleGrid of all legacy vehicles plus
decade links), `legacy/2010s`, `legacy/1990s`, `ownership` (overview),
`ownership/roadside-assistance`, `experiences`, `mso`. That is 8 with `mso`.

Stories (4): `post/750s-five-key-facts`, `post/artura-spider-performance`,
`post/w1-designed-by-air`, `post/mso-project-placeholder`.

Query-driven (1): `retailers` (6 retailer entries across 4 countries).

Total: 11 + 4 + 8 + 4 + 1 = 28 routes, counting `current-models` redirect.

## Copy and imagery

Copy is original placeholder text written in McLaren's register (short
declarative sentences, performance and engineering vocabulary). Do not copy
sentences from mclaren.com. Model names are real McLaren names because the
demo is for McLaren; specifications may use publicly known headline figures
or plausible placeholders, and the spec doc does not vouch for their accuracy.

Images are generated SVG placeholders uploaded as Contentful assets: a
generic car silhouette on a themed background with the asset's purpose
printed on it ("750S hero", "Artura interior detail"). Three aspect ratios:
hero 16:9 at 1920x1080, card 4:3 at 1200x900, and portrait 3:4 at 900x1200.
Each asset has a stable ID and descriptive `title` and `description` so the
media library reads sensibly.

## Front end

Stays a dependency-free static site in `site/`, served by GitHub Pages, but
reorganised into ES modules under `site/js/`:

- `cda.js` fetches from the Delivery API and resolves links against the
  `includes` block recursively (`include=4` on page queries).
- `router.js` maps hash routes to loaders: vehicle, category, page, story,
  retailers, home, 404.
- `richtext.js` renders Contentful rich text (paragraphs, headings 2 to 4,
  bold, italic, hyperlinks, ordered and unordered lists, embedded assets).
- `render/*.js` is one module per content type or section, each exporting
  `render(entry, ctx) → string`.
- `shell.js` renders the header (main navigation from `siteSettings` with a
  Models dropdown listing categories), breadcrumbs, and footer.

Visual direction: dark "carbon" default theme with light "white" and "mist"
section themes, McLaren-like typographic scale, uppercase eyebrow labels,
orange accent used sparingly for primary CTAs. System fonts only. Mobile
first, no horizontal scroll at 375px.

Unit tests with `node --test` cover `cda.js` link resolution, `richtext.js`,
and `router.js` matching, using fixtures in `test/fixtures/`.

## Scripts

- `npm run setup` provisions content types, uploads assets, creates or
  updates entries in dependency order, and publishes everything. Idempotent
  via fixed IDs. Accepts `--only=<group>` to limit to one seed group.
- `npm run teardown:blog` removes the original `blogPost`/`author` demo.
- `npm run verify` checks the published space against the inventory above:
  every slug present and published, hero assets resolvable, featured specs
  ≤ 3 per vehicle, unique slugs, no dangling links.
- `npm run placeholders` regenerates the SVGs into `assets/placeholders/`.
- `npm test` runs the unit tests.
- `npm run dev` unchanged.

## Risks and decisions

- Parallel writers against one Contentful space conflict, so only one
  process runs `setup`. Subagents author seed files; the orchestrator runs
  provisioning.
- Contentful enforces rate limits (about 7 requests per second on the
  Management API). The setup script serialises writes and retries on 429.
- Deleting `blogPost` requires unpublishing and deleting its entries first.
- A vehicle's `highlights` link validation to `featureHighlight` only; the
  exterior/interior split is a field on the highlight, not two arrays, so
  editors can reorder freely.
