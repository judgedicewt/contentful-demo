/** bannerButton (c002-banner-button; also the VLP MSO banner). */
import { html } from '../dom.js';
import { imageTag, linkButton, paragraphs, themeClass, isEntry } from './common.js';

export function render(entry, ctx) {
  const f = entry.fields;
  const theme = themeClass(f.theme, 'carbon');
  const hasImage = isEntry(f.image);
  // light themes put the image beside the copy; dark themes lay copy over it
  const split = hasImage && theme === 'theme-white';
  const layout = hasImage ? (split ? 'banner--split' : 'banner--image') : 'banner--plain';
  return html`
    <section class="banner ${layout} ${theme}">
      ${hasImage && !split ? html`<div class="banner__media">${imageTag(ctx, f.image, { w: 1920, className: 'banner__image' })}</div>` : ''}
      <div class="banner__inner container">
        <div class="banner__content">
          ${f.eyebrow ? html`<span class="eyebrow">${f.eyebrow}</span>` : ''}
          <h2 class="banner__title">${f.heading}</h2>
          ${f.body ? html`<div class="banner__body">${paragraphs(f.body)}</div>` : ''}
          ${isEntry(f.cta) ? html`<div class="btn-group">${linkButton(ctx, f.cta, 'primary')}</div>` : ''}
        </div>
        ${split ? html`<div class="banner__aside">${imageTag(ctx, f.image, { w: 1200, className: 'banner__image' })}</div>` : ''}
      </div>
    </section>`;
}
