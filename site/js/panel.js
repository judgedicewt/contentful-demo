/**
 * The personalization demo panel. It shows what the site knows about the
 * visitor, which audiences matched, and controls that force audiences or a
 * region so a presenter can show each variant without changing browsers.
 *
 * Rendering is DOM-free string building through the `html` tag. `initPanel` is
 * the only function that touches a DOM, and only when `app.js` calls it. This
 * module reads no DOM or storage at import time, and every storage access is
 * guarded, so a blocked store leaves the panel closed and the site working.
 *
 * Markup contract for `renderPanel`: the root is `aside.demo-panel`. Read-only
 * values carry `data-panel-visits`, `data-panel-campaign`, `data-panel-region`,
 * `data-panel-categories`, `data-panel-vehicles` and `data-panel-matched`.
 * Controls carry `data-control` set to `force-audience` (with `data-key`),
 * `region`, `clear-overrides`, `reset-profile` or `close`.
 */
import { html, raw, join } from './dom.js';
import { readQueryParam, effectiveRegion } from './signals.js';

/** The sessionStorage key that holds '1' while the panel is open. */
export const PANEL_KEY = 'mcl.panel';

const SHORTCUT_PRESSES = 3;
const SHORTCUT_WINDOW_MS = 2000;
const OPEN_CLASS = 'demo-open';
const EDITABLE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/** True when `?demo=1` is in the real query string or in the query string after the hash route. */
export function wantsPanel(location) {
  return readQueryParam(location, 'demo') === '1';
}

/** True for a Shift+D press that is not auto-repeated, not combined with another modifier and not in an editable target. */
function isShortcutPress(event) {
  if (!event || typeof event.key !== 'string' || event.key.toLowerCase() !== 'd') return false;
  if (!event.shiftKey || event.ctrlKey || event.metaKey || event.altKey || event.repeat) return false;
  const target = event.target;
  if (target && (EDITABLE_TAGS.has(target.tagName) || target.isContentEditable === true)) return false;
  return true;
}

/**
 * Returns a keydown handler. Calls `onTrigger` when Shift+D is pressed three
 * times, the third at most 2000 ms after the first of the three. The count
 * starts over after each trigger.
 */
export function createShortcut({ onTrigger, now = Date.now }) {
  let presses = [];
  return (event) => {
    if (!isShortcutPress(event)) return;
    presses.push(now());
    if (presses.length > SHORTCUT_PRESSES) presses.shift();
    if (presses.length === SHORTCUT_PRESSES && presses[presses.length - 1] - presses[0] <= SHORTCUT_WINDOW_MS) {
      presses = [];
      onTrigger();
    }
  };
}

const fieldsOf = (audience) => (audience && typeof audience.fields === 'object' && audience.fields !== null ? audience.fields : {});

function list(attribute, items) {
  const body = items.length
    ? items.map((item) => html`<li>${item}</li>`)
    : [html`<li class="demo-panel__empty">None</li>`];
  return html`<ul class="demo-panel__list" ${raw(attribute)}>${join(body)}</ul>`;
}

/** The matched audiences as `Name (source)` in audience order, then forced keys with no entry as `key (forced)`. */
function matchedLabels(audiences, matched) {
  const known = new Set();
  const labels = [];
  for (const audience of audiences) {
    const { key, name, source } = fieldsOf(audience);
    if (typeof key !== 'string') continue;
    known.add(key);
    if (matched.has(key)) labels.push(`${name || key} (${source || 'local'})`);
  }
  for (const key of matched) {
    if (!known.has(key)) labels.push(`${key} (forced)`);
  }
  return labels;
}

function forceControls(audiences, forced) {
  const rows = [];
  for (const audience of audiences) {
    const { key, name } = fieldsOf(audience);
    if (typeof key !== 'string') continue;
    const checked = forced.includes(key) ? raw(' checked') : '';
    rows.push(html`<label class="demo-panel__check"><input type="checkbox" data-control="force-audience" data-key="${key}"${checked}> ${name || key}</label>`);
  }
  return html`<fieldset class="demo-panel__group"><legend>Force audiences</legend>${join(rows)}</fieldset>`;
}

/** Markup for the panel, or '' when closed. `audiences` are resolved audience entries and `matched` is a Set of keys. */
export function renderPanel({ open, profile, audiences = [], matched = new Set(), unavailable = false }) {
  if (!open) return '';
  const current = profile || {};
  const overrides = current.overrides || {};
  const forced = Array.isArray(overrides.audiences) ? overrides.audiences : [];
  const viewed = current.viewed || {};
  const categories = Object.entries(viewed.categories || {}).map(([slug, count]) => `${slug}: ${count}`);
  const vehicles = Array.isArray(viewed.vehicles) ? viewed.vehicles : [];
  const force = unavailable
    ? html`<p class="demo-panel__note">Audiences unavailable. Every page shows its default content.</p>`
    : forceControls(audiences, forced);
  return html`<aside class="demo-panel" aria-label="Personalization demo">
  <header class="demo-panel__header">
    <h2 class="demo-panel__title">Personalization demo</h2>
    <button type="button" class="demo-panel__button" data-control="close" aria-label="Close the demo panel">Close</button>
  </header>
  <dl class="demo-panel__facts">
    <dt>Visits</dt><dd data-panel-visits>${current.visits ?? 0}</dd>
    <dt>Campaign</dt><dd data-panel-campaign>${current.campaign || 'none'}</dd>
    <dt>Region</dt><dd data-panel-region>${effectiveRegion(current) || 'none'}</dd>
  </dl>
  <h3 class="demo-panel__heading">Viewed categories</h3>
  ${list('data-panel-categories', categories)}
  <h3 class="demo-panel__heading">Viewed vehicles</h3>
  ${list('data-panel-vehicles', vehicles)}
  <h3 class="demo-panel__heading">Matched audiences</h3>
  ${list('data-panel-matched', matchedLabels(audiences, matched))}
  ${force}
  <label class="demo-panel__field">Region override
    <input data-control="region" name="region" maxlength="2" value="${overrides.region ?? ''}" placeholder="GB" autocomplete="off">
  </label>
  <div class="demo-panel__actions">
    <button type="button" class="demo-panel__button" data-control="clear-overrides">Clear overrides</button>
    <button type="button" class="demo-panel__button" data-control="reset-profile">Reset profile</button>
  </div>
</aside>`;
}

/**
 * Applies one control change through `signals` ({ load, setOverrides, reset }).
 * control: { action: 'force-audience', key, checked } | { action: 'region', value }
 * | { action: 'clear-overrides' } | { action: 'reset-profile' }.
 * `audienceKeys` fixes the order of the forced set. `close` is handled by `initPanel`.
 */
export function applyControl(control, { signals, audienceKeys }) {
  switch (control.action) {
    case 'force-audience': {
      const forced = new Set(signals.load().overrides?.audiences || []);
      if (control.checked) forced.add(control.key);
      else forced.delete(control.key);
      const ordered = audienceKeys.filter((key) => forced.has(key));
      signals.setOverrides({ audiences: ordered.length ? ordered : null });
      break;
    }
    case 'region': {
      const value = String(control.value ?? '').trim();
      signals.setOverrides({ region: value || null });
      break;
    }
    case 'clear-overrides':
      signals.setOverrides({ audiences: null, region: null });
      break;
    case 'reset-profile':
      signals.reset();
      break;
    default:
  }
}

function readStored(storage) {
  try {
    return storage().getItem(PANEL_KEY) === '1';
  } catch {
    return false;
  }
}

function writeStored(storage, open) {
  try {
    if (open) storage().setItem(PANEL_KEY, '1');
    else storage().removeItem(PANEL_KEY);
  } catch {
    // A blocked store leaves the open state in memory only.
  }
}

/** The control a change event describes, or null when the target is not a panel control. */
function controlFromChange(target) {
  if (!target || typeof target.matches !== 'function') return null;
  if (target.matches('input[data-control="force-audience"]')) {
    return { action: 'force-audience', key: target.getAttribute('data-key'), checked: target.checked };
  }
  if (target.matches('input[data-control="region"]')) return { action: 'region', value: target.value };
  return null;
}

/**
 * Mounts the panel into `mount`. `storage` returns a Storage (it may throw),
 * `signals` is { load, setOverrides, reset }, `getModel` returns
 * { profile, audiences, matched, unavailable } and `rerender` redraws the
 * current page and returns a promise. Listeners go on `mount` and
 * `keydownTarget`. Returns { refresh, destroy }.
 */
export function initPanel({ mount, location, storage, keydownTarget, signals, getModel, rerender }) {
  const body = mount.ownerDocument.body;
  let open = wantsPanel(location) || readStored(storage);

  function refresh() {
    mount.innerHTML = String(renderPanel({ open, ...getModel() }));
  }

  function setOpen(next) {
    open = next;
    writeStored(storage, open);
    body.classList.toggle(OPEN_CLASS, open);
    refresh();
  }

  async function apply(control) {
    applyControl(control, { signals, audienceKeys: getModel().audiences.map((a) => fieldsOf(a).key).filter((k) => typeof k === 'string') });
    // Keep keyboard focus on the checkbox or button after the panel redraws.
    const active = mount.ownerDocument.activeElement;
    const keep = active && mount.contains(active) && control.action !== 'region' ? active : null;
    // Without CSS.escape the key cannot be quoted safely, so the focus restore is skipped.
    const canEscape = typeof globalThis.CSS?.escape === 'function';
    const selector = keep && canEscape
      ? `[data-control="${keep.getAttribute('data-control')}"]${keep.hasAttribute('data-key') ? `[data-key="${globalThis.CSS.escape(keep.getAttribute('data-key'))}"]` : ''}`
      : null;
    try {
      await rerender();
      refresh();
      if (selector) mount.querySelector(selector)?.focus();
    } catch (error) {
      console.error(error);
    }
  }

  const onClick = (event) => {
    const button = event.target?.closest?.('button[data-control]');
    if (!button || !mount.contains(button)) return;
    const action = button.getAttribute('data-control');
    if (action === 'close') setOpen(false);
    else if (action === 'clear-overrides' || action === 'reset-profile') apply({ action });
  };
  const onChange = (event) => {
    const control = controlFromChange(event.target);
    if (control) apply(control);
  };
  const onKeydown = createShortcut({ onTrigger: () => setOpen(!open) });

  mount.addEventListener('click', onClick);
  mount.addEventListener('change', onChange);
  keydownTarget.addEventListener('keydown', onKeydown);

  if (open) writeStored(storage, true);
  body.classList.toggle(OPEN_CLASS, open);
  refresh();

  return {
    refresh,
    destroy() {
      mount.removeEventListener('click', onClick);
      mount.removeEventListener('change', onChange);
      keydownTarget.removeEventListener('keydown', onKeydown);
      body.classList.remove(OPEN_CLASS);
    },
  };
}
