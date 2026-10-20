/**
 * Placeholder view for demo destinations that have no real page yet:
 * `#/configure/*`, `#/enquire/*`, `#/contact`, `#/legal/*`,
 * `#/placeholder/*` and `#/mcl-6gt`. Data: `{ route, vehicle }`, where
 * `vehicle` is the resolved vehicle for configure/enquire links, or null.
 */
import { html } from '../dom.js';
import { isEntry } from './common.js';

function titleFor(kind, slug, vehicle) {
  const name = vehicle?.fields?.name;
  switch (kind) {
    case 'configure':
      return name ? `Configure your ${name}` : 'Configurator';
    case 'enquire':
      return name ? `Enquire about ${name}` : 'Enquire';
    case 'contact':
      return 'Contact McLaren';
    case 'legal':
      return slug ? `Legal: ${slug}` : 'Legal';
    default:
      return 'Coming soon';
  }
}

export function render(data, ctx) {
  const params = data?.route?.params || {};
  const vehicle = isEntry(data?.vehicle) ? data.vehicle : null;
  const title = titleFor(params.kind, params.slug, vehicle);
  ctx.setHead({ title, description: '' });
  const trail = [{ label: 'Home', href: '#/' }, { label: title }];
  return html`
    <div class="container crumb-bar">${ctx.renderBreadcrumbs(trail)}</div>
    <section class="section placeholder-view theme-carbon" aria-labelledby="placeholder-title">
      <div class="container container--narrow">
        <span class="eyebrow">Placeholder</span>
        <h1 id="placeholder-title">${title}</h1>
        <p class="lead">This destination is a placeholder route in the demo. It marks the integration point for a real configurator, lead form, or legal page.</p>
        <div class="btn-group">
          <a class="btn btn-primary" href="#/">Back home</a>
          ${vehicle ? html`<a class="btn btn-secondary" href="${ctx.routeFor(vehicle)}">Back to ${vehicle.fields.name}</a>` : ''}
        </div>
      </div>
    </section>`;
}
