# Launch-site polish: generated imagery and motion

Date: 2026-10-21. Status: approved in conversation, pending written review.

## Goal

Make the demo at <https://judgedicewt.github.io/contentful-demo/> look like a
real McLaren launch site. The grey SVG placeholders become photoreal generic
supercars, and the front end gains restrained motion. The content model, entry
IDs, and routes do not change, so the editorial story from the first phase
still holds.

Success looks like: a walkthrough of home, a current vehicle, a legacy vehicle,
a category, and a story on desktop and phone reads as a finished brand site,
with no placeholder label visible and no layout shift from images.

## Constraints

- Imagery must be generic. No McLaren badges, wordmarks, or recognisable
  McLaren body shapes. No text or people in frame.
- The only image generator reachable from the build session is Figma's image
  generation through the user's Figma connector. Each image spends Figma AI
  credits on the plan that owns the destination file. The user chose the
  WillowTree organisation plan and a budget of about 30 images.
- Images are committed to the repo so `npm run setup` rebuilds the space from a
  clean clone. Total committed image weight stays under about 12 MB.
- The site stays dependency free, hash routed, and static. Motion honours
  `prefers-reduced-motion`.
- No change to content type IDs, entry IDs, asset IDs, or routes.

## Imagery pipeline

### Shot manifest

`src/photos/manifest.js` exports `PHOTO_SHOTS`, an array of 30 shots:

| Group | Count | Aspect | Slots they serve |
| --- | --- | --- | --- |
| Vehicle hero, one per vehicle | 11 | 16:9 at 1920x1080 | `img-<slug>-hero`, overview slides, detail panels, lineage images for that vehicle |
| Vehicle card, one per vehicle | 11 | 4:3 at 1200x900 | `img-<slug>-card`, portrait crops, grid cards |
| Story and page heroes | 8 | 16:9 at 1920x1080 | the 4 story heroes and the home, legacy, experiences, and MSO page heroes |

Each shot has `id`, `file` (`assets/photos/<id>.webp`), `width`, `height`,
`prompt`, and `vehicleSlug` or `pageSlug`.

Prompts share one base sentence: a generic unbranded mid-engine supercar on a
dark studio set, low camera, rim lighting, one orange accent light, carbon
floor, no badges, no text, no people, photoreal. Each shot appends:

- body style from the vehicle seed: coupe, spider with roof down, long-nosed
  grand tourer, or race car with wing and livery-free bodywork;
- a paint colour fixed per model in the manifest so a model looks the same on
  its hero and card;
- an angle: front three-quarter for heroes, side profile or rear
  three-quarter for cards;
- for `status: 'legacy'` vehicles, a warmer archival grade and film grain;
- for page and story heroes, a subject matching the page: a service bay for
  ownership, a track at night for experiences, a bespoke paint booth for MSO,
  an empty studio with a covered car for home.

### Generation script

`scripts/generate-photos.js` is run by a person with the Figma connector, not
by CI. It does not call Figma itself. The session that runs the project calls
`generate_image` once per shot, downloads the returned full-resolution file,
and passes the path to the script. The script owns everything after the
download:

1. Converts the downloaded PNG or JPEG to WebP at the manifest's width and
   height with ImageMagick (`convert`), centre cropping to the target aspect
   and using quality 82.
2. Writes it to the manifest `file` path.
3. Skips shots whose file already exists unless `--force=<id>` is passed, so a
   single bad image can be redone without spending credits on the rest.
4. Prints a table of shot id, status (`new`, `kept`, `missing`), and file size.

All generated frames live in one Figma design file in the WillowTree
organisation named "McLaren demo imagery", so the user can inspect and reuse
them.

### Mapping slots to shots

`src/seed/assets.js` keeps all 86 asset IDs. `src/photos/slots.js` exports
`photoForAsset(assetId)`, which returns the shot that serves that slot, or
`null`. The mapping is by convention: `img-<slug>-hero`, `img-<slug>-overview-*`,
`img-<slug>-detail-*`, and `img-<slug>-lineage-*` use the vehicle hero shot;
`img-<slug>-card` and `img-<slug>-portrait` use the vehicle card shot; story
and page assets use their own hero shot; anything else, such as the Open Graph
default, falls back to the SVG placeholder.

An asset seed whose shot file exists uses `file: assets/photos/<id>.webp` and
`contentType: 'image/webp'`. Otherwise it keeps the SVG. Because the existing
provisioning compares file name, content type, and byte length, re-running
`npm run setup --only=assets` re-uploads only slots whose file changed.

Different slots that share one shot still get distinct crops at render time.
`imageTag` in `site/js/render/common.js` gains `fit`, `focus`, and `aspect`
options that map to Contentful's image API (`fit=fill`, `f=<focus>`, `w`, `h`),
and the renderers pass the aspect each layout needs: 4:3 for cards, 3:4 for
portrait tiles, 21:9 for the home hero on wide screens.

## Front end motion

All motion is CSS with one small module, `site/js/motion.js`, and is wrapped in
`@media (prefers-reduced-motion: no-preference)`. With reduced motion on, every
element is visible and static.

- Hero: the image scales from 1.06 to 1.0 over 6 s on load, and the eyebrow,
  title, and strapline fade up in sequence over 0.6 s.
- Scroll reveals: `motion.js` registers one `IntersectionObserver` for
  `[data-reveal]` elements and adds `is-visible` at 15% visibility. Renderers
  mark section headings, cards, spec rows, and story tiles.
- Carousel: the track becomes a `scroll-snap-type: x mandatory` strip with
  pointer drag (pointer events, momentum left to the browser), arrow keys when
  focused, and previous and next buttons wired in `motion.js` by delegation.
  The inline `onclick` attributes go away.
- Sticky product bar: `motion.js` toggles `is-compact` once the hero leaves the
  viewport, which shrinks padding and shows the model name.
- Home page: a taller full-bleed hero with the headline over the image, a
  horizontally scrolling "Models" showcase strip built from the categories'
  vehicles, and tighter vertical rhythm between sections. The strip reuses the
  carousel behaviour.

## Files

New:

- `src/photos/manifest.js`, `src/photos/slots.js`
- `scripts/generate-photos.js`
- `assets/photos/*.webp` (30 files)
- `site/js/motion.js`

Changed:

- `src/seed/assets.js`: use `photoForAsset` when the file exists.
- `site/js/render/common.js`: crop options on `imageTag`.
- `site/js/render/vehicle.js`, `site/js/render/home.js`,
  `site/js/render/sections.js`: `data-reveal` marks, carousel markup, home
  hero and showcase strip.
- `site/styles.css`, `site/app.js`: motion styles and `motion.js` boot.
- `test/`: manifest and slot mapping, image helper options, carousel markup,
  home renderer.
- `README.md`: imagery section describing the manifest and the manual
  generation step.

## Testing and verification

- `npm test` covers the slot mapping (every asset ID maps to a shot or the SVG
  fallback), the image helper's crop parameters, carousel markup without
  inline handlers, and the home renderer.
- `node scripts/setup.js --dry-run`, then `npm run setup --only=assets`, then
  `npm run verify`.
- Headless Chromium screenshots at 1280 and 390 wide of home, `#/750s`,
  `#/f1`, `#/current-models/supercars`, and one story, checked by eye for
  placeholder labels, cropping, and contrast.
- A reduced-motion screenshot of `#/750s` to confirm nothing is hidden.

## Risks and fallbacks

- Figma may refuse or run out of credits part way. The site keeps SVGs for
  any slot without a photo, so a partial run still deploys cleanly.
- A generated car may resemble a real marque. Each image is reviewed by eye
  before conversion, and `--force=<id>` regenerates one shot.
- Thirty WebP files at these sizes should total 6 to 10 MB. If a file exceeds
  600 KB, the script drops quality to 75 for that file.
- `:has()` and scroll-snap are already relied on elsewhere in the site, so no
  new browser support floor is introduced.

## Out of scope

Preview mode, localisation, a real configurator or enquiry form, a second
Contentful environment, and replacing the Open Graph default image.
