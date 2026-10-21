/** Category page: tabs, header text, product cards, banner, next steps. */
import { html, raw } from '../dom.js';
import { anchor, applyHead, isEntry, paragraphs, present } from './common.js';
import { cardList, vehicleCard } from './cards.js';
import { render as renderBanner } from './bannerButton.js';

function tabs(ctx, entry) {
  const categories = present(ctx.categories);
  if (!categories.length) return '';
  return html`
    <nav class="category-tabs" aria-label="${ctx.t('model_categories')}">
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
        <h2 class="cta-group__title" data-reveal>${ctx.t('continue_your_journey')}</h2>
        <div class="btn-group">
          ${anchor(ctx.href('#/mso'), 'btn btn-secondary', ctx.t('personalise_with_mso'))}
          ${story ? anchor(ctx.routeFor(story), 'btn btn-secondary', ctx.t('read_latest_story')) : ''}
          ${anchor(ctx.href('#/retailers'), 'btn btn-secondary', ctx.t('find_a_retailer'))}
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
  const trail = [
    { label: ctx.t('home'), href: ctx.href('#/') },
    { label: ctx.t('current_models'), href: ctx.href('#/current-models/supercars') },
    { label: f.name },
  ];
  return html`
    ${tabs(ctx, entry)}
    <div class="container crumb-bar">${ctx.renderBreadcrumbs(trail, { lang: ctx.lang })}</div>
    <section class="section category-header theme-carbon">
      <div class="container container--narrow">
        <span class="eyebrow">${ctx.t('current_models')}</span>
        <h1>${f.name}</h1>
        ${f.intro ? html`<div class="lead category-header__intro">${paragraphs(f.intro)}</div>` : ''}
      </div>
    </section>
    <section class="section category-products theme-mist" aria-label="${ctx.t('models_of', { name: f.name })}">
      <div class="container">
        ${vehicles.length
          ? cardList(vehicles.map((vehicle) => vehicleCard(ctx, vehicle)))
          : html`<p class="muted">${ctx.t('no_models_in_category')}</p>`}
      </div>
    </section>
    ${isEntry(f.featuredBanner) ? renderBanner(f.featuredBanner, ctx) : ''}
    ${journey(ctx, vehicles)}`;
}
