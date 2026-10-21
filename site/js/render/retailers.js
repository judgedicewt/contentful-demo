/** Retailers: query-driven list grouped by country, with map links. */
import { html } from '../dom.js';
import { anchor, lines, present } from './common.js';

function mapHref(location) {
  const lat = Number(location?.lat);
  const lon = Number(location?.lon ?? location?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return '';
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=14/${lat}/${lon}`;
}

function telHref(phone) {
  return `tel:${String(phone).replace(/[^\d+]/g, '')}`;
}

function retailerItem(ctx, retailer) {
  const f = retailer.fields;
  const map = mapHref(f.location);
  return html`
    <li class="retailer">
      <h3 class="retailer__name">${f.name}</h3>
      <p class="eyebrow retailer__city">${f.city}</p>
      ${f.address ? html`<address class="retailer__address">${lines(f.address)}</address>` : ''}
      <ul class="retailer__links">
        ${f.phone ? html`<li>${anchor(telHref(f.phone), '', f.phone)}</li>` : ''}
        ${f.website ? html`<li>${anchor(f.website, '', ctx.t('website'))}</li>` : ''}
        ${map ? html`<li>${anchor(map, 'btn btn-text', ctx.t('view_on_map'))}</li>` : ''}
      </ul>
    </li>`;
}

export function render(data, ctx) {
  const retailers = present(data.retailers);
  const countries = [];
  for (const retailer of retailers) {
    const country = retailer.fields.country || ctx.t('other');
    let group = countries.find((item) => item.country === country);
    if (!group) countries.push((group = { country, items: [] }));
    group.items.push(retailer);
  }
  ctx.setHead({ title: ctx.t('find_a_retailer'), description: ctx.t('retailers_description') });
  const trail = [{ label: ctx.t('home'), href: ctx.href('#/') }, { label: ctx.t('retailers') }];
  return html`
    <div class="container crumb-bar">${ctx.renderBreadcrumbs(trail, { lang: ctx.lang })}</div>
    <section class="section retailers-header theme-carbon">
      <div class="container container--narrow">
        <span class="eyebrow">${ctx.t('retailers')}</span>
        <h1>${ctx.t('find_a_retailer')}</h1>
        <p class="lead">${ctx.t('retailers_lead')}</p>
      </div>
    </section>
    <section class="section retailers theme-white">
      <div class="container">
        ${countries.length
          ? countries.map(
              (group) => html`
                <div class="retailers__country">
                  <h2 class="retailers__heading">${group.country}</h2>
                  <ul class="retailers__list">${group.items.map((retailer) => retailerItem(ctx, retailer))}</ul>
                </div>`,
            )
          : html`<p class="muted">${ctx.t('no_retailers')}</p>`}
      </div>
    </section>`;
}
