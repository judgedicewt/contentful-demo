/** imageBlock (m020-image): a figure, contained or full bleed. */
import { html } from '../dom.js';
import { imageTag, isEntry } from './common.js';

export function render(entry, ctx) {
  const f = entry.fields;
  if (!isEntry(f.image)) return '';
  const full = f.layout === 'full';
  const figure = html`
    <figure class="image-block__figure">
      ${imageTag(ctx, f.image, { w: full ? 1920 : 1200 })}
      ${f.caption ? html`<figcaption class="image-block__caption">${f.caption}</figcaption>` : ''}
    </figure>`;
  if (full) return html`<section class="image-block image-block--full theme-white">${figure}</section>`;
  return html`
    <section class="section image-block image-block--contained theme-white">
      <div class="container">${figure}</div>
    </section>`;
}
