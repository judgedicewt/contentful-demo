/**
 * Placeholder view for demo destinations that have no real page yet:
 * `#/configure/*`, `#/enquire/*`, `#/contact`, `#/legal/*`,
 * `#/placeholder/*` and `#/mcl-6gt`. Data: `{ route, vehicle }`, where
 * `vehicle` is the resolved vehicle for configure/enquire links, or null.
 */
import { html } from '../dom.js';
import { isEntry } from './common.js';

function titleFor(ctx, kind, slug, vehicle) {
  const name = vehicle?.fields?.name;
  switch (kind) {
    case 'configure':
      return name ? ctx.t('configure_your', { name }) : ctx.t('configurator');
    case 'enquire':
      return name ? ctx.t('enquire_about', { title: ctx.t('enquire_title'), name }) : ctx.t('enquire_title');
    case 'contact':
      return ctx.t('contact_mclaren');
    case 'legal':
      return slug ? ctx.t('legal_slug', { slug }) : ctx.t('legal');
    default:
      return ctx.t('coming_soon');
  }
}

export function render(data, ctx) {
  const params = data?.route?.params || {};
  const vehicle = isEntry(data?.vehicle) ? data.vehicle : null;
  const title = titleFor(ctx, params.kind, params.slug, vehicle);
  ctx.setHead({ title, description: '' });
  const trail = [{ label: ctx.t('home'), href: ctx.href('#/') }, { label: title }];
  return html`
    <div class="container crumb-bar">${ctx.renderBreadcrumbs(trail, { lang: ctx.lang })}</div>
    <section class="section placeholder-view theme-carbon" aria-labelledby="placeholder-title">
      <div class="container container--narrow">
        <span class="eyebrow">${ctx.t('placeholder')}</span>
        <h1 id="placeholder-title">${title}</h1>
        <p class="lead">${ctx.t('placeholder_body')}</p>
        <div class="btn-group">
          <a class="btn btn-primary" href="${ctx.href('#/')}">${ctx.t('back_home')}</a>
          ${vehicle ? html`<a class="btn btn-secondary" href="${ctx.routeFor(vehicle)}">${ctx.t('back_to', { name: vehicle.fields.name })}</a>` : ''}
        </div>
      </div>
    </section>`;
}
