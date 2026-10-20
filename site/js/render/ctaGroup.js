/** ctaGroup ("Continue your journey"): heading plus a button group. */
import { html } from '../dom.js';
import { linkButton, present } from './common.js';

export function render(entry, ctx) {
  const f = entry.fields;
  const links = present(f.links);
  if (!links.length) return '';
  return html`
    <section class="section cta-group theme-carbon">
      <div class="container">
        <h2 class="cta-group__title">${f.heading || 'Continue your journey'}</h2>
        <div class="btn-group">${links.map((link) => linkButton(ctx, link, 'secondary'))}</div>
      </div>
    </section>`;
}
