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

function retailerItem(retailer) {
  const f = retailer.fields;
  const map = mapHref(f.location);
  return html`
    <li class="retailer">
      <h3 class="retailer__name">${f.name}</h3>
      <p class="eyebrow retailer__city">${f.city}</p>
      ${f.address ? html`<address class="retailer__address">${lines(f.address)}</address>` : ''}
      <ul class="retailer__links">
        ${f.phone ? html`<li>${anchor(telHref(f.phone), '', f.phone)}</li>` : ''}
        ${f.website ? html`<li>${anchor(f.website, '', 'Website')}</li>` : ''}
        ${map ? html`<li>${anchor(map, 'btn btn-text', 'View on map')}</li>` : ''}
      </ul>
    </li>`;
}

export function render(data, ctx) {
  const retailers = present(data.retailers);
  const countries = [];
  for (const retailer of retailers) {
    const country = retailer.fields.country || 'Other';
    let group = countries.find((item) => item.country === country);
    if (!group) countries.push((group = { country, items: [] }));
    group.items.push(retailer);
  }
  ctx.setHead({ title: 'Find a retailer', description: 'Find a McLaren retailer near you.' });
  const trail = [{ label: 'Home', href: '#/' }, { label: 'Retailers' }];
  return html`
    <div class="container crumb-bar">${ctx.renderBreadcrumbs(trail)}</div>
    <section class="section retailers-header theme-carbon">
      <div class="container container--narrow">
        <span class="eyebrow">Retailers</span>
        <h1>Find a retailer</h1>
        <p class="lead">Speak to the people who sell and service McLaren road cars near you.</p>
      </div>
    </section>
    <section class="section retailers theme-white">
      <div class="container">
        ${countries.length
          ? countries.map(
              (group) => html`
                <div class="retailers__country">
                  <h2 class="retailers__heading">${group.country}</h2>
                  <ul class="retailers__list">${group.items.map(retailerItem)}</ul>
                </div>`,
            )
          : html`<p class="muted">No retailers are listed yet.</p>`}
      </div>
    </section>`;
}
