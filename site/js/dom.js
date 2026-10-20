/**
 * Tiny HTML templating helpers with escaping by default.
 *
 * `html` is a tagged template literal. Every interpolated value is escaped
 * unless it is the result of another `html` call or was wrapped in `raw()`.
 * Arrays are flattened and joined with an empty string, so
 * `${items.map((item) => html`<li>${item}</li>`)}` works without `.join('')`.
 * `null`, `undefined` and `false` render as nothing.
 *
 * `html` returns a `SafeHtml` (a `String` subclass). It behaves like a string
 * everywhere that coerces (`innerHTML`, `+`, `.includes()`), but `typeof` is
 * "object": call `String(value)` when a primitive string is required, e.g.
 * for `assert.match`.
 */

const ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Marker type for HTML that is already safe to insert. */
export class SafeHtml extends String {}

/** Escapes a value for safe insertion into HTML text or attribute values. */
export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
}

/** Marks a string as trusted HTML so `html` inserts it without escaping. */
export function raw(value) {
  return new SafeHtml(value === null || value === undefined ? '' : String(value));
}

/** Converts one interpolated value to its HTML string form. */
export function toHtml(value) {
  if (value === null || value === undefined || value === false) return '';
  if (value instanceof SafeHtml) return value.toString();
  if (Array.isArray(value)) return value.map(toHtml).join('');
  return escapeHtml(value);
}

/** Tagged template literal that escapes interpolations. */
export function html(strings, ...values) {
  let out = '';
  for (let i = 0; i < strings.length; i += 1) {
    out += strings[i];
    if (i < values.length) out += toHtml(values[i]);
  }
  return new SafeHtml(out);
}

/** Joins a list of rendered fragments (strings or SafeHtml) into one SafeHtml. */
export function join(fragments, separator = '') {
  return new SafeHtml(fragments.map(toHtml).join(toHtml(separator)));
}

/** Allows only navigable URL schemes (http(s), mailto, tel, hash and path links); anything else becomes `#`. */
export function safeUrl(value) {
  const url = String(value ?? '').trim();
  if (!url) return '#';
  return /^(https?:|mailto:|tel:|#|\/)/i.test(url) ? url : '#';
}

/** Builds an attribute string from an object; falsy values are omitted. */
export function attrs(map) {
  const parts = [];
  for (const [name, value] of Object.entries(map || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (value === true) parts.push(name);
    else parts.push(`${name}="${escapeHtml(value)}"`);
  }
  return new SafeHtml(parts.length ? ` ${parts.join(' ')}` : '');
}
