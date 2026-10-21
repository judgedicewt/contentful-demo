/** cardGrid of generic promo cards (experiences). */
import { html } from '../dom.js';
import { imageTag, linkButton, paragraphs, present, isEntry } from './common.js';
import { cardList } from './cards.js';

function promoCard(ctx, card) {
  const f = card.fields;
  return html`
    <article class="card promo-card">
      ${isEntry(f.image) ? imageTag(ctx, f.image, { w: 800, className: 'card__media', aspect: '4:3' }) : ''}
      <div class="card__body">
        <h3 class="card__title">${f.title}</h3>
        ${f.body ? html`<div class="card__text muted">${paragraphs(f.body)}</div>` : ''}
        ${isEntry(f.cta) ? html`<div class="card__actions">${linkButton(ctx, f.cta, 'secondary')}</div>` : ''}
      </div>
    </article>`;
}

export function render(entry, ctx) {
  const f = entry.fields;
  const cards = present(f.cards);
  if (!cards.length) return '';
  return html`
    <section class="section card-grid theme-white">
      <div class="container">
        ${f.heading ? html`<h2 class="section__title" data-reveal>${f.heading}</h2>` : ''}
        ${cardList(cards.map((card) => promoCard(ctx, card)), cards.length === 2 ? 'grid-cards--two' : '')}
      </div>
    </section>`;
}
