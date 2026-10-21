/** Story page: hero with kicker and date, standfirst, sections, related content. */
import { html } from '../dom.js';
import { applyHead, dateLocale, formatDate, imageTag, isEntry, isoDate, paragraphs, present } from './common.js';
import { cardList, storyCard, vehicleCard } from './cards.js';
import { renderSections } from './sections.js';

export function render(data, ctx) {
  const entry = data.entry;
  const f = entry.fields;
  applyHead(ctx, entry, { title: f.title, description: f.standfirst });
  const date = formatDate(f.publishDate, dateLocale(ctx));
  const vehicles = present(f.relatedVehicles);
  const more = present(data.latestStories).filter((story) => story.sys?.id !== entry.sys?.id);
  // there is no stories index route, so the "Stories" crumb is not a link
  const trail = [{ label: ctx.t('home'), href: ctx.href('#/') }, { label: ctx.t('stories') }, { label: f.title }];
  return html`
    <div class="container crumb-bar">${ctx.renderBreadcrumbs(trail, { lang: ctx.lang })}</div>
    <section class="hero hero--compact hero--story theme-carbon" aria-labelledby="story-title">
      ${isEntry(f.heroImage) ? html`<div class="hero__media">${imageTag(ctx, f.heroImage, { w: 1920, className: 'hero__image', eager: true })}</div>` : ''}
      <div class="hero__content container">
        ${f.kicker || date
          ? html`<span class="eyebrow">${f.kicker}${f.kicker && date ? ' · ' : ''}${date ? html`<time datetime="${isoDate(f.publishDate)}">${date}</time>` : ''}</span>`
          : ''}
        <h1 id="story-title" class="hero__title">${f.title}</h1>
      </div>
    </section>
    ${f.standfirst
      ? html`
        <section class="section story-standfirst theme-white">
          <div class="container container--narrow"><div class="lead" data-reveal>${paragraphs(f.standfirst)}</div></div>
        </section>`
      : ''}
    ${renderSections(f.sections, ctx, { latestStories: data.latestStories })}
    ${vehicles.length
      ? html`
        <section class="section story-vehicles theme-mist">
          <div class="container">
            <h2 class="section__title" data-reveal>${ctx.t('related_models')}</h2>
            ${cardList(vehicles.map((vehicle) => vehicleCard(ctx, vehicle)))}
          </div>
        </section>`
      : ''}
    ${more.length
      ? html`
        <section class="section story-grid theme-white">
          <div class="container">
            <h2 class="section__title" data-reveal>${ctx.t('more_stories')}</h2>
            ${cardList(more.map((story) => storyCard(ctx, story)))}
          </div>
        </section>`
      : ''}`;
}
