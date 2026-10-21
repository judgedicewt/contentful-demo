# Enquiry form to Workfront implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `#/enquire` placeholder with a working form that posts JSON to a Workfront Fusion webhook, which creates a request in the Workfront queue.

**Architecture:** Contentful gains an `enquiryForm` singleton for copy and the webhook URL. The static site gains an `enquire` route, renderer, and a behaviour module that validates and posts. A Fusion blueprint (webhook, Workfront create record, webhook response) and a setup doc complete the integration.

**Tech Stack:** Plain ES modules, `node --test`, Contentful CMA/CDA, Adobe Workfront Fusion blueprint JSON.

**Spec:** docs/superpowers/specs/2026-10-21-enquiry-form-workfront-design.md

## Global constraints

- No secrets in the repo or the page. The webhook URL `https://hook.fusion.adobe.com/7hpg8v3lxbu7msjazssngoim6ea9bkhp` is public by design and lives in the seed entry.
- Workfront queue project ID: `6ad8d2f90005295eaf29343ebd663ed8`.
- Templates never touch `document` or `window`; all user strings go through `html` (escaped).
- Behaviour modules take a root and return a teardown; tests use fake DOM objects, never jsdom.
- Only the orchestrator runs `scripts/setup.js` against the space.
- Commit messages end with the session's two attribution lines. No model identifiers in repo files.

## Review focus

1. Intro or vehicle name containing `<script>` must render escaped (Task 3 test).
2. A fetch that rejects (network down) must re-enable the button and show the error body, not throw (Task 4 test).
3. `#/enquire/unknown-slug` must still render the form with no preselected model (Task 2 loader returns `vehicle: null`; Task 3 test).
4. A second submit while the first is in flight must be ignored (Task 4: button disabled, `state.sending` guard; test).
5. If the `enquiryForm` entry is unpublished, `#/enquire/750s` must fall back to the placeholder view (Task 2 test).

## Model assignment

| Task | Model | Why |
|---|---|---|
| 1 Content model and seed | standard tier | Pattern-following edits with tests |
| 2 CDA and router | standard tier | Same |
| 3 Renderer and styles | standard tier | Markup contract, needs care with escaping |
| 4 Behaviour module | standard tier | Logic plus fake-DOM tests |
| 5 Fusion blueprint and setup doc | standard tier (blueprint), fast tier (doc prose) | JSON must be exact; prose is cheap |
| 6 Verify script, provisioning, live check | Orchestrator | Touches the shared space |
| 7 Final review | most capable tier | Independent read of the whole diff |

---

### Task 1: Content model and seed

**Files:**
- Modify: `src/content-model.js` (append a type after `retailer`)
- Create: `src/seed/enquiry.js`
- Modify: `src/seed/index.js` (`SEED_GROUPS`)
- Test: `test/provision.test.js`

**Interfaces:**
- Produces: content type `enquiryForm` with field ids `title, intro, endpoint, submitLabel, consentText, successTitle, successBody, errorBody`; seed group `ENQUIRY_GROUP = { name: 'enquiry', assets: [], entries: [ { id: 'enquiry-form', contentType: 'enquiryForm', fields } ] }`.

- [ ] **Step 1: Write the failing tests** in `test/provision.test.js`

Add `'enquiryForm'` to the `expected` array in "the content model covers every type in the design" and add:

```js
test('enquiryForm endpoint is https-only and the seed entry satisfies it', () => {
  const type = CONTENT_TYPES.find((t) => t.id === 'enquiryForm');
  const endpoint = type.fields.find((f) => f.id === 'endpoint');
  assert.equal(endpoint.required, true);
  const pattern = new RegExp(endpoint.validations[0].regexp.pattern);
  assert.ok(!pattern.test('http://example.com/hook'));
  const group = SEED_GROUPS.find((g) => g.name === 'enquiry');
  const entry = group.entries.find((e) => e.id === 'enquiry-form');
  assert.equal(entry.contentType, 'enquiryForm');
  assert.ok(pattern.test(entry.fields.endpoint));
  assert.equal(entry.fields.title, 'Enquire');
});
```

- [ ] **Step 2: Run** `node --test test/provision.test.js` → FAIL (missing type / group).
- [ ] **Step 3: Add the type** to `CONTENT_TYPES` in `src/content-model.js`: `id: 'enquiryForm'`, `name: 'Enquiry form'`, `displayField: 'title'`, description "Enquiry form copy and webhook endpoint (singleton)", fields per the spec table. Use `defaultValue('Send enquiry')` and `defaultValue('Thank you')`. Endpoint validation: `{ regexp: { pattern: '^https://[^\\s]+$' }, message: 'Must be an https URL.' }`.
- [ ] **Step 4: Create `src/seed/enquiry.js`** exporting `ENQUIRY_GROUP` with the spec's seed values (title, intro, endpoint, submitLabel `Send enquiry`, consentText, successTitle `Thank you`, successBody, errorBody). Append it to `SEED_GROUPS` in `src/seed/index.js` after `SITE_GROUP`.
- [ ] **Step 5: Run** `node --test test/provision.test.js` and `node scripts/setup.js --dry-run` → both pass. Run `npm test` → all pass.
- [ ] **Step 6: Commit** `Add enquiryForm content type and seed`.

### Task 2: CDA and router

**Files:**
- Modify: `site/js/cda.js` (add `getEnquiryForm`, export it)
- Modify: `site/js/router.js` (`PLACEHOLDER_KINDS`, `matchRoute`, `loadRoute`, header comment)
- Test: `test/router.test.js`, `test/cda.test.js`

**Interfaces:**
- Consumes: nothing new.
- Produces: `cda.getEnquiryForm(): Promise<Entry|null>`; route `{ name: 'enquire', params: { slug: string|null } }`; loader result `{ view: 'enquire', data: { route, form, vehicle, vehicles } }` or `{ view: 'placeholder', data: { route: { ...route, params: { kind: 'enquire', slug, path } }, vehicle } }` when `form` is null.

- [ ] **Step 1: Write failing tests.** In `test/router.test.js`:

```js
test('matchRoute: enquire is a real route, configure stays a placeholder', () => {
  assert.deepEqual(matchRoute('#/enquire'), { name: 'enquire', params: { slug: null } });
  assert.deepEqual(matchRoute('#/enquire/750s'), { name: 'enquire', params: { slug: '750s' } });
  assert.equal(matchRoute('#/enquire/a/b').name, 'notFound');
  assert.equal(matchRoute('#/configure/750s').name, 'placeholder');
});

test('loadRoute: enquire loads form, vehicle and current vehicles; falls back to placeholder without a form', async () => {
  const form = entry('enquiryForm', { title: 'Enquire' });
  const car = entry('vehicle', { slug: '750s', name: '750S' });
  const cda = {
    getEnquiryForm: async () => form,
    getBySlug: async (type, slug) => (slug === '750s' ? car : null),
    getCurrentVehicles: async () => [car],
  };
  const ok = await loadRoute({ name: 'enquire', params: { slug: '750s' } }, cda);
  assert.equal(ok.view, 'enquire');
  assert.deepEqual([ok.data.form, ok.data.vehicle, ok.data.vehicles], [form, car, [car]]);
  const unknown = await loadRoute({ name: 'enquire', params: { slug: 'nope' } }, cda);
  assert.equal(unknown.data.vehicle, null);
  const noForm = await loadRoute({ name: 'enquire', params: { slug: '750s' } }, { ...cda, getEnquiryForm: async () => null });
  assert.equal(noForm.view, 'placeholder');
  assert.equal(noForm.data.route.params.kind, 'enquire');
  assert.equal(noForm.data.vehicle, car);
});
```

In `test/cda.test.js`, following the existing `createClient` test pattern with a stubbed fetch, assert `getEnquiryForm()` requests `content_type=enquiryForm` with `limit=1` and returns the first item or `null` when empty.

- [ ] **Step 2: Run** `node --test test/router.test.js test/cda.test.js` → FAIL.
- [ ] **Step 3: Implement.** `getEnquiryForm` mirrors `getSiteSettings` with `include: 1`. In `router.js`: remove `'enquire'` from `PLACEHOLDER_KINDS`; before the `PLACEHOLDER_KINDS` check add `if (first === 'enquire') return segments.length <= 2 ? { name: 'enquire', params: { slug: second ?? null } } : { name: 'notFound', params: { path } }`; in `loadRoute` add `case 'enquire'` using `Promise.allSettled` over the three calls (rejected → `null` / `[]`); update the header comment list of routes. A rejected `getCurrentVehicles` yields `vehicles: []`.
- [ ] **Step 4: Run** the two test files, then `npm test` → pass.
- [ ] **Step 5: Commit** `Add enquire route and enquiry form loader`.

### Task 3: Renderer and styles

**Files:**
- Create: `site/js/render/enquire.js`
- Modify: `site/js/render/index.js` (register `enquire`), `site/js/render/placeholder.js` (keep the `enquire` case; no change needed unless the title helper breaks)
- Modify: `site/styles.css` (append a `/* Forms */` block)
- Create: `test/fixtures/render-enquire.json` (`{ form, vehicle, vehicles }` with two vehicles `750s` and `gts`, intro containing `<script>alert(1)</script>`)
- Test: `test/render.test.js`

**Interfaces:**
- Consumes: `data = { route, form, vehicle, vehicles }` from Task 2; `ctx` as in `makeCtx`.
- Produces: the markup contract in the spec section "Renderer" (selectors `[data-enquiry-form]`, `[data-endpoint]`, `[data-error-body]`, inputs by `name`, `.form__error#<name>-error`, `[data-enquiry-status]`, `[data-enquiry-success][hidden]`, `.form__hp input[name="website"]`).

- [ ] **Step 1: Write failing tests** in `test/render.test.js`:

```js
test('enquire renderer emits the form contract and preselects the route vehicle', () => {
  const data = load('enquire');
  const ctx = makeCtx();
  const out = String(registry.enquire({ ...data, route: { name: 'enquire', params: { slug: '750s' } } }, ctx));
  assert.match(out, /<form[^>]*data-enquiry-form[^>]*data-endpoint="https:\/\/hook\.fusion\.adobe\.com\/[^"]+"/);
  for (const name of ['name', 'email', 'phone', 'country', 'model', 'message', 'consent', 'website']) {
    assert.match(out, new RegExp(`name="${name}"`), `field ${name}`);
  }
  assert.match(out, /<option value="750s" selected>750S<\/option>/);
  assert.match(out, /<option value="gts">GTS<\/option>/);
  assert.match(out, /data-enquiry-status/);
  assert.match(out, /data-enquiry-success[^>]*hidden/);
  assert.match(out, /id="email-error"/);
  assert.doesNotMatch(out, /<script>alert/);
  assert.match(out, /&lt;script&gt;/);
  assert.equal(ctx.heads.at(-1).title, 'Enquire about 750S');
});

test('enquire renderer works without a vehicle', () => {
  const data = load('enquire');
  const out = String(registry.enquire({ ...data, vehicle: null, route: { name: 'enquire', params: { slug: null } } }, makeCtx()));
  assert.match(out, /<option value="" selected>Select a model<\/option>/);
  assert.match(out, /<h1[^>]*>Enquire<\/h1>/);
  assert.match(out, /href="#\/">Back home/);
});
```

(`makeCtx` must expose `heads`; check how existing tests read `setHead` calls and follow that.)

- [ ] **Step 2: Run** `node --test test/render.test.js` → FAIL.
- [ ] **Step 3: Implement `render(data, ctx)`** in `site/js/render/enquire.js` per the spec. Select options: `vehicles` sorted as given, `value` = slug, label = name, `selected` on the route vehicle's slug or on the empty option. Put the submit label, success title and body, and error body from `form.fields` with the spec's seed strings as fallbacks. Register in `index.js` and add `enquire` to the view keys comment.
- [ ] **Step 4: Add styles** in `site/styles.css` per the spec "Styles" section. Use existing tokens (look for the orange accent and carbon background variables at the top of the file).
- [ ] **Step 5: Run** `node --test test/render.test.js`, then `npm test` → pass.
- [ ] **Step 6: Commit** `Render the enquiry form`.

### Task 4: Behaviour module

**Files:**
- Create: `site/js/enquiry.js`
- Modify: `site/app.js` (`showMain` tears down and inits enquiry alongside motion)
- Test: `test/enquiry.test.js`

**Interfaces:**
- Consumes: the markup contract from Task 3.
- Produces: `validate(values) → { ok, errors }`, `buildPayload(values, { vehicles, pageUrl, now }) → object`, `initEnquiry(root, { fetch, now, location } = {}) → () => void`.

- [ ] **Step 1: Write failing tests** in `test/enquiry.test.js`:

```js
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
```

Then `initEnquiry` tests with a fake form (write a `fakeForm(values)` helper that returns an object with `elements` (by name, each `{ value, checked, setAttribute, removeAttribute, focus }`), `dataset`, `querySelector(sel)` for `[data-enquiry-status]`, `[data-enquiry-success]`, `button[type="submit"]`, `#<name>-error`, and `addEventListener('submit', fn)` that stores `fn`; `root.querySelector('[data-enquiry-form]')` returns it):

- posts JSON to `data-endpoint` with `Content-Type: application/json` and the payload from `buildPayload`; on `{ ok: true }` the form gets `hidden = true` and the success panel `hidden = false`;
- on `{ ok: false, status: 500 }` the status text equals the form's `data-error-body` and the button is re-enabled;
- on a rejected fetch the same, and nothing throws;
- a second submit while the first is pending does not call fetch again;
- honeypot filled → success panel shown and fetch not called;
- validation failure writes `Enter a valid email address.` into `#email-error`, sets `aria-invalid="true"`, and does not call fetch;
- teardown removes the submit listener (the helper's `removeEventListener` records it).

- [ ] **Step 2: Run** `node --test test/enquiry.test.js` → FAIL (module missing).
- [ ] **Step 3: Implement** `site/js/enquiry.js` per the spec "Behaviour" section. Read values with `form.elements[name]` (`.checked` for `consent`, `.value` otherwise). Keep a `sending` flag. Use `pageUrl = location?.href || ''`.
- [ ] **Step 4: Wire `app.js`**: import `initEnquiry`; in `showMain`, keep a `teardownEnquiry` beside `teardownMotion`, call both teardowns, and when `motion` is true set `teardownEnquiry = initEnquiry(mounts.main)`.
- [ ] **Step 5: Run** `npm test` → pass. Start `node scripts/serve.js` and open `#/enquire/750s` in headless Chromium via CDP (see `scratchpad/cdp-cards.mjs` for the pattern) to confirm the form renders and client validation fires; do not submit.
- [ ] **Step 6: Commit** `Submit enquiries to the Fusion webhook`.

### Task 5: Fusion blueprint and setup doc

**Files:**
- Create: `fusion/enquiry-scenario.blueprint.json`
- Create: `docs/fusion-setup.md`
- Modify: `README.md` (add an "Enquiry form" section linking the doc)
- Test: `test/fusion.test.js`

**Interfaces:**
- Consumes: payload keys from Task 4 (`name, email, phone, country, model, modelSlug, message, consent, source, pageUrl, submittedAt`).
- Produces: a blueprint with modules `1 gateway:CustomWebHook` (hook `200628`), `2 workfront:createRecord`, `3 gateway:WebhookRespond`; `metadata.instant: true`, `metadata.zone: "app.workfrontfusion.com"`.

- [ ] **Step 1: Write the failing test** `test/fusion.test.js`: parse the file; assert `flow.map(m => m.module)` equals `['gateway:CustomWebHook', 'workfront:createRecord', 'gateway:WebhookRespond']`; module 1 keeps `parameters.hook === 200628`; module 2 `mapper.record_type === 'OPTASK'`, `mapper.projectID === '6ad8d2f90005295eaf29343ebd663ed8'`, `mapper.name === 'Enquiry: {{1.model}} - {{1.name}}'`, and `mapper.description` contains every payload key as `{{1.<key>}}`; module 2 has no `__IMTCONN__` value (parameters omit it or set it to `null`); module 3 `mapper.status === '200'` and `mapper.body` contains `{{2.ID}}`; `metadata.instant === true`.
- [ ] **Step 2: Run** `node --test test/fusion.test.js` → FAIL.
- [ ] **Step 3: Write the blueprint.** Start from the user's starter (name `Integration Webhooks`, hook `200628`, scenario metadata as given) and rename it `McLaren enquiry to Workfront`. Module 2 `metadata.restore` names the record type label `Issue`; module 3 `mapper.headers` = `[{ key: 'Content-Type', value: 'application/json' }]`; designer `x` 300 and 600. Description text, one line per field:

```
Name: {{1.name}}
Email: {{1.email}}
Phone: {{1.phone}}
Country: {{1.country}}
Model: {{1.model}} ({{1.modelSlug}})
Message: {{1.message}}
Consent: {{1.consent}}
Source: {{1.source}}
Page: {{1.pageUrl}}
Submitted: {{1.submittedAt}}
```

- [ ] **Step 4: Write `docs/fusion-setup.md`** (a fast-tier model may draft the prose): import steps (Scenarios > Create > Import blueprint, choose the Workfront connection on module 2, run once, turn on), the payload contract table with an example JSON, the hand-build table (module, setting, value) for each of the three modules, and the known limits from the spec. Add a README section "Enquiry form" with two sentences and a link.
- [ ] **Step 5: Run** `node --test test/fusion.test.js` and `npm test` → pass.
- [ ] **Step 6: Commit** `Add Fusion blueprint and setup guide for enquiries`.

### Task 6: Verify script, provisioning, live check (orchestrator)

**Files:**
- Modify: `scripts/verify-content.js`

- [ ] **Step 1:** Add a check: fetch `content_type=enquiryForm`; `total` must be 1 and `fields.endpoint` must start with `https://`; include the count in the summary line. Confirm the internal-link check treats `#/enquire/...` as a valid route (it uses `matchRoute`, so `enquire` must be in its accepted route names if it keeps a list).
- [ ] **Step 2:** `node scripts/setup.js --dry-run`, then `node scripts/setup.js --types-only`, then `node scripts/setup.js --only=enquiry`. Then `node scripts/verify-content.js` → pass.
- [ ] **Step 3:** Push `main`, wait for the Pages deploy, open `#/enquire/750s` via CDP, submit one real enquiry with name `Demo test`, and confirm the Fusion response is 200 and the request appears in Workfront (ask the user to confirm the latter if the API key is not available here).
- [ ] **Step 4: Commit** `Verify the enquiry form entry`.

### Task 7: Final review (most capable tier)

- [ ] Dispatch a reviewer over `git diff 86fa800..HEAD` with the spec and the Review focus list; fix confirmed findings; rerun `npm test` and `verify-content`; push.
