/** 404 view with a way back home and to the supercar range. */
import { brandMark } from '../brand.js';
import { html } from '../dom.js';

export function render(data, ctx) {
  ctx.setHead({ title: ctx.t('page_not_found'), description: '' });
  const path = data?.route?.params?.slug || data?.route?.params?.path || '';
  return html`
    <section class="section not-found theme-carbon">
      <div class="container container--narrow">
        ${brandMark({ className: 'brand-mark not-found__mark' })}
        <span class="eyebrow">404</span>
        <h1>${ctx.t('road_leads_nowhere')}</h1>
        <p class="lead">${path ? ctx.t('nothing_published_at', { path: html`<code>/${path}</code>` }) : ctx.t('nothing_published_here')} ${ctx.t('not_found_hint')}</p>
        <div class="btn-group">
          <a class="btn btn-primary" href="${ctx.href('#/')}">${ctx.t('back_to_home')}</a>
          <a class="btn btn-secondary" href="${ctx.href('#/current-models/supercars')}">${ctx.t('explore_supercars')}</a>
        </div>
      </div>
    </section>`;
}
