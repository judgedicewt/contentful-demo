import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate, buildPayload, initEnquiry } from '../site/js/enquiry.js';

const good = { name: ' Ada ', email: 'ada@example.com', phone: '', country: 'UK', model: '750s', message: 'Hi', consent: true, website: '' };

test('validate accepts a complete submission and names each failure', () => {
  assert.deepEqual(validate(good), { ok: true, errors: {} });
  assert.equal(validate({ ...good, name: '  ' }).errors.name, 'Enter your name.');
  assert.equal(validate({ ...good, email: 'nope' }).errors.email, 'Enter a valid email address.');
  assert.equal(validate({ ...good, country: '' }).errors.country, 'Enter your country.');
  assert.equal(validate({ ...good, model: '' }).errors.model, 'Choose a model.');
  assert.equal(validate({ ...good, consent: false }).errors.consent, 'Tick the consent box to continue.');
  assert.equal(validate({ ...good, message: 'x'.repeat(2001) }).errors.message, 'Keep your message under 2000 characters.');
});

test('buildPayload trims, resolves the model name and stamps source and time', () => {
  const vehicles = [{ fields: { slug: '750s', name: '750S' } }];
  const now = new Date('2026-10-21T12:00:00Z');
  const payload = buildPayload(good, { vehicles, pageUrl: 'https://x/#/enquire/750s', now });
  assert.deepEqual(payload, {
    name: 'Ada', email: 'ada@example.com', phone: '', country: 'UK', model: '750S', modelSlug: '750s',
    message: 'Hi', consent: true, source: 'contentful-demo', pageUrl: 'https://x/#/enquire/750s',
    submittedAt: '2026-10-21T12:00:00.000Z',
  });
  assert.equal(buildPayload({ ...good, model: 'zz' }, { vehicles, pageUrl: '', now }).model, 'zz');
});

// A hand-written stand-in for the rendered form: inputs by name, the status,
// success, button and per-field error nodes, and a recorded submit listener.
function fakeForm(values = good) {
  const el = (extra = {}) => ({
    attrs: {},
    setAttribute(name, value) { this.attrs[name] = value; },
    removeAttribute(name) { delete this.attrs[name]; },
    focus() { this.focused = true; },
    ...extra,
  });
  const elements = {};
  for (const [name, value] of Object.entries(values)) {
    elements[name] = el(name === 'consent' ? { checked: value } : { value });
  }
  elements.model.options = [
    { value: '', textContent: 'Select a model' },
    { value: '750s', textContent: '750S' },
  ];
  const errors = {};
  const status = { textContent: '' };
  const success = { hidden: true, heading: el(), querySelector(sel) { return sel === 'h2' ? this.heading : null; } };
  const button = { disabled: false };
  const listeners = { submit: [], removed: [] };
  const form = {
    hidden: false,
    elements,
    dataset: { endpoint: 'https://hook.example/abc', errorBody: 'Could not send. Try again.' },
    errors,
    status,
    success,
    button,
    listeners,
    querySelector(sel) {
      if (sel === '[data-enquiry-status]') return status;
      if (sel === '[data-enquiry-success]') return success;
      if (sel === 'button[type="submit"]') return button;
      const match = /^#(\w+)-error$/.exec(sel);
      if (match) return (errors[match[1]] ||= { textContent: '' });
      return null;
    },
    addEventListener(type, fn) { if (type === 'submit') listeners.submit.push(fn); },
    removeEventListener(type, fn) { if (type === 'submit') listeners.removed.push(fn); },
    submit() {
      const event = { prevented: false, preventDefault() { this.prevented = true; } };
      for (const fn of listeners.submit) fn(event);
      return event;
    },
  };
  return form;
}

const rootOf = (form) => ({ querySelector: (sel) => (sel === '[data-enquiry-form]' ? form : null) });
const NOW = new Date('2026-10-21T12:00:00Z');
const deps = (fetch) => ({ fetch, now: () => NOW, location: { href: 'https://x/#/enquire/750s' } });
const tick = () => new Promise((resolve) => setImmediate(resolve));

test('initEnquiry returns a no-op teardown when there is no form', () => {
  const teardown = initEnquiry({ querySelector: () => null }, deps(() => {}));
  assert.doesNotThrow(() => teardown());
  assert.doesNotThrow(() => initEnquiry(null)());
});

test('a valid submit posts JSON to the endpoint, then shows the success panel', async () => {
  const form = fakeForm();
  const calls = [];
  initEnquiry(rootOf(form), deps(async (url, init) => { calls.push({ url, init }); return { ok: true, status: 200 }; }));
  const event = form.submit();
  assert.equal(event.prevented, true);
  assert.equal(form.button.disabled, true, 'disabled while sending');
  assert.equal(form.status.textContent, 'Sending…');
  await tick();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://hook.example/abc');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(calls[0].init.body), buildPayload(good, {
    vehicles: [{ fields: { slug: '750s', name: '750S' } }], pageUrl: 'https://x/#/enquire/750s', now: NOW,
  }));
  assert.equal(JSON.parse(calls[0].init.body).model, '750S');
  assert.equal(form.hidden, true);
  assert.equal(form.success.hidden, false);
  assert.equal(form.success.heading.focused, true, 'focus moves to the success heading');
});

test('a non-OK response shows the error body and re-enables the button', async () => {
  const form = fakeForm();
  initEnquiry(rootOf(form), deps(async () => ({ ok: false, status: 500 })));
  form.submit();
  await tick();
  assert.equal(form.status.textContent, 'Could not send. Try again.');
  assert.equal(form.button.disabled, false);
  assert.equal(form.hidden, false);
  assert.equal(form.success.hidden, true);
  assert.equal(form.elements.name.value, ' Ada ', 'values are kept');
});

test('a rejected fetch shows the error body and does not throw', async () => {
  const form = fakeForm();
  initEnquiry(rootOf(form), deps(async () => { throw new TypeError('network down'); }));
  assert.doesNotThrow(() => form.submit());
  await tick();
  assert.equal(form.status.textContent, 'Could not send. Try again.');
  assert.equal(form.button.disabled, false);
});

test('a second submit while the first is pending does not call fetch again', async () => {
  const form = fakeForm();
  let calls = 0;
  let release;
  initEnquiry(rootOf(form), deps(() => { calls += 1; return new Promise((resolve) => { release = resolve; }); }));
  form.submit();
  form.submit();
  assert.equal(calls, 1);
  release({ ok: true });
  await tick();
  assert.equal(calls, 1);
  assert.equal(form.success.hidden, false);
});

test('a filled honeypot shows success without calling fetch', async () => {
  const form = fakeForm({ ...good, website: 'http://spam.example' });
  let calls = 0;
  initEnquiry(rootOf(form), deps(async () => { calls += 1; return { ok: true }; }));
  form.submit();
  await tick();
  assert.equal(calls, 0);
  assert.equal(form.hidden, true);
  assert.equal(form.success.hidden, false);
});

test('a validation failure writes the message, flags the field and does not send', async () => {
  const form = fakeForm({ ...good, email: 'nope' });
  let calls = 0;
  initEnquiry(rootOf(form), deps(async () => { calls += 1; return { ok: true }; }));
  form.submit();
  await tick();
  assert.equal(calls, 0);
  assert.equal(form.errors.email.textContent, 'Enter a valid email address.');
  assert.equal(form.elements.email.attrs['aria-invalid'], 'true');
  assert.equal(form.elements.email.focused, true, 'first invalid field is focused');
  assert.equal(form.elements.name.attrs['aria-invalid'], undefined);
  assert.equal(form.button.disabled, false);
});

test('fixing a field clears its earlier error on the next submit', async () => {
  const form = fakeForm({ ...good, email: 'nope' });
  initEnquiry(rootOf(form), deps(async () => ({ ok: true })));
  form.submit();
  form.elements.email.value = 'ada@example.com';
  form.submit();
  await tick();
  assert.equal(form.errors.email.textContent, '');
  assert.equal(form.elements.email.attrs['aria-invalid'], undefined);
});

test('teardown removes the submit listener', () => {
  const form = fakeForm();
  const teardown = initEnquiry(rootOf(form), deps(async () => ({ ok: true })));
  const [handler] = form.listeners.submit;
  teardown();
  assert.deepEqual(form.listeners.removed, [handler]);
});
