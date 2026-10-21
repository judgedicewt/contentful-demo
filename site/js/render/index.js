/**
 * Render registry. `registry[key](data, ctx)` returns HTML (a SafeHtml from
 * `html`); app.js coerces it with `String()` and assigns it to <main>.
 *
 * View keys: vehicle, vehicleCategory, page, home, story, retailers, enquire,
 * placeholder, notFound.
 * Section keys (content type IDs, called as `(sectionEntry, ctx)`):
 * textBlock, imageBlock, bannerButton, cardGrid, vehicleGrid, storyGrid,
 * ctaGroup.
 *
 * The data and ctx shapes are documented with the loaders in router.js and
 * the context builder in app.js. Templates never touch `document` or
 * `window`; document title and meta description go through `ctx.setHead`.
 */
import { render as vehicle } from './vehicle.js';
import { render as vehicleCategory } from './category.js';
import { render as page } from './page.js';
import { render as home } from './home.js';
import { render as story } from './story.js';
import { render as retailers } from './retailers.js';
import { render as notFound } from './notFound.js';
import { render as enquire } from './enquire.js';
import { render as placeholder } from './placeholder.js';
import { SECTION_RENDERERS } from './sections.js';

export const registry = {
  vehicle,
  vehicleCategory,
  page,
  home,
  story,
  retailers,
  enquire,
  notFound,
  placeholder,
  ...SECTION_RENDERERS,
};
