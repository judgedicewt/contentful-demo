# Launch-site polish implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the SVG placeholders with 30 generated studio photos mapped onto the existing 86 asset slots, and add restrained motion plus a richer home page, without changing any content type, entry, asset ID, or route.

**Architecture:** A photo manifest and a slot-mapping module sit beside the existing placeholder manifest. Asset seeds pick a WebP photo when its file exists and otherwise keep the SVG, so provisioning and the site work at any point of the rollout. The front end gains crop options on `imageTag`, one `motion.js` module for reveals, carousel, and the compact bar, and a home renderer with a showcase strip. Generation itself is a manual step driven from the Claude session through the Figma connector; a script handles conversion.

**Tech Stack:** Node 22 ES modules, `node --test`, ImageMagick `convert`, Contentful Images API, vanilla CSS and JS, Figma MCP `generate_image`.

**Spec:** `docs/superpowers/specs/2026-10-21-launch-site-polish-design.md`

## Global constraints

- No change to content type IDs, entry IDs, asset IDs, or routes.
- Images: generic unbranded cars, no badges, text, or people. Committed as WebP under `assets/photos/`, quality 82, drop to 75 for any file over 600 KB, total under 12 MB.
- Site stays dependency free; motion lives under `@media (prefers-reduced-motion: no-preference)`.
- All HTML goes through the `html` tag from `site/js/dom.js`; no inline event handlers.
- Only the orchestrator runs `npm run setup`, `npm run verify`, git commit, and git push.
- Commit messages: imperative subject, wrapped body, the attribution trailer the session supplies.

## Review focus

1. A slot whose photo file is missing (partial generation) must fall back to its SVG seed and render without a broken image. Tested in Task 1 and Task 2.
2. An asset with no `details.image` dimensions (WebP uploads before processing finishes, or a bad fixture) must still render `imageTag` without `NaN` width or height. Tested in Task 4.
3. A carousel with one slide must hide or disable both buttons and not throw in `motion.js`. Tested in Task 5.
4. Reduced motion on: every `[data-reveal]` element is visible with no JS. Tested by the CSS rule in Task 5 and the reduced-motion screenshot in Task 8.
5. Home page with zero current vehicles returned (CDA outage or empty env) must render without the showcase strip rather than an empty section. Tested in Task 6.

---

### Task 1: Photo manifest and slot mapping

**Files:**
- Create: `src/photos/manifest.js`, `src/photos/slots.js`
- Test: `test/photos.test.js`

**Interfaces:**
- Produces: `PHOTO_SHOTS: Array<{ id, file, width, height, aspect: '16:9'|'4:3', prompt, vehicleSlug?: string, pageSlug?: string, legacy?: boolean }>` with exactly 30 entries; `SHOT_BY_ID: Map`; `photoForAsset(assetId: string): shot | null`; `BASE_PROMPT: string`.

- [ ] **Step 1: Write the failing tests** in `test/photos.test.js`:
  - `PHOTO_SHOTS has 30 shots with unique ids and files under assets/photos/`
  - `every shot prompt contains BASE_PROMPT and none mention "McLaren"` (also assert no prompt contains "badge" without "no badges")
  - `photoForAsset maps every manifest asset id`: import `MANIFEST` from `src/placeholders/manifest.js`; for each id assert `photoForAsset(id)` is a shot or `null`, and assert these exact mappings: `img-750s-hero` → `shot-750s-hero`, `img-750s-overview-2` → `shot-750s-hero`, `img-750s-exterior` → `shot-750s-hero`, `img-750s-card` → `shot-750s-card`, `img-lineage-f1` → `shot-f1-card`, `img-story-w1-hero` → `shot-story-w1-hero`, `img-story-w1-inline` → `shot-story-w1-hero`, `img-home-hero` → `shot-home-hero`, `img-cat-supercars` → `shot-750s-hero`, `img-og-default` → `null`.
  - `legacy vehicles are flagged`: `SHOT_BY_ID.get('shot-f1-hero').legacy === true`, `shot-750s-hero` is not legacy.

- [ ] **Step 2: Run** `node --test test/photos.test.js` → FAIL (module not found).

- [ ] **Step 3: Implement `src/photos/manifest.js`.** Vehicle data comes from `VEHICLE_SEED_GROUPS` in `src/seed/vehicles.js` (group named `vehicles`: `fields.slug`, `fields.bodyStyle` in `coupe|spider|gt|race`, `fields.status`). Shot ids: `shot-<slug>-hero` (1920x1080, 16:9) and `shot-<slug>-card` (1200x900, 4:3) per vehicle, plus 16:9 page and story heroes `shot-home-hero`, `shot-legacy-hero`, `shot-experiences-hero`, `shot-mso-hero`, `shot-story-750s-facts-hero`, `shot-story-artura-spider-hero`, `shot-story-w1-hero`, `shot-story-mso-hero`. `BASE_PROMPT` is: `Photoreal studio photograph of a generic unbranded mid-engine supercar on a dark studio set, low camera, dramatic rim lighting, a single orange accent light, polished dark floor, no badges, no logos, no text, no people.` Each vehicle prompt appends the body style phrase (`coupe` → "two-door coupe with a low roofline", `spider` → "open-top spider with the roof down", `gt` → "long-nosed grand tourer with a fastback roof", `race` → "race car with a large rear wing and plain unliveried bodywork"), the paint colour from a fixed map (`artura` papaya orange, `artura-spider` silver, `750s` volcano red, `750s-spider` pearl white, `gts` deep green, `w1` matte black with orange highlights, `artura-gt4` plain white, `720s` azure blue, `765lt` gloss black, `p1` volcanic yellow, `f1` dark silver), the angle (hero: "front three-quarter view", card: "side profile"), and for legacy `status` the phrase "warm archival colour grade with subtle film grain". Page prompts: home → "a covered car under a sheet in an empty dark studio, one spotlight"; legacy → "three generic classic supercars in a dark museum hall"; experiences → "a generic supercar at night on a floodlit race track pit lane"; mso → "a generic supercar body in a bespoke paint booth, orange paint being applied"; stories reuse the related vehicle's hero prompt with "rear three-quarter view" (mso story uses the mso prompt). `file` is `assets/photos/<id>.webp`.

- [ ] **Step 4: Implement `src/photos/slots.js`.** `photoForAsset(id)`: patterns in order: `img-lineage-<slug>` → card shot; `img-<slug>-card` → card shot; `img-<slug>-(hero|overview-\d|exterior|interior|mso)` → hero shot, matching the longest vehicle slug first so `artura-spider` beats `artura`; `img-story-<key>-(hero|inline)` → `shot-story-<key>-hero`; `img-cat-supercars` → `shot-750s-hero`, `img-cat-grand-tourer` → `shot-gts-hero`, `img-cat-ultimate` → `shot-w1-hero`, `img-cat-motorsport` → `shot-artura-gt4-hero`; `img-home-hero`, `img-legacy-hero`, `img-legacy-2010s-hero` (→ legacy), `img-legacy-1990s-hero` (→ legacy), `img-ownership-hero` (→ `shot-gts-hero`), `img-experiences-hero`, `img-mso-hero`, `img-mso-banner` (→ mso), `img-mcl-6gt-banner` (→ `shot-gts-hero`), `img-experience-*` (→ experiences); anything else `null`.

- [ ] **Step 5: Run** `node --test test/photos.test.js` → PASS. Run `npm test` → all pass.

- [ ] **Step 6: Commit** `src/photos/ test/photos.test.js` with subject "Add photo shot manifest and asset slot mapping".

---

### Task 2: Photo-aware asset seeds and the conversion script

**Files:**
- Modify: `src/seed/assets.js`
- Create: `scripts/generate-photos.js`
- Modify: `package.json` (script `"photos": "node scripts/generate-photos.js"`)
- Test: `test/photos.test.js` (extend), `test/provision.test.js` (no change expected)

**Interfaces:**
- Consumes: `photoForAsset`, `PHOTO_SHOTS` from Task 1.
- Produces: `buildAssetSeeds({ fileExists }: { fileExists: (path: string) => boolean })` exported from `src/seed/assets.js`; `ASSET_SEEDS` remains the default built with `fs.existsSync` against the repo root; `convertPhoto({ shot, input, output, convert })` and `planPhotos({ shots, fileExists, force })` exported from `scripts/generate-photos.js` (the script's CLI calls them).

- [ ] **Step 1: Write failing tests** in `test/photos.test.js`:
  - `buildAssetSeeds uses a webp when the shot file exists`: `fileExists = (p) => p.endsWith('shot-750s-hero.webp')`; seed `img-750s-hero` has `file: 'assets/photos/shot-750s-hero.webp'`, `contentType: 'image/webp'`; seed `img-artura-hero` keeps `assets/placeholders/img-artura-hero.svg` and `image/svg+xml`; seed `img-og-default` keeps SVG.
  - `planPhotos skips existing files unless forced`: with `fileExists` true for `shot-750s-hero`, `planPhotos({ shots: PHOTO_SHOTS, fileExists, force: [] })` marks it `kept` and the rest `missing`; with `force: ['shot-750s-hero']` it is `missing`.
  - `convertPhoto builds the ImageMagick command`: pass a fake `convert = (args) => calls.push(args)`; assert args include `-resize 1920x1080^`, `-gravity center`, `-extent 1920x1080`, `-quality 82`, and the output path; when `convert` reports a size over 600000 bytes (fake `statSize`), it is re-run with `-quality 75`.

- [ ] **Step 2: Run** `node --test test/photos.test.js` → FAIL.

- [ ] **Step 3: Implement `buildAssetSeeds`** in `src/seed/assets.js`: for each `MANIFEST` entry, `const shot = photoForAsset(entry.id)`; if `shot && fileExists(shot.file)` use the webp, else keep the SVG. Title and description unchanged. `ASSET_SEEDS = buildAssetSeeds({ fileExists: (p) => existsSync(resolve(ROOT, p)) })` where `ROOT` is the repo root derived from `import.meta.url`.

- [ ] **Step 4: Implement `scripts/generate-photos.js`.** CLI: `node scripts/generate-photos.js --input=<dir> [--force=id,id]`. `planPhotos` returns `[{ shot, status: 'kept'|'missing' }]`. For each `missing` shot, look in `--input` for `<shot.id>.png|jpg|jpeg|webp`; if found, `convertPhoto` runs `convert <input> -resize WxH^ -gravity center -extent WxH -strip -quality 82 <output>` via `child_process.execFileSync('convert', args)`, checks size with `statSync`, re-runs at quality 75 if over 600000 bytes, and reports `new`; otherwise reports `missing` with the expected input filename. Prints a table `id  status  size` and the total size of `assets/photos/`. Exit code 0 even when shots are missing (partial runs are expected). Also print the prompt for each `missing` shot when `--prompts` is passed, so the generating session can copy it.

- [ ] **Step 5: Run** `node --test` → all pass. Run `node scripts/setup.js --dry-run` → "Dry run passed".

- [ ] **Step 6: Commit** with subject "Prefer generated photos in asset seeds and add the conversion script".

---

### Task 3: Generate the 30 photos (orchestrator, manual)

**Files:**
- Create: `assets/photos/*.webp`
- No code changes.

**Interfaces:**
- Consumes: `node scripts/generate-photos.js --prompts` for the prompt list; `convertPhoto` via the CLI.

- [ ] **Step 1:** Create one Figma design file "McLaren demo imagery" in the WillowTree organisation (`planKey organization::879788932150384554`) with `create_new_file`.
- [ ] **Step 2:** For each shot from `--prompts`, call `generate_image` with the prompt and the shot's width and height, model `gemini-3.1-flash-image`. Download `image.url` with curl into the scratchpad input directory as `<shot.id>.png`. View each image; if a car shows a badge, text, people, or an unmistakable real marque, regenerate it once with "generic, fictional design" appended.
- [ ] **Step 3:** Run `node scripts/generate-photos.js --input=<scratch dir>` → every shot `new` or `kept`; total under 12 MB.
- [ ] **Step 4:** Run `npm test` and `node scripts/setup.js --dry-run` → pass.
- [ ] **Step 5: Commit** `assets/photos/` with subject "Add generated studio photography for vehicles, pages, and stories".

---

### Task 4: Crop options on the image helper

**Files:**
- Modify: `site/js/render/common.js:63-85` (`imageSrc`, `imageTag`, `imageDimensions`)
- Modify: renderers that pass crops: `site/js/render/vehicle.js` (cards in lineage and related stories, detail panels), `site/js/render/sections.js` (cardGrid, vehicleGrid, storyGrid, imageBlock), `site/js/render/category.js`, `site/js/render/story.js`
- Test: `test/render.test.js`

**Interfaces:**
- Produces: `imageTag(ctx, asset, { w, className, eager, alt, sizes, aspect?: '16:9'|'4:3'|'3:4'|'21:9'|'1:1', focus?: 'center'|'top'|'bottom'|'left'|'right'|'faces' })`. With `aspect`, the URL carries `fit=fill&f=<focus>&w=<w>&h=<round(w*den/num)>` and the `<img>` width and height attributes use those exact values. `imageSrc(ctx, asset, w, { aspect, focus })` has the same options.

- [ ] **Step 1: Write failing tests** in `test/render.test.js`:
  - `imageTag with aspect 4:3 requests a filled crop`: `imageTag(ctx, asset, { w: 1200, aspect: '4:3' })` output contains `fit=fill`, `f=center`, `w=1200`, `h=900`, `width="1200" height="900"`.
  - `imageTag with aspect and a focus`: `focus: 'bottom'` → `f=bottom`.
  - `imageTag without image details still renders`: asset fixture with `file.details` absent, no aspect → output has `src` and no `width=` attribute, and no `NaN`.
  - `SVG assets never get fm=webp but do get fit when aspect is set`.

- [ ] **Step 2: Run** `node --test test/render.test.js` → FAIL.

- [ ] **Step 3: Implement** the options in `common.js`. `ASPECTS = { '16:9': [16, 9], '4:3': [4, 3], '3:4': [3, 4], '21:9': [21, 9], '1:1': [1, 1] }`. When `aspect` is set, `h = Math.round(w * den / num)` and dims are `{ width: w, height: h }` regardless of asset details.

- [ ] **Step 4: Pass aspects from renderers:** product and story cards `aspect: '4:3'`; lineage portrait tiles `aspect: '3:4', focus: 'center'`; in-detail panels `aspect: '16:9'`; imageBlock keeps natural aspect; category hero and vehicle hero unchanged (natural 16:9 source). Update any existing render test snapshots that assert exact URLs.

- [ ] **Step 5: Run** `npm test` → all pass.

- [ ] **Step 6: Commit** with subject "Add crop options to the image helper and use them in cards and tiles".

---

### Task 5: Motion module, carousel, reveals, compact bar

**Files:**
- Create: `site/js/motion.js`
- Modify: `site/app.js` (import and call `initMotion(mainEl)` after each `showMain`), `site/js/render/vehicle.js:115-150` (carousel buttons, `data-reveal` marks), `site/js/render/sections.js` and `site/js/render/story.js` and `site/js/render/category.js` (`data-reveal` on section headings and card lists), `site/styles.css` (new block after `/* sections */`)
- Test: `test/render.test.js`, `test/motion.test.js`

**Interfaces:**
- Produces: `initMotion(root: Element, { reducedMotion?: boolean, observer?: typeof IntersectionObserver }): () => void` (returns a teardown). Pure helpers exported for tests: `carouselStep(track: { clientWidth, scrollLeft, scrollWidth }, direction: 1|-1): number` returns the target `scrollLeft`; `shouldShowControls(track): boolean` false when `scrollWidth <= clientWidth + 1`.
- Markup contract: carousel buttons are `<button data-carousel-prev>` and `<button data-carousel-next>` with no `onclick`; the track is `.carousel__track[data-carousel-track]`; the sticky bar is `.subnav--product[data-compact-bar]`; the hero is `.hero--full[data-hero]`; reveal targets carry `data-reveal`.

- [ ] **Step 1: Write failing tests**:
  - In `test/render.test.js`: `vehicle carousel has no inline handlers` (output does not contain `onclick=`; contains `data-carousel-prev`, `data-carousel-next`, `data-carousel-track`); `vehicle hero and sections carry reveal marks` (`data-hero` on the hero, at least 3 `data-reveal` occurrences); `product bar carries data-compact-bar`.
  - In `test/motion.test.js` (pure helpers, no DOM): `carouselStep` with `clientWidth 1000, scrollLeft 0` and direction 1 → `800`; at `scrollLeft 1600, scrollWidth 2400` direction 1 → `0` (wraps to start); `shouldShowControls` false for `scrollWidth 1000, clientWidth 1000`, true for `2400/1000`; `initMotion` with a stub root lacking `querySelectorAll` matches throws nothing when `observer` is undefined (returns a no-op teardown).

- [ ] **Step 2: Run** the two test files → FAIL.

- [ ] **Step 3: Implement `site/js/motion.js`.** `initMotion` does: (a) skip reveals when `reducedMotion` (default `matchMedia('(prefers-reduced-motion: reduce)').matches`) or `observer` is undefined, otherwise observe `[data-reveal]` with threshold 0.15 and add `is-visible` once, then unobserve; (b) delegate clicks for `[data-carousel-prev|next]` to `track.scrollTo({ left: carouselStep(track, dir), behavior })`, add pointer drag on `[data-carousel-track]` (pointerdown records x and scrollLeft, pointermove scrolls, pointerup releases; set `is-dragging` to suppress link clicks when moved over 6 px), ArrowLeft and ArrowRight when the track has focus (`tabindex="0"` added by the renderer), and hide `.carousel__controls` when `!shouldShowControls(track)`; (c) observe `[data-hero]` and toggle `is-compact` on `[data-compact-bar]` when the hero is not intersecting. Return a teardown that disconnects observers and removes listeners.

- [ ] **Step 4: Update renderers** per the markup contract and remove `SCROLL`. Add `data-reveal` to: statement text, each highlight card, spec table rows' container, lineage items, FAQ list, story cards, cardGrid cards, section headings.

- [ ] **Step 5: Add CSS** in `site/styles.css` under a new `/* Motion ----- */` block: inside `@media (prefers-reduced-motion: no-preference)`: `.hero--full .hero__image { animation: hero-zoom 6s ease-out both }` from `scale(1.06)` to `scale(1)`; `.hero__content > * { animation: fade-up .6s ease-out both }` with `animation-delay` 0, .12s, .24s via `:nth-child`; `[data-reveal] { opacity: 0; transform: translateY(16px); transition: opacity .5s ease-out, transform .5s ease-out }` and `[data-reveal].is-visible { opacity: 1; transform: none }`; `.subnav--product { transition: padding .25s ease }` and `.subnav--product.is-compact .subnav__inner { padding-block: .35rem }` with the title visible only when compact at narrow widths; `.carousel__track.is-dragging { cursor: grabbing; scroll-snap-type: none; user-select: none }`; `.carousel__track { cursor: grab }`. Outside the media query nothing hides, so reduced motion shows everything.

- [ ] **Step 6: Wire `app.js`:** import `initMotion`; keep a `teardownMotion` variable; call it before each render and set it from `initMotion(mounts.main)` after `showMain`.

- [ ] **Step 7: Run** `npm test` → all pass. Run `npm run dev` in the background, screenshot `#/750s` with headless Chromium at 1280x900 and confirm the carousel buttons work (no console errors in `--enable-logging` output). Kill the server as its own command.

- [ ] **Step 8: Commit** with subject "Add motion: hero zoom, scroll reveals, drag carousel, and compact product bar".

---

### Task 6: Home page hero and model showcase

**Files:**
- Modify: `site/js/cda.js` (add `getCurrentVehicles()`), `site/js/router.js:178-182` (home case loads `showcase`), `site/js/render/home.js`, `site/styles.css`
- Test: `test/render.test.js`, `test/router.test.js`, `test/fixtures/render-home.json`

**Interfaces:**
- Consumes: `imageTag` with `aspect` from Task 4; carousel markup contract from Task 5.
- Produces: `cda.getCurrentVehicles(): Promise<Entry[]>` querying `content_type: 'vehicle', 'fields.status': 'current', order: 'fields.order', include: 1, limit: 20`; home route data gains `showcase: Entry[]` (empty array on error); `render(data, ctx)` in `home.js` emits `.hero--home` and, when `showcase.length > 0`, a `<section class="section showcase theme-carbon">` whose track is `.carousel__track[data-carousel-track]` with one `.showcase__card` per vehicle (card image `aspect: '4:3'`, name, tagline, link via `ctx.routeFor`), then the page sections as before.

- [ ] **Step 1: Write failing tests**:
  - `test/router.test.js`: `home route loads showcase vehicles` with a stub cda whose `getCurrentVehicles` resolves two entries → `data.showcase.length === 2`; when it rejects → `data.showcase` is `[]` and the view is still `home`.
  - `test/render.test.js`: `home renders the showcase strip` using `render-home.json` extended with a `showcase` array of two vehicle fixtures → output contains `class="section showcase`, two `showcase__card`, `data-carousel-track`, and each vehicle name; `home without showcase omits the strip` (`showcase: []` → no `showcase` class); `home hero uses the taller variant` (`hero--home` present).

- [ ] **Step 2: Run** both files → FAIL.

- [ ] **Step 3: Implement** `getCurrentVehicles` in `cda.js`, the router change (`Promise.allSettled` so a showcase failure does not break the page), and `home.js`: render the hero yourself (copy the `page.js` hero but with classes `hero hero--full hero--home theme-carbon`, the site name as `h1`, the page `kicker` as eyebrow, and the first `textBlock` section's heading if present as a strapline), then the showcase section, then `renderSections(entry.fields.sections, ctx)`; keep `setHead` behaviour.

- [ ] **Step 4: CSS:** `.hero--home { min-height: min(92vh, 56rem) }` with the title at `clamp(2.5rem, 7vw, 6rem)`; `.showcase__track` horizontal scroll-snap with cards `flex: 0 0 min(78vw, 22rem)`, `.showcase__card` dark card with the image, name, tagline, and an orange "Explore" link; headings `data-reveal`.

- [ ] **Step 5: Run** `npm test` → all pass. Screenshot `#/` at 1280x900 and 390x844.

- [ ] **Step 6: Commit** with subject "Rework the home page with a taller hero and a model showcase strip".

---

### Task 7: README imagery section

**Files:**
- Modify: `README.md` (new "Imagery" section after "Seed content", scripts table gains `npm run photos`)

- [ ] **Step 1:** Add a section that explains: the 30-shot manifest, that generation is manual through Figma and credits apply, how to run `node scripts/generate-photos.js --prompts` and `--input=<dir>`, that slots without a photo fall back to SVG, and that re-running `npm run setup --only=assets` uploads only changed files.
- [ ] **Step 2:** Run `npm test` (unchanged) and commit with subject "Document the photo pipeline".

---

### Task 8: Provision, verify, screenshots (orchestrator)

- [ ] **Step 1:** `node scripts/setup.js --dry-run` → pass. `node scripts/setup.js --only=assets` → N updated where N equals the number of slots with a photo. 
- [ ] **Step 2:** `npm run verify` → passed.
- [ ] **Step 3:** Push; wait for the Pages deploy; headless Chromium screenshots at 1280x900 and 390x844 of `#/`, `#/750s`, `#/f1`, `#/current-models/supercars`, `#/post/w1-designed-by-air`, plus `#/750s` with `--force-prefers-reduced-motion`. Check: no "PLACEHOLDER" label, no cropped-off car heads on cards, hero title readable, carousel buttons present only when needed, reduced-motion page shows every section.
- [ ] **Step 4:** Send screenshots to the user with the live URL and the Figma file link.

---

### Task 9: Whole-branch review

A fresh reviewer on Opus reads the spec, the plan, and `git diff 55bdb5e..HEAD`, runs `npm test`, renders every route against the live CDA as the previous review did, and reports findings by severity. The orchestrator applies confirmed fixes, re-runs Task 8 steps 1 to 3, and commits.

## Model assignment

| Task | Model | Why |
| --- | --- | --- |
| 1, 2, 4, 6 | Sonnet | Well-specified modules with exact tests |
| 3 | Orchestrator (Fable) | Needs the Figma connector and visual judgement per image |
| 5 | Sonnet | Moderate DOM and CSS work with a tight markup contract |
| 7 | Haiku | Prose from a fixed outline |
| 8 | Orchestrator | Runs provisioning against the shared space |
| 9 | Opus | Independent review needs the strongest non-Fable reader |
