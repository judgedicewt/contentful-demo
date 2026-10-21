/**
 * Enquiry form view. Data: `{ route, form, vehicle, vehicles }`, where `form`
 * is the `enquiryForm` entry, `vehicle` is the route vehicle or null and
 * `vehicles` are the current vehicles for the model select.
 *
 * The markup is a contract with `site/js/enquiry.js`: it finds the form by
 * `[data-enquiry-form]`, reads inputs by `name`, writes messages to
 * `#<name>-error`, and toggles `[data-enquiry-success]` and
 * `[data-enquiry-status]`. Keep the selectors in step with that module.
 */
import { html, raw } from '../dom.js';
import { isEntry, present } from './common.js';

const DEFAULTS = {
  title: 'Enquire',
  submitLabel: 'Send enquiry',
  consentText:
    'I agree to McLaren Automotive contacting me about this enquiry. This is a demo: submissions create a request in a test Workfront queue.',
  successTitle: 'Thank you',
  successBody: 'Your enquiry has been received and a request has been raised with our team.',
  errorBody: 'We could not send your enquiry. Please try again in a moment.',
};

/** Text input field with its label and empty error paragraph. */
function field({ name, label, type = 'text', autocomplete, required = false }) {
  return html`
    <div class="form__field">
      <label for="${name}">${label}</label>
      <input id="${name}" name="${name}" type="${type}"${autocomplete ? html` autocomplete="${autocomplete}"` : ''}${required ? raw(' required') : ''} aria-describedby="${name}-error">
      <p class="form__error" id="${name}-error"></p>
    </div>`;
}

/**
 * Model select. The route vehicle is added when `vehicles` lacks it, so it is
 * always preselected. With no options at all the select is optional and a hint
 * explains why; `site/js/enquiry.js` skips the model rule in that case.
 */
function modelField(vehicles, routeVehicle) {
  const selectedSlug = routeVehicle?.fields?.slug || '';
  const options = present(vehicles).filter((v) => v.fields.slug);
  if (selectedSlug && !options.some((v) => v.fields.slug === selectedSlug)) options.push(routeVehicle);
  const empty = options.length === 0;
  return html`
    <div class="form__field">
      <label for="model">Model</label>
      <select id="model" name="model"${empty ? '' : raw(' required')} aria-describedby="model-error">
        <option value=""${selectedSlug ? '' : raw(' selected')}>Select a model</option>
        ${options.map((v) => html`<option value="${v.fields.slug}"${v.fields.slug === selectedSlug ? raw(' selected') : ''}>${v.fields.name}</option>`)}
      </select>
      ${empty ? html`<p class="form__hint">Models could not be loaded. Reload the page to try again.</p>` : ''}
      <p class="form__error" id="model-error"></p>
    </div>`;
}

export function render(data, ctx) {
  const form = isEntry(data?.form) ? data.form.fields : {};
  const vehicle = isEntry(data?.vehicle) ? data.vehicle : null;
  const vehicleName = vehicle?.fields?.name || '';
  const baseTitle = form.title || DEFAULTS.title;
  const title = vehicleName ? `${baseTitle} about ${vehicleName}` : baseTitle;
  const intro = form.intro || '';
  ctx.setHead({ title, description: intro });
  const trail = [{ label: 'Home', href: '#/' }, { label: title }];
  const back = vehicle
    ? html`<a class="btn btn-secondary" href="${ctx.routeFor(vehicle)}">Back to ${vehicleName}</a>`
    : html`<a class="btn btn-secondary" href="#/">Back home</a>`;
  return html`
    <div class="container crumb-bar">${ctx.renderBreadcrumbs(trail)}</div>
    <section class="section enquiry theme-carbon" aria-labelledby="enquiry-title">
      <div class="container container--narrow">
        <span class="eyebrow">Enquiry</span>
        <h1 id="enquiry-title">${title}</h1>
        ${intro ? html`<p class="lead">${intro}</p>` : ''}
        <form class="form" data-enquiry-form data-endpoint="${form.endpoint || ''}" data-error-body="${form.errorBody || DEFAULTS.errorBody}" novalidate>
          ${field({ name: 'name', label: 'Full name', autocomplete: 'name', required: true })}
          ${field({ name: 'email', label: 'Email', type: 'email', autocomplete: 'email', required: true })}
          ${field({ name: 'phone', label: 'Phone (optional)', type: 'tel', autocomplete: 'tel' })}
          ${field({ name: 'country', label: 'Country', autocomplete: 'country-name', required: true })}
          ${modelField(data?.vehicles, vehicle)}
          <div class="form__field form__field--wide">
            <label for="message">Message (optional)</label>
            <textarea id="message" name="message" rows="5" maxlength="2000" aria-describedby="message-error"></textarea>
            <p class="form__error" id="message-error"></p>
          </div>
          <div class="form__field form__field--wide form__field--check">
            <input id="consent" name="consent" type="checkbox" required aria-describedby="consent-error">
            <label for="consent">${form.consentText || DEFAULTS.consentText}</label>
            <p class="form__error" id="consent-error"></p>
          </div>
          <div class="form__hp" aria-hidden="true">
            <label for="website">Leave this field empty</label>
            <input id="website" name="website" type="text" tabindex="-1" autocomplete="off">
          </div>
          <div class="form__actions form__field--wide">
            <button class="btn btn-primary" type="submit">${form.submitLabel || DEFAULTS.submitLabel}</button>
            <p class="form__status" data-enquiry-status role="status" aria-live="polite"></p>
          </div>
        </form>
        <div class="enquiry__success" data-enquiry-success hidden>
          <h2 tabindex="-1">${form.successTitle || DEFAULTS.successTitle}</h2>
          <p>${form.successBody || DEFAULTS.successBody}</p>
          <div class="btn-group">${back}</div>
        </div>
      </div>
    </section>`;
}
