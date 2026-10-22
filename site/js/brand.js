/**
 * Strada Nova logo: two smooth curves, a road sweeping away, stroked with a
 * subtle papaya gradient. The paths here and in site/brand/strada-nova-mark.svg
 * and site/favicon.svg are the same drawing; replace all of them together
 * when the final logo arrives.
 */
import { escapeHtml, html, raw } from './dom.js';

export const BRAND_NAME = 'Strada Nova';

export const BRAND_CURVES = [
  { d: 'M6 46 C 24 46, 28 16, 58 16', width: 5 },
  { d: 'M22 56 C 36 56, 42 30, 58 30', width: 3 },
];

export const BRAND_GRADIENT = ['#ff7a00', '#ffa64d'];

// Each inline mark needs its own gradient id: a gradient defined inside a
// hidden SVG does not paint marks that reference it from elsewhere.
let sequence = 0;

/**
 * The mark as inline SVG. With a `title` it is an image with that accessible
 * name; without one it is decorative and hidden from assistive technology.
 */
export function brandMark({ className = 'brand-mark', title = '' } = {}) {
  const id = `brand-gradient-${(sequence += 1)}`;
  const label = title ? raw(` role="img" aria-label="${escapeHtml(title)}"`) : raw(' aria-hidden="true" focusable="false"');
  const [from, to] = BRAND_GRADIENT;
  return html`<svg class="${className}" viewBox="0 0 64 64" width="64" height="64"${label}><defs><linearGradient id="${id}" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>${BRAND_CURVES.map(
    (curve) => html`<path d="${curve.d}" fill="none" stroke="url(#${id})" stroke-width="${String(curve.width)}" stroke-linecap="round"/>`,
  )}</svg>`;
}

/** The mark beside the wordmark, in a decorative span; the caller supplies the accessible name. */
export function brandLockup({ className = 'brand-lockup', name = BRAND_NAME } = {}) {
  return html`<span class="${className}">${brandMark()}<span class="brand-lockup__name">${name}</span></span>`;
}
