/**
 * Render registry (STUB). B3 replaces this file with the real templates.
 *
 * Contract
 * --------
 * `registry` maps a view key to a renderer `(data, ctx) => string | SafeHtml`.
 * app.js coerces the result with `String()` and assigns it to `<main>`.
 *
 * View keys and the `data` each receives (all entries are link-resolved):
 *   vehicle          { entry, variants }           variants: vehicles whose parentModel is entry
 *   vehicleCategory  { entry, vehicles }           vehicles in this category ordered by fields.order
 *   page             { entry, siblings, children, latestStories }
 *                                                   siblings: pages sharing entry's parent (when parent set)
 *                                                   children: pages whose parent is entry
 *                                                   latestStories: filled when a storyGrid section has no stories
 *   home             same as page, for the page with slug "home"
 *   story            { entry, latestStories }
 *   retailers        { retailers }                 ordered by country, then city
 *   notFound         { route }                     the matched route { name, params }
 *
 * Section keys (content type IDs) take `(sectionEntry, ctx)` and are called
 * by the page/story templates: textBlock, imageBlock, bannerButton, cardGrid,
 * vehicleGrid, storyGrid, ctaGroup.
 *
 * `ctx` keys:
 *   siteSettings     resolved siteSettings entry or null
 *   categories       all vehicleCategory entries ordered by fields.order
 *   cda              the Delivery API client (for ad-hoc queries; renderers are sync, so prefer loader data)
 *   routeFor(entry)  hash route for a vehicle / vehicleCategory / story / page entry
 *   linkHref(link)   href for a `link` entry (target route or externalUrl)
 *   renderRichText(doc, { assetUrl }) rich text → HTML string
 *   html, raw        escaping template tag and trusted-HTML marker (dom.js)
 *   escapeHtml       string escaper
 *   assetUrl(asset, params) https URL for an asset, params → Images API query (?w=1600&fm=webp&q=80)
 *   renderBreadcrumbs(trail) `[{ label, href }]` → breadcrumb nav
 *   setHead({ title, description }) sets document.title and <meta name="description"> (no-op outside a browser)
 *   route            the matched route { name, params }
 */
import { html, raw } from '../dom.js';
import { renderNotFound } from '../shell.js';

/** JSON.stringify that survives cycles in resolved entries. */
function safeJson(value) {
  const ancestors = [];
  return JSON.stringify(
    value,
    function replacer(key, item) {
      if (!item || typeof item !== 'object') return item;
      // `this` is the parent object; unwind the ancestor stack to it
      while (ancestors.length > 0 && ancestors[ancestors.length - 1] !== this) ancestors.pop();
      if (ancestors.includes(item)) return `[Circular${item.sys?.id ? ` → ${item.sys.id}` : ''}]`;
      ancestors.push(item);
      return item;
    },
    2,
  );
}

function dump(label, data, ctx) {
  const json = safeJson(data);
  const entry = data?.entry;
  const title = entry?.fields?.title || entry?.fields?.name || label;
  ctx?.setHead?.({ title });
  return html`
    <section class="section">
      <div class="container">
        <p class="eyebrow">Stub renderer · ${label}</p>
        <h1>${title}</h1>
        <p class="muted">The template for this view has not landed yet. Raw data:</p>
        <pre class="debug-dump">${json}</pre>
      </div>
    </section>`;
}

const VIEW_KEYS = ['vehicle', 'vehicleCategory', 'page', 'story', 'retailers', 'home'];
const SECTION_KEYS = ['textBlock', 'imageBlock', 'bannerButton', 'cardGrid', 'vehicleGrid', 'storyGrid', 'ctaGroup'];

export const registry = {};
for (const key of [...VIEW_KEYS, ...SECTION_KEYS]) {
  registry[key] = (data, ctx) => dump(key, data, ctx);
}

registry.notFound = (data, ctx) => {
  ctx?.setHead?.({ title: 'Page not found' });
  return html`${raw(renderNotFound(data?.route))}`;
};
