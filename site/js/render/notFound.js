/** 404 view with a way back home and to the supercar range. */
import { html } from '../dom.js';

export function render(data, ctx) {
  ctx.setHead({ title: 'Page not found', description: '' });
  const path = data?.route?.params?.slug || data?.route?.params?.path || '';
  return html`
    <section class="section not-found theme-carbon">
      <div class="container container--narrow">
        <span class="eyebrow">404</span>
        <h1>This road leads nowhere</h1>
        <p class="lead">${path ? html`Nothing is published at <code>/${path}</code>.` : 'Nothing is published at this address.'} Head back to the start, or look at the cars.</p>
        <div class="btn-group">
          <a class="btn btn-primary" href="#/">Back to home</a>
          <a class="btn btn-secondary" href="#/current-models/supercars">Explore supercars</a>
        </div>
      </div>
    </section>`;
}
