/**
 * personalizedContent: shows the first variant whose audience the visitor
 * belongs to, or the default. The chosen entry renders as usual and is then
 * stamped with data attributes so the preview panel can label it. Pure string
 * building; the active audience keys come from `ctx.audiences`.
 */
import { attrs, raw, SafeHtml } from '../dom.js';
import { contentTypeOf, isEntry } from './common.js';

const ELEMENT_TAG = /<([a-zA-Z][\w:-]*)/;

/** The audience key of a variant, or null when its audience did not resolve or has no key. */
function audienceKeyOf(variant) {
  const audience = variant.fields.audience;
  const key = isEntry(audience) ? audience.fields.key : null;
  return typeof key === 'string' && key ? key : null;
}

/** Why a variant cannot be shown, or '' when it can. */
function variantProblem(variant) {
  if (!isEntry(variant)) return 'does not resolve';
  if (!audienceKeyOf(variant)) return 'has no audience with a key';
  const content = variant.fields.content;
  if (!isEntry(content)) return 'has no resolved content';
  if (contentTypeOf(content) === 'personalizedContent') return 'content is a nested personalizedContent entry';
  return '';
}

/** Why the default cannot be shown, or '' when it can. */
function defaultProblem(fallback) {
  if (!isEntry(fallback)) return 'the default does not resolve';
  if (contentTypeOf(fallback) === 'personalizedContent') return 'the default is a nested personalizedContent entry';
  return '';
}

/**
 * Returns the first variant whose audience key is active, else the default.
 * `variant` is the audience key, or null for the default. Variants are checked
 * in order and the scan stops at the first match, so a broken variant after
 * the match is never reported. Each broken variant before the match is skipped
 * with one `warn` call. The default is only checked when no variant matches.
 */
export function pick(entry, audienceKeys, { warn = console.warn } = {}) {
  const id = entry?.sys?.id;
  const active = new Set(audienceKeys || []);
  const variants = Array.isArray(entry?.fields?.variants) ? entry.fields.variants : [];
  for (let index = 0; index < variants.length; index += 1) {
    const variant = variants[index];
    const problem = variantProblem(variant);
    if (problem) {
      warn(`personalizedContent ${id} variant ${index} skipped: ${problem}`);
      continue;
    }
    const key = audienceKeyOf(variant);
    if (active.has(key)) return { content: variant.fields.content, variant: key };
  }
  const fallback = entry?.fields?.default;
  const problem = defaultProblem(fallback);
  if (problem) {
    warn(`personalizedContent ${id} has no usable default: ${problem}`);
    return { content: null, variant: null };
  }
  return { content: fallback, variant: null };
}

/**
 * Adds data-personalized, data-variant and data-personalized-title to the first
 * opening tag of `markup`. Only safe markup from the `html` tag is accepted, so
 * plain strings and empty markup return ''. Markup with no element tag comes
 * back unchanged.
 */
export function stampPersonalization(markup, entry, variant) {
  if (!(markup instanceof SafeHtml)) return '';
  const text = String(markup);
  if (!text.trim()) return '';
  const match = ELEMENT_TAG.exec(text);
  if (!match) return markup;
  const at = match.index + match[0].length;
  const stamp = attrs({
    'data-personalized': entry.sys.id,
    'data-variant': variant ?? 'default',
    'data-personalized-title': entry.fields.title,
  });
  return raw(`${text.slice(0, at)}${stamp}${text.slice(at)}`);
}

/**
 * Picks the content for the visitor, renders it with `renderContent(content, ctx)`
 * and stamps the result. Returns '' when nothing can be shown.
 */
export function renderPersonalized(entry, ctx, renderContent) {
  const { content, variant } = pick(entry, ctx.audiences, { warn: ctx.warn });
  if (!content) return '';
  return stampPersonalization(renderContent(content, ctx), entry, variant);
}
