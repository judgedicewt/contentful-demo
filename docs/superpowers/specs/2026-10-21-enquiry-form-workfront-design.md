# Enquiry form to Workfront design

## Goal

Replace the `#/enquire` placeholder with a working enquiry form. The browser
posts each submission to an Adobe Workfront Fusion webhook. A Fusion scenario
creates a request (an `OPTASK` issue) in the Workfront request queue project
`6ad8d2f90005295eaf29343ebd663ed8` and answers the browser. Contentful holds
the form copy and the webhook URL, so marketers can change either without a
deploy. Contentful does not store submissions.

## Constraints

- The site stays static on GitHub Pages. No server code, no secrets in the
  repo or the page. The Fusion webhook URL is a capability URL and ships in
  the page by design.
- The webhook already answers CORS: `Access-Control-Allow-Origin: *`,
  `Access-Control-Allow-Headers: content-type` on preflight. The browser posts
  JSON directly.
- The Fusion scenario is delivered as an importable blueprint that extends
  the user's starter blueprint (webhook id `200628`, "Mclaren Request
  Webhook"). The user imports it and picks their Workfront connection.
- Existing conventions apply: fixed-ID idempotent provisioning, `html`/`raw`
  escaping, templates never touch `document`, behaviour modules take a root
  and return a teardown, tests run with `node --test` and fake DOM objects.

## Content model

New content type `enquiryForm`, display field `title`, description
"Enquiry form copy and webhook endpoint (singleton)". Fields:

| id | name | type | rules |
|---|---|---|---|
| `title` | Title | Symbol | required, max 120 |
| `intro` | Intro | Text | |
| `endpoint` | Webhook endpoint | Symbol | required, regexp `^https://[^\s]+$` |
| `submitLabel` | Submit label | Symbol | default `Send enquiry` |
| `consentText` | Consent text | Text | required |
| `successTitle` | Success title | Symbol | required, default `Thank you` |
| `successBody` | Success body | Text | required |
| `errorBody` | Error body | Text | required |

One seed entry, id `enquiry-form`, in a new seed group `enquiry`
(`src/seed/enquiry.js`, appended to `SEED_GROUPS`). Seed values:

- title: `Enquire`
- intro: `Tell us which model you are interested in and a McLaren retailer will be in touch.`
- endpoint: `https://hook.fusion.adobe.com/7hpg8v3lxbu7msjazssngoim6ea9bkhp`
- consentText: `I agree to McLaren Automotive contacting me about this enquiry. This is a demo: submissions create a request in a test Workfront queue.`
- successBody: `Your enquiry has been received and a request has been raised with our team.`
- errorBody: `We could not send your enquiry. Please try again in a moment.`

## Routing and data

- `enquire` leaves `PLACEHOLDER_KINDS`. `matchRoute` returns
  `{ name: 'enquire', params: { slug: second ?? null } }` for `#/enquire` and
  `#/enquire/<slug>`; deeper paths are `notFound`.
- `cda.getEnquiryForm()` returns the first published `enquiryForm` entry or
  `null` (`content_type=enquiryForm&limit=1`).
- `loadRoute` for `enquire` runs `Promise.allSettled` over the form entry,
  the vehicle by slug (when a slug is present, include 1), and
  `getCurrentVehicles()`. If the form entry is missing it returns the
  `placeholder` view with `kind: 'enquire'`, so the site degrades to today's
  behaviour. Otherwise it returns
  `{ view: 'enquire', data: { route, form, vehicle, vehicles } }`.
- `routeFor` is unchanged. Vehicle pages already link to
  `#/enquire/<slug>`.

## Renderer

`site/js/render/enquire.js` exports `render(data, ctx)` and is registered as
`enquire`. Layout: breadcrumb bar, a `section.section.enquiry.theme-carbon`
with a narrow container, eyebrow "Enquiry", `h1` from `form.fields.title`
(suffixed with the vehicle name when present: "Enquire about 750S"), the
intro, then the form.

Markup contract (the behaviour module depends on these selectors):

- `form.form[data-enquiry-form][data-endpoint="<url>"][novalidate]`
- Inputs by `name`: `name` (text, required, autocomplete name), `email`
  (email, required), `phone` (tel, optional), `country` (text, required,
  autocomplete country-name), `model` (select, required, options are the
  current vehicles' names with `value` = slug, preselected from the route
  vehicle, first option "Select a model" with empty value), `message`
  (textarea, optional, max 2000), `consent` (checkbox, required).
- Honeypot: `input[name="website"]` inside `.form__hp` (visually hidden,
  `tabindex="-1"`, `autocomplete="off"`, `aria-hidden="true"`).
- Each field sits in `.form__field` with a `<label for>` and an empty
  `.form__error[id="<name>-error"]` paragraph; inputs reference it with
  `aria-describedby`.
- `button.btn.btn-primary[type="submit"]` with the submit label.
- `p.form__status[data-enquiry-status][role="status"][aria-live="polite"]`.
- `div.enquiry__success[data-enquiry-success][hidden]` holding the success
  title (`h2`) and body, and a "Back to <vehicle>" or "Back home" button.
- The error body is in `data-error-body` on the form for the behaviour
  module to show.

`ctx.setHead` title: the `h1` text; description: the intro.

## Behaviour

`site/js/enquiry.js`:

- `validate(values)` → `{ ok: boolean, errors: { [name]: message } }`.
  Rules: `name` non-empty after trim; `email` matches
  `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`; `country` non-empty; `model` non-empty;
  `consent` true; `message` at most 2000 characters. Messages are plain
  sentences ("Enter your name.", "Enter a valid email address.", "Enter your
  country.", "Choose a model.", "Tick the consent box to continue.",
  "Keep your message under 2000 characters.").
- `buildPayload(values, { vehicles, pageUrl, now })` → JSON-safe object:
  `{ name, email, phone, country, model, modelSlug, message, consent: true,
  source: 'contentful-demo', pageUrl, submittedAt }`. `model` is the display
  name looked up from `vehicles` by slug (falls back to the slug);
  `submittedAt` is `now.toISOString()`. Strings are trimmed.
- `initEnquiry(root, { fetch = globalThis.fetch, now = () => new Date(),
  location = globalThis.location } = {})` → teardown. Finds
  `[data-enquiry-form]`; if absent returns a no-op. On submit: prevent
  default, clear errors, read values via `FormData`-free DOM reads (so fake
  DOM tests work: `form.elements[name].value` / `.checked`), validate. On
  errors: write each message to its `.form__error`, set `aria-invalid`,
  focus the first invalid input, and stop. If the honeypot has a value:
  show the success panel without sending. Otherwise disable the button, set
  the status text to "Sending…", POST JSON with
  `headers: { 'Content-Type': 'application/json' }`. On `response.ok`: hide
  the form, unhide the success panel, move focus to its heading. On a
  non-OK response or a thrown fetch error: re-enable the button, set the
  status text to the error body, keep the values.
- `app.js` calls `initEnquiry(main)` after render, alongside `initMotion`,
  and tears both down on the next render.

## Fusion scenario

`fusion/enquiry-scenario.blueprint.json` extends the user's starter
blueprint, scenario name "McLaren enquiry to Workfront":

1. Module 1, unchanged: `gateway:CustomWebHook`, hook `200628`.
2. Module 2: `workfront:createRecord` (Adobe Workfront "Create a record"),
   record type `OPTASK`, mapped fields:
   - `projectID`: `6ad8d2f90005295eaf29343ebd663ed8`
   - `name`: `Enquiry: {{1.model}} - {{1.name}}`
   - `description`: a multi-line text with one `Label: value` line per
     payload field (Name, Email, Phone, Country, Model, Message, Consent,
     Source, Page, Submitted).
   The connection is left for the user to pick on import; the blueprint
   carries no connection id.
3. Module 3: `gateway:WebhookRespond`, status `200`, header
   `Content-Type: application/json`, body
   `{"ok":true,"id":"{{2.ID}}"}`.

`docs/fusion-setup.md` documents: how to import the blueprint, pick the
Workfront connection, turn the scenario on, and the full payload contract
(keys, types, example). It also notes the known limits: if the Workfront
step fails, Fusion still answers the browser with its default "Accepted"
after a delay, so the browser will show success; errors surface in the
Fusion execution log. It lists the exact module settings so the scenario can
be rebuilt by hand if the blueprint's module identifiers do not match the
user's Fusion version.

## Styles

A `Forms` block in `site/styles.css`: `.form` as a single column that becomes
two columns at `min-width: 720px` with `message` and `consent` spanning both;
dark inputs matching the carbon theme (1px border, 2px orange focus ring via
`:focus-visible`); `.form__error` in the existing error colour, empty by
default; `.form__hp` visually hidden; `.form__status` muted; `.enquiry__success`
as a padded panel. Reduced-motion rules are not needed; nothing animates.

## Verification and tests

- `test/enquiry.test.js`: `validate` accepts a complete set and rejects
  each missing rule with the exact message; `buildPayload` trims, resolves
  the model name, and stamps `source`/`submittedAt`; `initEnquiry` with a
  fake form and a stubbed `fetch` posts JSON to `data-endpoint`, shows the
  success panel on `ok: true`, shows the error body on `ok: false` and on a
  rejected fetch, and skips `fetch` when the honeypot is filled.
- `test/router.test.js`: `#/enquire` and `#/enquire/750s` match `enquire`;
  `#/enquire/a/b` is `notFound`; `#/configure/750s` still matches
  `placeholder`.
- `test/render.test.js`: the enquire renderer emits the markup contract,
  preselects the route vehicle, escapes a `<script>` in the intro, and
  renders without a vehicle.
- `test/provision.test.js` or `test/placeholders.test.js`: `enquiryForm`
  is in the content model and the seed entry's endpoint matches the field
  regexp.
- `scripts/verify-content.js` checks that exactly one `enquiryForm` is
  published and its endpoint starts with `https://`, and counts
  `#/enquire/...` links as valid routes.
- Manual: one real submission from the live site after the user imports and
  enables the scenario, confirmed by the request appearing in the Workfront
  queue.

## Out of scope

Storing enquiries in Contentful, queue topics and routing rules, custom form
fields on the Workfront issue, email confirmation to the submitter,
rate limiting or CAPTCHA, and a Fusion error branch.
