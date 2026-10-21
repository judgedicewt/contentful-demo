# Vehicle page performance plan

Branch: `perf/in-place-variant-switch`. Base: `origin/main` at `1057f6d`.

## Goal

Switching between model variants on a vehicle page (for example `#/750s` to
`#/750s-spider`) must update the page in place: no loading spinner, no scroll
reset, no second round trip when the data is already local. Separately, the
initial load should stop waiting on a 4-deep module import waterfall and a
serial shell-then-route data fetch.

Measured baseline on the live site (headless Chromium): initial load makes 36
requests, 27 of them ES modules in an import waterfall, and no Contentful
request starts until the modules finish. A variant switch wipes `<main>`,
shows the spinner, makes two sequential Contentful requests, re-renders, and
scrolls to the top; the h1 updates after about 1.2 s.

## Global constraints

- The front end is a static ES-module app with **no build step and no
  dependencies**. Do not add packages, bundlers, or frameworks.
- Modules under `site/js/` must not touch `document` or `window` at import
  time. They are imported by `node --test`. Only `site/app.js` touches the DOM
  at module level.
- All markup goes through the escaping `html` tagged template from
  `site/js/dom.js`. Use `raw()` only for fixed, literal attribute fragments.
- Tests run with `npm test` (`node --test`), use fixtures under
  `test/fixtures/`, and make no network calls. Follow the existing test style:
  `import { test } from 'node:test'` and `assert/strict`.
- Follow TDD: write the failing test first, run it, then implement.
- Prose (comments, commit messages, README) follows the Google developer
  documentation style: sentence case, active voice, no em dashes, no
  exclamation points.
- Each commit message ends with these two trailer lines, exactly:

  ```
  Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01JQXQdovzw5cRuLFBGKKsZu
  ```

- Do not touch `site/config.js` (generated, git-ignored) or the seed and
  provisioning code under `src/`.
- Exact constants used across tasks:
  - `HERO_WIDTHS = [800, 1200, 1600, 1920]` (exported from
    `site/js/render/common.js`)
  - Hero `sizes` attribute: `100vw`
  - Spinner delay: `250` ms
  - Hero decode cap before an in-place swap: `300` ms
  - View transition duration: `0.25s`
  - Variant menu marker: `data-variant-menu` on the `<details>` element
  - Variant link data attributes: `data-hero-srcset` and `data-hero-src`

## Task 1: Session response cache in the Delivery API client

**Files:** `site/js/cda.js`, `test/cda.test.js`

**Why:** Returning to a variant you already visited, or loading data that a
prefetch already requested, must not make another network request.

**Behavior:**

- `request(path, query)` in `createClient` memoizes by the full request URL
  (including the query string). The cache stores the pending promise, so two
  concurrent identical requests share one fetch.
- A rejected request is removed from the cache so the next call retries.
- The empty payload returned for an unknown content type is cached like any
  other response.
- `resolve()` still runs per call on the cached raw payload, so callers get
  independent object graphs, as today.

**Implementation (replace the body of `request` in `createClient`):**

```js
  const cache = new Map();

  function buildUrl(path, query) {
    const url = new URL(`${base}${path}`);
    url.searchParams.set('access_token', deliveryToken);
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) continue;
      url.searchParams.set(key, String(value));
    }
    return url.toString();
  }

  async function fetchJson(url, query) {
    const response = await fetchImpl(url, { headers: { Accept: 'application/json' } });
    let body = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    if (!response.ok) {
      if (response.status === 400 && isUnknownContentType(body)) {
        const type = query.content_type || '?';
        if (!warned.has(type)) {
          warned.add(type);
          warn(`content type "${type}" does not exist in this space yet; treating as empty`);
        }
        return { sys: { type: 'Array' }, total: 0, skip: 0, limit: 0, items: [], includes: {} };
      }
      const detail = body?.message ? `: ${body.message}` : '';
      const error = new Error(`Contentful ${response.status} ${response.statusText || ''}${detail}`.trim());
      error.status = response.status;
      error.body = body;
      throw error;
    }
    return body;
  }

  /**
   * Fetches a Delivery API path. Responses are cached for the life of the
   * client by full URL, so repeat reads (a revisited variant, a prefetch that
   * already landed) cost no network. A failed request is evicted so it retries.
   */
  function request(path, query = {}) {
    const url = buildUrl(path, query);
    if (cache.has(url)) return cache.get(url);
    const pending = fetchJson(url, query).catch((error) => {
      cache.delete(url);
      throw error;
    });
    cache.set(url, pending);
    return pending;
  }
```

Update the module doc comment at the top of `cda.js` to mention the cache in
one sentence.

**Tests to add to `test/cda.test.js`:**

```js
test('createClient caches responses by URL for the life of the client', async () => {
  let fetches = 0;
  const fakeFetch = async () => {
    fetches += 1;
    return { ok: true, status: 200, json: async () => loadFixture() };
  };
  const client = createClient({ spaceId: 'space', deliveryToken: 'tok' }, { fetch: fakeFetch });
  const [first, second] = await Promise.all([client.getBySlug('vehicle', '750s'), client.getBySlug('vehicle', '750s')]);
  assert.equal(fetches, 1, 'concurrent identical requests share one fetch');
  assert.equal(first.fields.name, second.fields.name);
  assert.notEqual(first, second, 'each call resolves its own object graph');
  await client.getBySlug('vehicle', '750s');
  assert.equal(fetches, 1, 'a repeat read is served from the cache');
  await client.getBySlug('vehicle', '750s-spider');
  assert.equal(fetches, 2, 'a different query is a different cache key');
  await client.getBySlug('vehicle', '750s', 2);
  assert.equal(fetches, 3, 'include depth is part of the key');
});

test('createClient does not cache a failed request', async () => {
  let fetches = 0;
  const fakeFetch = async () => {
    fetches += 1;
    if (fetches === 1) return { ok: false, status: 500, statusText: 'Server Error', json: async () => ({ message: 'boom' }) };
    return { ok: true, status: 200, json: async () => loadFixture() };
  };
  const client = createClient({ spaceId: 'space', deliveryToken: 'tok' }, { fetch: fakeFetch });
  await assert.rejects(() => client.getBySlug('vehicle', '750s'), /Contentful 500/);
  const vehicle = await client.getBySlug('vehicle', '750s');
  assert.equal(vehicle.fields.name, '750S');
  assert.equal(fetches, 2);
});
```

Run `node --test test/cda.test.js` first (both new tests fail: `fetches` is
2 instead of 1), implement, re-run, then run the full `npm test`.

## Task 2: Load the whole vehicle family

**Files:** `site/js/router.js`, `site/js/render/vehicle.js`,
`test/router.test.js`, `test/render.test.js`

**Why:** Today the variants query is keyed on the current vehicle, so a child
variant page (750S Spider) only lists its parent and itself. Keying it on the
root model gives every member of the family the same list, and gives later
tasks the sibling slugs to prefetch.

**Behavior:**

- `router.js` exports `familyRootId(vehicle)`: the `sys.id` of
  `vehicle.fields.parentModel` when that resolved to an entry, else the
  vehicle's own `sys.id`, else `''`.
- In `loadRoute`, case `'page'`, the variants call becomes
  `cda.getVariants(familyRootId(vehicle))`. Keep the returned data shape
  `{ entry, variants }`.
- In `vehicle.js`, `variantItems(entry, variants)` builds the menu from
  `[root, ...present(variants), entry]` deduplicated by `sys.id`, where
  `root` is `entry.fields.parentModel` when it is a resolved entry, else
  `entry`. The current entry is included last as a fallback so a page whose
  variants list is empty still shows itself.

**Code for `vehicle.js`:**

```js
function variantItems(entry, variants) {
  const root = isEntry(entry.fields.parentModel) ? entry.fields.parentModel : entry;
  const seen = new Set();
  const items = [];
  for (const candidate of [root, ...present(variants), entry]) {
    if (!isEntry(candidate) || seen.has(candidate.sys?.id)) continue;
    seen.add(candidate.sys?.id);
    items.push(candidate);
  }
  return items;
}
```

**Tests:**

In `test/router.test.js`, extend the existing test
`loadRoute tries a vehicle before a page and fetches variants` or add a new
test right after it:

```js
test('loadRoute keys the variants query on the family root, so a child variant lists its siblings', async () => {
  const coupe = entry('vehicle', { slug: '750s' }, 'v-750s');
  const spider = entry('vehicle', { slug: '750s-spider', parentModel: coupe }, 'v-750s-spider');
  const cda = fakeCda({ vehicle: { '750s': coupe, '750s-spider': spider }, variants: { 'v-750s': [spider] } });
  const result = await loadRoute(matchRoute('#/750s-spider'), cda);
  assert.equal(result.view, 'vehicle');
  assert.equal(result.data.entry, spider);
  assert.deepEqual(result.data.variants, [spider]);
  assert.deepEqual(cda.calls[1], ['getVariants', 'v-750s']);
});

test('familyRootId is the parent model when present, else the vehicle itself', () => {
  const coupe = entry('vehicle', { slug: '750s' }, 'v-750s');
  const spider = entry('vehicle', { slug: '750s-spider', parentModel: coupe }, 'v-750s-spider');
  assert.equal(familyRootId(coupe), 'v-750s');
  assert.equal(familyRootId(spider), 'v-750s');
  assert.equal(familyRootId(entry('vehicle', { slug: 'x', parentModel: null }, 'v-x')), 'v-x');
  assert.equal(familyRootId(null), '');
});
```

Add `familyRootId` to the import from `../site/js/router.js`.

In `test/render.test.js`, extend the existing test
`vehicle: variant switch lists parent and variants with the current one marked`
with a third case where the child page receives the full family:

```js
  const familyMenu = renderView('vehicle', { entry: vehicles.spider, variants: vehicles.variants }).out.match(/Change model variant[\s\S]*?<\/ul>/)[0];
  assert.equal((familyMenu.match(/<a href=/g) || []).length, 2, 'the current entry is not listed twice');
  assert.ok(familyMenu.indexOf('#/750s"') < familyMenu.indexOf('#/750s-spider"'), 'root first');
  assert.match(familyMenu, /<a href="#\/750s-spider" aria-current="page">750S Spider/);
```

Run the focused test files first (new assertions fail), implement, re-run,
then `npm test`.

## Task 3: Responsive hero image

**Files:** `site/js/render/common.js`, `site/js/render/vehicle.js`,
`test/render.test.js`

**Why:** The vehicle hero always requests a 1920 px image. A `srcset` lets
phones download the 800 px candidate.

**Behavior:**

- `common.js` exports `HERO_WIDTHS = [800, 1200, 1600, 1920]`.
- `common.js` exports `imageSrcset(ctx, asset, widths, { aspect, focus } = {})`
  returning `"<url> 800w, <url> 1200w, ..."` built with `imageSrc` for each
  width. For an SVG asset it returns `''` (the Images API does not resize SVG).
- `imageTag` accepts a `widths` option. When `widths` is a non-empty array and
  the asset is not SVG, it emits `srcset="..."` and `sizes="..."`, where
  `sizes` defaults to `100vw` if the caller did not pass one. `src`, `width`,
  and `height` keep coming from `w` as today. Without `widths`, output is
  unchanged.
- `vehicle.js` `hero()` passes `widths: HERO_WIDTHS, sizes: '100vw'` for the
  hero image. Everything else about the hero stays the same (`w: 1920`,
  `eager: true`, `alt: ''`).

**Code for `common.js`:**

```js
/** Widths offered in the vehicle hero `srcset`. */
export const HERO_WIDTHS = [800, 1200, 1600, 1920];

/** `srcset` value for `widths`, each candidate at the same crop and focus; '' for SVG. */
export function imageSrcset(ctx, asset, widths, { aspect, focus } = {}) {
  if (!isEntry(asset) || isSvg(asset) || !Array.isArray(widths) || !widths.length) return '';
  return widths.map((w) => `${imageSrc(ctx, asset, w, { aspect, focus })} ${w}w`).join(', ');
}
```

In `imageTag`, destructure `widths` from the options and compute
`const srcset = imageSrcset(ctx, asset, widths, { aspect, focus });` then emit
`${srcset ? html` srcset="${srcset}" sizes="${sizes || '100vw'}"` : ''}` in
place of the current `sizes` fragment, keeping the plain `sizes` fragment for
the case where `sizes` is given without `widths`.

**Tests to add to `test/render.test.js`:**

```js
test('vehicle: hero image offers a srcset of HERO_WIDTHS at 100vw', () => {
  const { out } = renderView('vehicle', { entry: vehicles.full, variants: [] });
  const heroImg = out.match(/<img[^>]*hero__image[^>]*>/)[0];
  assert.match(heroImg, /srcset="[^"]*w=800&amp;[^"]* 800w, [^"]*w=1200&amp;[^"]* 1200w, [^"]*w=1600&amp;[^"]* 1600w, [^"]*w=1920&amp;[^"]* 1920w"/);
  assert.match(heroImg, /sizes="100vw"/);
  assert.match(heroImg, /src="[^"]*w=1920/);
});

test('imageSrcset skips SVG assets and imageTag then emits no srcset', () => {
  const { ctx } = makeCtx();
  const svg = { sys: { id: 'a' }, fields: { title: 'x', file: { url: 'https://images.ctfassets.net/s/a/b/c.svg', contentType: 'image/svg+xml' } } };
  assert.equal(imageSrcset(ctx, svg, HERO_WIDTHS), '');
  assert.doesNotMatch(String(imageTag(ctx, svg, { widths: HERO_WIDTHS })), /srcset=/);
  const jpg = vehicles.full.fields.heroImage;
  assert.equal(imageSrcset(ctx, jpg, [800, 1600]).split(', ').length, 2);
  assert.match(String(imageTag(ctx, jpg, { w: 1200, widths: [800, 1200], sizes: '50vw' })), /sizes="50vw"/);
});
```

Add `imageSrcset` and `HERO_WIDTHS` to the import from
`../site/js/render/common.js`. The existing hero test asserting `w=1920` and
`width="1600" height="900"` must keep passing. The `&amp;` in the regex is
how the escaping template renders `&` inside attributes; check the existing
hero output if the exact ordering of query parameters differs and adjust the
regex to match the real order (`w=...&fm=webp&q=80`).

## Task 4: Prefetch sibling variants

**Files:** new `site/js/prefetch.js`, `site/js/render/vehicle.js`,
`site/app.js`, new `test/prefetch.test.js`, `test/render.test.js`

**Why:** By the time a visitor opens the variant menu and clicks, the sibling's
data should already be in the client cache (Task 1) and its hero image in the
browser cache.

**Behavior:**

`site/js/prefetch.js` (no DOM access at import time):

```js
/**
 * Prefetching for vehicle families. After a vehicle page renders, the other
 * members of its family are fetched at idle so a variant switch is served
 * from the client cache. Opening the variant menu warms the hero images
 * listed on its links.
 */
import { familyRootId } from './router.js';

/** Slugs of the other vehicles in the family of `data.entry`, root first, in menu order. */
export function siblingSlugs(data) {
  const entry = data?.entry;
  if (!entry?.fields) return [];
  const root = entry.fields.parentModel?.fields ? entry.fields.parentModel : entry;
  const seen = new Set([entry.sys?.id]);
  const slugs = [];
  for (const candidate of [root, ...(Array.isArray(data.variants) ? data.variants : [])]) {
    const id = candidate?.sys?.id;
    const slug = candidate?.fields?.slug;
    if (!id || !slug || seen.has(id)) continue;
    seen.add(id);
    slugs.push(String(slug));
  }
  return slugs;
}

function idleSchedule(fn) {
  const ric = globalThis.requestIdleCallback;
  if (typeof ric === 'function') {
    const id = ric(fn, { timeout: 2000 });
    return () => globalThis.cancelIdleCallback?.(id);
  }
  const id = setTimeout(fn, 200);
  return () => clearTimeout(id);
}

/**
 * Schedules a fetch of every sibling's full entry (include depth 4, matching
 * the route loader). Returns a cancel function. Failures are ignored: the
 * route loader will fetch again on demand.
 */
export function prefetchFamily(cda, data, { schedule = idleSchedule } = {}) {
  const slugs = siblingSlugs(data);
  if (!slugs.length) return () => {};
  return schedule(() => {
    for (const slug of slugs) {
      Promise.resolve()
        .then(() => cda.getBySlug('vehicle', slug, 4))
        .catch(() => {});
    }
  });
}

/** Starts loading the hero images named on a variant menu's links (not the current one). */
export function warmHeroImages(menu, { createImage = () => new Image() } = {}) {
  const links = menu?.querySelectorAll?.('a[data-hero-srcset], a[data-hero-src]') || [];
  for (const link of links) {
    if (link.hasAttribute('aria-current')) continue;
    const img = createImage();
    img.sizes = '100vw';
    if (link.dataset.heroSrcset) img.srcset = link.dataset.heroSrcset;
    if (link.dataset.heroSrc) img.src = link.dataset.heroSrc;
  }
}
```

`vehicle.js` `subNav()`: the variant `<details>` gains `data-variant-menu`.
Each variant link that is not current and whose `heroImage` resolved gains
`data-hero-srcset="${imageSrcset(ctx, item.fields.heroImage, HERO_WIDTHS)}"`
and `data-hero-src="${imageSrc(ctx, item.fields.heroImage, 1920)}"`. Import
`imageSrcset`, `imageSrc`, and `HERO_WIDTHS` from `./common.js`. Use
`attrs()` from `../dom.js` or inline `html` fragments; either way the values
go through escaping.

`site/app.js`:

- Import `{ prefetchFamily, warmHeroImages } from './js/prefetch.js'`.
- Add `cancelPrefetch: () => {}` to `state`.
- In `handleRoute`, after the renderer output is shown: call
  `state.cancelPrefetch()`, then
  `state.cancelPrefetch = view === 'vehicle' ? prefetchFamily(cda, data) : () => {};`
- In `bindShell`, add a capture-phase `toggle` listener on `document`
  (`toggle` does not bubble): when `event.target` matches
  `details[data-variant-menu]` and is open, call `warmHeroImages(event.target)`.

**Tests, `test/prefetch.test.js`:**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { siblingSlugs, prefetchFamily, warmHeroImages } from '../site/js/prefetch.js';

const vehicles = JSON.parse(readFileSync(new URL('./fixtures/render-vehicle.json', import.meta.url), 'utf8'));

test('siblingSlugs lists the rest of the family, root first, without the current entry', () => {
  assert.deepEqual(siblingSlugs({ entry: vehicles.full, variants: vehicles.variants }), ['750s-spider']);
  assert.deepEqual(siblingSlugs({ entry: vehicles.spider, variants: vehicles.variants }), ['750s']);
  assert.deepEqual(siblingSlugs({ entry: vehicles.spider, variants: [] }), ['750s']);
  assert.deepEqual(siblingSlugs({ entry: vehicles.legacy, variants: [] }), []);
  assert.deepEqual(siblingSlugs(null), []);
});

test('prefetchFamily fetches each sibling at include depth 4 through the scheduler and can be cancelled', async () => {
  const calls = [];
  const cda = { getBySlug: async (...args) => { calls.push(args); return null; } };
  let run;
  const cancelled = [];
  const schedule = (fn) => { run = fn; return () => cancelled.push(true); };
  const cancel = prefetchFamily(cda, { entry: vehicles.spider, variants: vehicles.variants }, { schedule });
  assert.deepEqual(calls, [], 'nothing fetched before the scheduler fires');
  run();
  await Promise.resolve();
  assert.deepEqual(calls, [['vehicle', '750s', 4]]);
  cancel();
  assert.equal(cancelled.length, 1);
  assert.equal(typeof prefetchFamily(cda, { entry: vehicles.legacy, variants: [] }, { schedule }), 'function', 'no siblings still returns a cancel');
});

test('prefetchFamily swallows fetch failures', async () => {
  const cda = { getBySlug: async () => { throw new Error('offline'); } };
  let run;
  prefetchFamily(cda, { entry: vehicles.full, variants: vehicles.variants }, { schedule: (fn) => { run = fn; return () => {}; } });
  run();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.ok(true, 'no unhandled rejection');
});

test('warmHeroImages creates one image per non-current link with srcset, sizes and src', () => {
  const link = (attrs, current = false) => ({
    hasAttribute: (name) => name === 'aria-current' && current,
    dataset: attrs,
  });
  const menu = { querySelectorAll: () => [link({ heroSrcset: 'a 800w, b 1920w', heroSrc: 'b' }), link({ heroSrcset: 'x 800w', heroSrc: 'x' }, true)] };
  const images = [];
  warmHeroImages(menu, { createImage: () => { const img = {}; images.push(img); return img; } });
  assert.deepEqual(images, [{ sizes: '100vw', srcset: 'a 800w, b 1920w', src: 'b' }]);
  assert.doesNotThrow(() => warmHeroImages(null));
});
```

In `test/render.test.js`, extend the variant-menu test: the parent view's menu
has `data-variant-menu` on the `<details>`, the `750s-spider` link carries
`data-hero-srcset` containing ` 800w` and `data-hero-src` containing `w=1920`,
and the current link (`#/750s`) carries neither attribute.

## Task 5: In-place variant switch and delayed spinner

**Files:** `site/app.js`, new `site/js/swap.js`, `site/styles.css`,
new `test/swap.test.js`

**Why:** This is the user-visible change. A switch within a vehicle family
must not show the spinner, must keep the scroll position, and should crossfade
the hero and title when the browser supports view transitions.

**Behavior, `site/js/swap.js`** (pure, importable in Node):

```js
/**
 * Decides when a route change can update the page in place instead of
 * replacing it. Pure so it can be tested in Node; the DOM work lives in app.js.
 */
import { familyRootId } from './router.js';

/** Milliseconds the loading indicator waits before it appears. Fast loads never show it. */
export const SPINNER_DELAY_MS = 250;

/** Upper bound on waiting for the next hero image to decode before an in-place swap. */
export const HERO_DECODE_CAP_MS = 300;

/** True when both views are vehicles in the same family (parent and its variants). */
export function isFamilySwitch(current, next) {
  if (current?.view !== 'vehicle' || next?.view !== 'vehicle') return false;
  const from = familyRootId(current.data?.entry);
  const to = familyRootId(next.data?.entry);
  return Boolean(from) && from === to;
}
```

**Behavior, `site/app.js`:**

- Import `isFamilySwitch`, `SPINNER_DELAY_MS`, `HERO_DECODE_CAP_MS` from
  `./js/swap.js`.
- Add `current: null` to `state` (the last shown `{ view, data }`).
- `handleRoute(route, cda)`:
  1. Bump `requestId` as today.
  2. Instead of showing the spinner immediately, start a timer:
     `const spinner = setTimeout(() => { if (isCurrent()) showMain(renderLoading()); }, SPINNER_DELAY_MS);`
     Clear it in both the success and the error path (`finally` is fine).
  3. After `loadRoute` resolves and the redirect check passes, compute
     `const inPlace = isFamilySwitch(state.current, { view, data });`
  4. Render `const content = renderer(data, buildContext(cda, route));`
  5. If `inPlace`: `await swapInPlace(content)`, then re-check `isCurrent()`
     and return if stale. Do not scroll and do not reset focus beyond
     `mounts.main.focus({ preventScroll: true })`.
     Else: `showMain(content, { motion: true })`, then the existing scroll to
     top and focus.
  6. Set `state.current = { view, data }` after a successful show. Set it to
     `null` in the error path.
  7. The Task 4 prefetch call stays where it is (after the content is shown).
- New helpers in `app.js`:

```js
function prefersReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** Resolves once the hero image in `markup` has decoded, or after HERO_DECODE_CAP_MS. */
function waitForHero(markup) {
  const template = document.createElement('template');
  template.innerHTML = markup;
  const hero = template.content.querySelector('.hero__image');
  if (!hero) return Promise.resolve();
  const img = new Image();
  if (hero.getAttribute('sizes')) img.sizes = hero.getAttribute('sizes');
  if (hero.getAttribute('srcset')) img.srcset = hero.getAttribute('srcset');
  img.src = hero.getAttribute('src');
  const decoded = img.decode().catch(() => {});
  const capped = new Promise((resolve) => setTimeout(resolve, HERO_DECODE_CAP_MS));
  return Promise.race([decoded, capped]);
}

/** Replaces the main content without a loading state, crossfading when the browser can. */
async function swapInPlace(content) {
  const markup = String(content);
  await waitForHero(markup);
  const apply = () => showMain(markup, { motion: true });
  if (typeof document.startViewTransition === 'function' && !prefersReducedMotion()) {
    await document.startViewTransition(apply).updateCallbackDone;
  } else {
    apply();
  }
}
```

- Update the module doc comment of `app.js` to mention the in-place family
  switch and the delayed spinner.

**Behavior, `site/styles.css`:** add, near the motion section (the
`@media (prefers-reduced-motion: no-preference)` block around line 1090):

```css
/* View transitions: a variant switch crossfades the hero and title in place.
   Header and footer keep their own names so they do not fade at all. */
::view-transition-old(root),
::view-transition-new(root) {
  animation-duration: 0.25s;
}

.site-header {
  view-transition-name: site-header;
}

.site-footer {
  view-transition-name: site-footer;
}

.hero--vehicle .hero__image {
  view-transition-name: vehicle-hero;
}

.hero--vehicle .hero__title {
  view-transition-name: vehicle-title;
}

@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(*),
  ::view-transition-old(*),
  ::view-transition-new(*) {
    animation: none !important;
  }
}
```

**Tests, `test/swap.test.js`:**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isFamilySwitch, SPINNER_DELAY_MS, HERO_DECODE_CAP_MS } from '../site/js/swap.js';

const vehicles = JSON.parse(readFileSync(new URL('./fixtures/render-vehicle.json', import.meta.url), 'utf8'));
const view = (view, entry) => ({ view, data: { entry, variants: [] } });

test('isFamilySwitch is true between a parent and its variant, in both directions', () => {
  assert.equal(isFamilySwitch(view('vehicle', vehicles.full), view('vehicle', vehicles.spider)), true);
  assert.equal(isFamilySwitch(view('vehicle', vehicles.spider), view('vehicle', vehicles.full)), true);
  assert.equal(isFamilySwitch(view('vehicle', vehicles.spider), view('vehicle', vehicles.spider)), true);
});

test('isFamilySwitch is false across families, across views, and without a current view', () => {
  assert.equal(isFamilySwitch(view('vehicle', vehicles.full), view('vehicle', vehicles.legacy)), false);
  assert.equal(isFamilySwitch(view('page', vehicles.full), view('vehicle', vehicles.spider)), false);
  assert.equal(isFamilySwitch(view('vehicle', vehicles.full), view('page', vehicles.spider)), false);
  assert.equal(isFamilySwitch(null, view('vehicle', vehicles.spider)), false);
  assert.equal(isFamilySwitch(view('vehicle', { sys: {}, fields: {} }), view('vehicle', { sys: {}, fields: {} })), false, 'no id is never a match');
});

test('timing constants', () => {
  assert.equal(SPINNER_DELAY_MS, 250);
  assert.equal(HERO_DECODE_CAP_MS, 300);
});
```

Also add a test in `test/render.test.js` or a new small test that reads
`site/styles.css` and asserts it contains `view-transition-name: vehicle-hero`
and `view-transition-name: vehicle-title`.

`app.js` cannot be unit tested (it touches `document`). Verify it by running
`npm run dev` is not possible without a Contentful token in this environment,
so instead read your diff carefully against the behavior list above and report
any doubt as DONE_WITH_CONCERNS. The controller runs a browser check after
review.

## Task 6: Module preload and preconnect hints

**Files:** `site/index.html`, new `test/preload.test.js`

**Why:** The 28 ES modules load in a 4-deep import waterfall. Declaring them
up front lets the browser fetch them in parallel, and preconnecting to the
Contentful hosts removes a DNS and TLS round trip from the first data fetch.

**Behavior:**

In `<head>` of `site/index.html`, after the stylesheet link, add:

```html
  <link rel="preconnect" href="https://cdn.contentful.com">
  <link rel="preconnect" href="https://images.ctfassets.net">
```

followed by one `<link rel="modulepreload" href="...">` per JavaScript module
under `site/`, with the href relative to `site/` (for example `app.js`,
`js/cda.js`, `js/render/vehicle.js`). Exclude `config.js` and
`config.example.js`. Sort the list alphabetically by href. Generate the list
with:

```sh
cd site && find . -name '*.js' ! -name 'config*.js' | sed 's|^\./||' | sort
```

Do not change the `<script>` tags at the end of `<body>`.

**Test, `test/preload.test.js`:**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const site = join(here, '..', 'site');

function modulesUnder(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...modulesUnder(path));
    else if (name.endsWith('.js') && !/^config.*\.js$/.test(name)) out.push(relative(site, path).split('\\').join('/'));
  }
  return out.sort();
}

test('index.html preloads every module under site/ and nothing else', () => {
  const html = readFileSync(join(site, 'index.html'), 'utf8');
  const preloaded = [...html.matchAll(/<link rel="modulepreload" href="([^"]+)">/g)].map((m) => m[1]).sort();
  assert.deepEqual(preloaded, modulesUnder(site));
  assert.doesNotMatch(html, /modulepreload" href="config/);
});

test('index.html preconnects to the Contentful API and image hosts', () => {
  const html = readFileSync(join(site, 'index.html'), 'utf8');
  assert.match(html, /<link rel="preconnect" href="https:\/\/cdn\.contentful\.com">/);
  assert.match(html, /<link rel="preconnect" href="https:\/\/images\.ctfassets\.net">/);
});
```

Run the test first (fails: no preloads), edit `index.html`, re-run, then
`npm test`.

## Task 7: Start the route load during boot, and document the behavior

**Files:** `site/app.js`, `README.md`

**Why:** `boot()` awaits the site settings and categories before it even
starts loading the route's data. Starting both at once removes one full
round trip from the first paint of content.

**Behavior, `site/app.js`:**

- `handleRoute(route, cda, preloaded)` accepts an optional third argument: a
  promise from `loadRoute`. When present, await it instead of calling
  `loadRoute(route, cda)`. The `dispatch` helper in `boot` keeps passing only
  two arguments for hash changes.
- In `boot()`, right after `const cda = createClient(config);` and
  `bindShell();`, compute the initial route and start its load:

```js
  const matched = matchRoute(window.location.hash || '#/');
  const initial = matched.name === 'ignore' ? matchRoute('#/') : matched;
  const preloaded = loadRoute(initial, cda);
  // handleRoute awaits this later; mark it handled so an early failure is not reported as unhandled.
  preloaded.catch(() => {});
```

  Then the existing `Promise.allSettled([cda.getSiteSettings(), cda.getCategories()])`,
  `renderShell()`, `onRouteChange(dispatch)`, and finally
  `handleRoute(initial, cda, preloaded)`.

- Remove the now-duplicate `matchRoute` lines at the end of `boot`.

**Behavior, `README.md`:** in the "Front end" section, after the paragraph
that starts "`site/js/cda.js` wraps the Delivery API", add one short
paragraph:

> The client caches every Delivery API response for the life of the page, and
> a vehicle page prefetches the other variants in its family at idle. Switching
> between variants then updates the page in place: no loading state, the
> scroll position is kept, and browsers that support view transitions
> crossfade the hero. Module preload hints in `site/index.html` let the browser
> fetch all ES modules in parallel; `test/preload.test.js` fails if a module
> is added without one.

Keep the existing route table and the rest of the section unchanged.

`app.js` has no unit tests. Read the diff against the behavior list, run
`npm test` to confirm nothing else broke, and report.
