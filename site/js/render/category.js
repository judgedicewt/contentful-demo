/** Category page: tabs, header text, product cards, banner, next steps. */
import { html, raw } from '../dom.js';
import { anchor, applyHead, isEntry, paragraphs, present } from './common.js';
import { cardList, vehicleCard } from './cards.js';
import { render as renderBanner } from './bannerButton.js';

function tabs(ctx, entry) {
  const categories = present(ctx.categories);
  if (!categories.length) return '';
  return html`
    <nav class="category-tabs" aria-label="Model categories">
      <ul class="category-tabs__list container">
        ${categories.map((category) => {
          const current = category.sys?.id === entry.sys?.id;
          return html`<li><a class="category-tabs__tab" href="${ctx.routeFor(category)}"${current ? raw(' aria-current="page"') : ''}>${category.fields.name}</a></li>`;
        })}
      </ul>
    </nav>`;
}

/** "Continue your journey": MSO, the first related story if any, retailers. */
function journey(ctx, vehicles) {
  let story = null;
  for (const vehicle of vehicles) {
    story = present(vehicle.fields.relatedStories)[0];
    if (story) break;
  }
  return html`
    <section class="section cta-group theme-carbon">
      <div class="container">
        <h2 class="cta-group__title">Continue your journey</h2>
        <div class="btn-group">
          ${anchor('#/mso', 'btn btn-secondary', 'Personalise with MSO')}
          ${story ? anchor(ctx.routeFor(story), 'btn btn-secondary', 'Read the latest story') : ''}
          ${anchor('#/retailers', 'btn btn-secondary', 'Find a retailer')}
        </div>
      </div>
    </section>`;
}

export function render(data, ctx) {
  const entry = data.entry;
  const f = entry.fields;
  // the category page is "Current models": legacy cars live under #/legacy
  const vehicles = present(data.vehicles).filter((vehicle) => vehicle.fields.status !== 'legacy');
  applyHead(ctx, entry, { title: f.name, description: f.intro });
  const trail = [{ label: 'Home', href: '#/' }, { label: 'Current models', href: '#/current-models/supercars' }, { label: f.name }];
  return html`
    ${tabs(ctx, entry)}
    <div class="container crumb-bar">${ctx.renderBreadcrumbs(trail)}</div>
    <section class="section category-header theme-carbon">
      <div class="container container--narrow">
        <span class="eyebrow">Current models</span>
        <h1>${f.name}</h1>
        ${f.intro ? html`<div class="lead category-header__intro">${paragraphs(f.intro)}</div>` : ''}
      </div>
    </section>
    <section class="section category-products theme-mist" aria-label="${f.name} models">
      <div class="container">
        ${vehicles.length
          ? cardList(vehicles.map((vehicle) => vehicleCard(ctx, vehicle)))
          : html`<p class="muted">No models are listed in this category yet.</p>`}
      </div>
    </section>
    ${isEntry(f.featuredBanner) ? renderBanner(f.featuredBanner, ctx) : ''}
    ${journey(ctx, vehicles)}`;
}
