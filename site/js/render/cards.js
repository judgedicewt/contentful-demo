/** Shared card helpers: product cards (vehicles) and story cards. */
import { html } from '../dom.js';
import { anchor, imageTag, formatDate, isoDate, isEntry, paragraphs } from './common.js';

/** Product card: image, name, short description, Explore plus Configure or Enquire. */
export function vehicleCard(ctx, vehicle) {
  if (!isEntry(vehicle)) return '';
  const f = vehicle.fields;
  const href = ctx.routeFor(vehicle);
  const image = f.cardImage || f.heroImage;
  const action = f.configureUrl
    ? anchor(f.configureUrl, 'btn btn-primary', 'Configure')
    : f.enquiryUrl
      ? anchor(f.enquiryUrl, 'btn btn-primary', 'Enquire')
      : '';
  return html`
    <article class="card product-card">
      ${image ? html`<a class="card__media-link" href="${href}" tabindex="-1" aria-hidden="true">${imageTag(ctx, image, { w: 800, className: 'card__media' })}</a>` : ''}
      <div class="card__body">
        ${f.yearIntroduced && f.status === 'legacy' ? html`<span class="eyebrow">${String(f.yearIntroduced)}</span>` : ''}
        <h3 class="card__title"><a href="${href}">${f.name}</a></h3>
        ${f.shortDescription ? html`<div class="card__text muted">${paragraphs(f.shortDescription)}</div>` : ''}
        <div class="card__actions">
          ${anchor(href, 'btn btn-secondary', html`Explore<span class="visually-hidden"> ${f.name}</span>`)}
          ${action}
        </div>
      </div>
    </article>`;
}

/** Story card: image, kicker and date, title, standfirst, read link. */
export function storyCard(ctx, story) {
  if (!isEntry(story)) return '';
  const f = story.fields;
  const href = ctx.routeFor(story);
  const image = f.cardImage || f.heroImage;
  const date = formatDate(f.publishDate);
  return html`
    <article class="card story-card">
      ${image ? html`<a class="card__media-link" href="${href}" tabindex="-1" aria-hidden="true">${imageTag(ctx, image, { w: 800, className: 'card__media' })}</a>` : ''}
      <div class="card__body">
        ${f.kicker || date
          ? html`<span class="eyebrow">${f.kicker}${f.kicker && date ? ' · ' : ''}${date ? html`<time datetime="${isoDate(f.publishDate)}">${date}</time>` : ''}</span>`
          : ''}
        <h3 class="card__title"><a href="${href}">${f.title}</a></h3>
        ${f.standfirst ? html`<p class="card__text muted">${f.standfirst}</p>` : ''}
        <div class="card__actions">
          ${anchor(href, 'btn btn-text', html`Read story<span class="visually-hidden">: ${f.title}</span>`)}
        </div>
      </div>
    </article>`;
}

/** A grid of cards as a list. `items` are already-rendered card fragments. */
export function cardList(items, className = '') {
  const cells = items.filter(Boolean);
  if (!cells.length) return '';
  return html`<ul class="grid-cards${className ? ` ${className}` : ''}">${cells.map((card) => html`<li>${card}</li>`)}</ul>`;
}
