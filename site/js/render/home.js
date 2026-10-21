/** Home: full-height hero titled with the site name, model showcase strip, then the page sections. */
import { html } from '../dom.js';
import { clip, contentTypeOf, imageTag, isEntry, present } from './common.js';
import { renderSections } from './sections.js';

/** The first text block's heading doubles as the hero strapline. */
function strapline(entry) {
  const block = present(entry.fields.sections).find((section) => contentTypeOf(section) === 'textBlock');
  return block?.fields?.heading || '';
}

function hero(ctx, entry, siteName) {
  const f = entry.fields;
  const line = strapline(entry);
  return html`
    <section class="hero hero--full hero--home theme-carbon" aria-labelledby="page-title" data-hero>
      ${isEntry(f.heroImage) ? html`<div class="hero__media">${imageTag(ctx, f.heroImage, { w: 1920, className: 'hero__image', eager: true })}</div>` : ''}
      <div class="hero__content container">
        ${f.kicker ? html`<span class="eyebrow">${f.kicker}</span>` : ''}
        <h1 id="page-title" class="hero__title">${siteName}</h1>
        ${line ? html`<p class="hero__strapline lead">${line}</p>` : ''}
      </div>
    </section>`;
}

function showcaseCard(ctx, vehicle) {
  if (!isEntry(vehicle)) return '';
  const f = vehicle.fields;
  const href = ctx.routeFor(vehicle);
  const image = f.cardImage || f.heroImage;
  return html`
    <li class="showcase__card">
      ${image ? html`<a class="showcase__media" href="${href}" tabindex="-1" aria-hidden="true">${imageTag(ctx, image, { w: 800, className: 'showcase__image', aspect: '4:3' })}</a>` : ''}
      <div class="showcase__body">
        <h3 class="showcase__name">${f.name}</h3>
        ${f.tagline ? html`<p class="showcase__tagline muted">${f.tagline}</p>` : ''}
        <a class="showcase__link" href="${href}">Explore<span class="visually-hidden"> ${f.name}</span></a>
      </div>
    </li>`;
}

/** Nothing at all when there are no vehicles, rather than an empty section. */
function showcase(ctx, vehicles) {
  const cards = present(vehicles).map((vehicle) => showcaseCard(ctx, vehicle)).filter(Boolean);
  if (!cards.length) return '';
  return html`
    <section class="section showcase theme-carbon carousel" aria-roledescription="carousel" aria-label="Models">
      <div class="container carousel__head">
        <h2 class="carousel__title" data-reveal>Models</h2>
        <div class="carousel__controls">
          <button type="button" class="carousel__button" data-carousel-prev aria-label="Previous models">&larr;</button>
          <button type="button" class="carousel__button" data-carousel-next aria-label="Next models">&rarr;</button>
        </div>
      </div>
      <ul class="carousel__track showcase__track" data-carousel-track tabindex="0" aria-label="Models">
        ${cards}
      </ul>
    </section>`;
}

export function render(data, ctx) {
  const entry = data.entry;
  const siteName = ctx.siteSettings?.fields?.siteName || 'McLaren';
  ctx.setHead({ title: siteName, description: entry.fields.seo?.fields?.description || clip(entry.fields.title) });
  return html`
    ${hero(ctx, entry, siteName)}
    ${showcase(ctx, data.showcase)}
    ${renderSections(entry.fields.sections, ctx, { latestStories: data.latestStories })}`;
}
