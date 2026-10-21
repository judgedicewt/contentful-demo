/** vehicleGrid (P110ProductCards, curated): same product card as categories. */
import { html } from '../dom.js';
import { present } from './common.js';
import { cardList, vehicleCard } from './cards.js';

export function render(entry, ctx) {
  const f = entry.fields;
  const vehicles = present(f.vehicles);
  if (!vehicles.length) return '';
  return html`
    <section class="section vehicle-grid theme-mist">
      <div class="container">
        ${f.heading ? html`<h2 class="section__title" data-reveal>${f.heading}</h2>` : ''}
        ${cardList(vehicles.map((vehicle) => vehicleCard(ctx, vehicle)))}
      </div>
    </section>`;
}
