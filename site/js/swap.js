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
