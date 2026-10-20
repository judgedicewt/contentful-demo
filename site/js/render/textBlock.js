/** textBlock (t001-text, t002-header): heading plus rich text on a theme. */
import { html } from '../dom.js';
import { richText, themeClass } from './common.js';

export function render(entry, ctx) {
  const f = entry.fields;
  const body = richText(ctx, f.body);
  if (!f.heading && !body) return '';
  const theme = themeClass(f.theme, 'white');
  if (f.variant === 'header') {
    return html`
      <section class="section text-block text-block--header ${theme}">
        <div class="container container--narrow">
          ${f.heading ? html`<h2 class="text-block__title">${f.heading}</h2>` : ''}
          ${body ? html`<div class="text-block__lead lead richtext">${body}</div>` : ''}
        </div>
      </section>`;
  }
  return html`
    <section class="section text-block ${theme}">
      <div class="container container--narrow">
        ${f.heading ? html`<h2 class="text-block__title">${f.heading}</h2>` : ''}
        ${body ? html`<div class="richtext">${body}</div>` : ''}
      </div>
    </section>`;
}
