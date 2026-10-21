/**
 * Enquiry form behaviour: client-side validation, then a JSON POST to the
 * endpoint named on the form (a Fusion webhook that raises a Workfront request).
 *
 * This module never touches `window` or `document` at import time, so it loads
 * under `node --test`. `initEnquiry` takes the element to enhance and returns a
 * teardown; `validate` and `buildPayload` are pure and exported for tests.
 *
 * Markup contract (see `render/enquire.js`): `form[data-enquiry-form]` with
 * `data-endpoint` and `data-error-body`; inputs read by `name`; a
 * `#<name>-error` paragraph per field; `button[type="submit"]`;
 * `[data-enquiry-status]`; and `[data-enquiry-success]` holding an `h2`.
 */

const FIELDS = ['name', 'email', 'phone', 'country', 'model', 'message', 'consent'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_MESSAGE = 2000;
const SOURCE = 'contentful-demo';

/** Checks a submission. Returns `{ ok, errors }`, with one message per failing field. */
export function validate(values) {
  const errors = {};
  if (!String(values.name ?? '').trim()) errors.name = 'Enter your name.';
  if (!EMAIL.test(String(values.email ?? '').trim())) errors.email = 'Enter a valid email address.';
  if (!String(values.country ?? '').trim()) errors.country = 'Enter your country.';
  if (!String(values.model ?? '').trim()) errors.model = 'Choose a model.';
  if (values.consent !== true) errors.consent = 'Tick the consent box to continue.';
  if (String(values.message ?? '').length > MAX_MESSAGE) errors.message = 'Keep your message under 2000 characters.';
  return { ok: Object.keys(errors).length === 0, errors };
}

/** Builds the JSON body for the webhook. `model` is the display name, falling back to the slug. */
export function buildPayload(values, { vehicles = [], pageUrl = '', now = new Date() } = {}) {
  const trim = (value) => String(value ?? '').trim();
  const modelSlug = trim(values.model);
  const match = vehicles.find((v) => v?.fields?.slug === modelSlug);
  return {
    name: trim(values.name),
    email: trim(values.email),
    phone: trim(values.phone),
    country: trim(values.country),
    model: match?.fields?.name || modelSlug,
    modelSlug,
    message: trim(values.message),
    consent: true,
    source: SOURCE,
    pageUrl,
    submittedAt: now.toISOString(),
  };
}

const NOOP = () => {};

function readValues(form) {
  const read = (name) => form.elements?.[name]?.value ?? '';
  return {
    name: read('name'),
    email: read('email'),
    phone: read('phone'),
    country: read('country'),
    model: read('model'),
    message: read('message'),
    consent: form.elements?.consent?.checked === true,
    website: read('website'),
  };
}

/** The model select's options as vehicle-shaped entries, so the payload can carry the display name. */
function vehiclesFromSelect(form) {
  const options = form.elements?.model?.options;
  if (!options) return [];
  return Array.from(options)
    .filter((option) => option.value)
    .map((option) => ({ fields: { slug: option.value, name: String(option.textContent ?? option.text ?? '').trim() } }));
}

export function initEnquiry(root, { fetch = globalThis.fetch, now = () => new Date(), location = globalThis.location } = {}) {
  const form = root?.querySelector?.('[data-enquiry-form]');
  if (!form) return NOOP;
  const status = form.querySelector('[data-enquiry-status]');
  const success = root.querySelector('[data-enquiry-success]') || form.querySelector('[data-enquiry-success]');
  const button = form.querySelector('button[type="submit"]');
  let sending = false;

  const setStatus = (text) => {
    if (status) status.textContent = text;
  };
  const clearErrors = () => {
    for (const name of FIELDS) {
      const message = form.querySelector(`#${name}-error`);
      if (message) message.textContent = '';
      form.elements?.[name]?.removeAttribute?.('aria-invalid');
    }
    setStatus('');
  };
  const showErrors = (errors) => {
    let first = null;
    for (const name of FIELDS) {
      if (!errors[name]) continue;
      const message = form.querySelector(`#${name}-error`);
      if (message) message.textContent = errors[name];
      const input = form.elements?.[name];
      input?.setAttribute?.('aria-invalid', 'true');
      first ||= input;
    }
    first?.focus?.();
  };
  const showSuccess = () => {
    form.hidden = true;
    if (success) {
      success.hidden = false;
      success.querySelector?.('h2')?.focus?.();
    }
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    if (sending) return;
    clearErrors();
    const values = readValues(form);
    const { ok, errors } = validate(values);
    if (!ok) {
      showErrors(errors);
      return;
    }
    // Bots fill the hidden field. Look successful and send nothing.
    if (String(values.website).trim()) {
      showSuccess();
      return;
    }
    sending = true;
    if (button) button.disabled = true;
    setStatus('Sending…');
    try {
      const payload = buildPayload(values, {
        vehicles: vehiclesFromSelect(form),
        pageUrl: location?.href || '',
        now: now(),
      });
      const response = await fetch(form.dataset.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(`Enquiry endpoint responded ${response.status}`);
      setStatus('');
      showSuccess();
    } catch {
      setStatus(form.dataset.errorBody || '');
      if (button) button.disabled = false;
    } finally {
      sending = false;
    }
  };

  form.addEventListener('submit', onSubmit);
  return () => form.removeEventListener('submit', onSubmit);
}
