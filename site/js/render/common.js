/**
 * Shared helpers for the render modules. Pure functions that return HTML via
 * the escaping `html` tag; nothing here touches `document` or `window`.
 */
import { html, raw, safeUrl } from '../dom.js';
import { isExternalHref, contentTypeOf } from '../router.js';

/** True for a resolved entry or asset (links that did not resolve are null). */
export function isEntry(value) {
  return Boolean(value && typeof value === 'object' && value.fields);
}

/** Filters an array field down to resolved entries. */
export function present(list) {
  return Array.isArray(list) ? list.filter(isEntry) : [];
}

export { contentTypeOf };

/** Orders by `fields.order` when every item has one, else keeps array order. */
export function sortByOrder(list) {
  const items = [...list];
  if (items.length > 1 && items.every((item) => Number.isFinite(item.fields?.order))) {
    items.sort((a, b) => a.fields.order - b.fields.order);
  }
  return items;
}

// safeUrl lives in dom.js so the router can use it too; re-exported for existing imports.
export { safeUrl };

/** Extra anchor attributes for off-site links. */
export function externalAttrs(href) {
  return isExternalHref(href) ? raw(' target="_blank" rel="noopener"') : '';
}

/** `<a>` with an href that is safe and opens off-site links in a new tab. */
export function anchor(href, className, content) {
  const url = safeUrl(href);
  return html`<a${className ? html` class="${className}"` : ''} href="${url}"${externalAttrs(url)}>${content}</a>`;
}

/** Alt text for an asset: its description, else its title, else empty. */
export function altOf(asset) {
  return asset?.fields?.description || asset?.fields?.title || '';
}

function isSvg(asset) {
  return /svg/i.test(asset?.fields?.file?.contentType || '') || /\.svg(\?|$)/i.test(asset?.fields?.file?.url || '');
}

const ASPECTS = { '16:9': [16, 9], '4:3': [4, 3], '3:4': [3, 4], '21:9': [21, 9], '1:1': [1, 1] };
const FOCUSES = new Set(['center', 'top', 'bottom', 'left', 'right', 'faces']);

/** `{ width, height }` for a known `aspect` at width `w`, else null. */
function cropDimensions(aspect, w) {
  const ratio = ASPECTS[aspect];
  const width = Math.round(Number(w));
  if (!ratio || !(width > 0)) return null;
  return { width, height: Math.round((width * ratio[1]) / ratio[0]) };
}

/**
 * Intrinsic `{ width, height }` of an image asset, scaled down to `w`; null when the
 * asset has no usable `details.image` (e.g. an upload that is still processing).
 */
export function imageDimensions(asset, w) {
  const details = asset?.fields?.file?.details?.image;
  const width = Number(details?.width);
  const height = Number(details?.height);
  if (!(width > 0) || !(height > 0)) return null;
  if (w && w < width) return { width: Math.round(w), height: Math.round((height * w) / width) };
  return { width, height };
}

/**
 * Delivery URL for an image asset at width `w` (WebP where the API can convert).
 * With a known `aspect` the image is cropped (`fit=fill`) around `focus`.
 */
export function imageSrc(ctx, asset, w = 1200, { aspect, focus } = {}) {
  const crop = cropDimensions(aspect, w);
  const params = crop
    ? { fit: 'fill', f: FOCUSES.has(focus) ? focus : 'center', w: crop.width, h: crop.height }
    : { w };
  if (!isSvg(asset)) Object.assign(params, { fm: 'webp', q: 80 });
  return ctx.assetUrl(asset, params);
}

/**
 * `<img>` for an asset, or '' when the asset is missing. Lazy by default;
 * pass `eager: true` for the hero image. With `aspect` the width and height
 * attributes are the cropped size; otherwise they come from the asset details
 * and are left off when those are missing.
 */
export function imageTag(ctx, asset, { w = 1200, className = '', eager = false, alt, sizes, aspect, focus } = {}) {
  if (!isEntry(asset)) return '';
  const src = imageSrc(ctx, asset, w, { aspect, focus });
  if (!src) return '';
  const dims = cropDimensions(aspect, w) || imageDimensions(asset, w);
  return html`<img${className ? html` class="${className}"` : ''} src="${src}" alt="${alt ?? altOf(asset)}"${
    dims ? html` width="${dims.width}" height="${dims.height}"` : ''
  }${sizes ? html` sizes="${sizes}"` : ''}${eager ? raw(' fetchpriority="high" decoding="async"') : raw(' loading="lazy" decoding="async"')}>`;
}

/** Rich text field → trusted HTML (the renderer escapes all text). */
export function richText(ctx, document) {
  if (!document) return '';
  const out = String(ctx.renderRichText(document, { assetUrl: ctx.assetUrl, entryHref: ctx.routeFor }) ?? '');
  // an empty document renders to '' (or whitespace): callers test truthiness to skip their wrapper
  return out.trim() ? raw(out) : '';
}

/** Plain `Text` field → paragraphs (blank line) with `<br>` for single newlines. */
export function paragraphs(text, className = '') {
  const value = String(text ?? '').trim();
  if (!value) return '';
  return value.split(/\n{2,}/).map((block) => {
    const lines = block.split('\n').flatMap((line, index) => (index ? [raw('<br>'), line] : [line]));
    return html`<p${className ? html` class="${className}"` : ''}>${lines}</p>`;
  });
}

/** Text with newlines kept as `<br>` (addresses). */
export function lines(text) {
  const value = String(text ?? '').trim();
  if (!value) return '';
  return value.split('\n').flatMap((line, index) => (index ? [raw('<br>'), line] : [line]));
}

/** `2026-02-12` → `12 February 2026`; '' when the date does not parse. */
export function formatDate(value) {
  if (!value) return '';
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/** Normalises a date to `YYYY-MM-DD` for `<time datetime>`; '' when invalid. */
export function isoDate(value) {
  if (!value) return '';
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? `${value}T00:00:00Z` : value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

const STYLE_CLASS = {
  primary: 'btn btn-primary',
  secondary: 'btn btn-secondary',
  text: 'btn btn-text',
};

/** A `link` entry as a button-styled anchor; '' when it did not resolve. */
export function linkButton(ctx, link, fallbackStyle = 'secondary') {
  if (!isEntry(link)) return '';
  const style = STYLE_CLASS[link.fields.style] ? link.fields.style : fallbackStyle;
  return anchor(ctx.linkHref(link), STYLE_CLASS[style], link.fields.label);
}

/** Meta description fallback: seo description, else the given text clipped to 160 chars. */
export function clip(text, max = 160) {
  const value = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).replace(/\s+\S*$/, '')}…`;
}

/** Drops a trailing " | Site name" (or " - ") from a title; setHead appends it again. */
export function stripSiteName(title, siteName) {
  const value = String(title || '');
  if (!siteName) return value;
  for (const separator of [' | ', ' - ', ' – ', ' — ']) {
    if (value.endsWith(`${separator}${siteName}`)) return value.slice(0, -(separator.length + siteName.length));
  }
  return value;
}

/** Applies `seo.title`/`seo.description` with the given fallbacks. */
export function applyHead(ctx, entry, fallback = {}) {
  const seo = entry?.fields?.seo?.fields || {};
  const title = stripSiteName(seo.title, ctx.siteSettings?.fields?.siteName);
  ctx.setHead({
    title: title || fallback.title || '',
    description: seo.description || clip(fallback.description || ''),
  });
}

const THEMES = new Set(['white', 'mist', 'carbon', 'midnight', 'colnbrook']);

/** Theme class for a `theme` field, restricted to known themes. */
export function themeClass(value, fallback = 'white') {
  return `theme-${THEMES.has(value) ? value : fallback}`;
}
