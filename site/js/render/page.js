/** Modular page: hero (full or compact), sibling sub-navigation, sections. */
import { html, raw } from '../dom.js';
import { applyHead, imageTag, isEntry, present, sortByOrder } from './common.js';
import { renderSections } from './sections.js';

function parentChain(entry) {
  const chain = [];
  const seen = new Set([entry.sys?.id]);
  let parent = entry.fields.parent;
  while (isEntry(parent) && !seen.has(parent.sys?.id) && chain.length < 5) {
    seen.add(parent.sys?.id);
    chain.unshift(parent);
    parent = parent.fields.parent;
  }
  return chain;
}

function hero(ctx, entry, title) {
  const f = entry.fields;
  const full = f.heroStyle === 'full';
  return html`
    <section class="hero hero--${full ? 'full' : 'compact'} hero--page theme-carbon" aria-labelledby="page-title"${full ? raw(' data-hero') : ''}>
      ${isEntry(f.heroImage) ? html`<div class="hero__media">${imageTag(ctx, f.heroImage, { w: 1920, className: 'hero__image', eager: true })}</div>` : ''}
      <div class="hero__content container">
        ${f.kicker ? html`<span class="eyebrow">${f.kicker}</span>` : ''}
        <h1 id="page-title" class="hero__title">${title}</h1>
      </div>
    </section>`;
}

/** Sub-navigation entries: the parent first, then siblings or children by order. */
function subNavItems(entry, data) {
  const parent = isEntry(entry.fields.parent) ? entry.fields.parent : null;
  const siblings = sortByOrder(present(data.siblings));
  const children = sortByOrder(present(data.children));
  if (parent && siblings.length) return [parent, ...siblings];
  if (children.length) return [entry, ...children];
  if (parent) return [parent, entry];
  return [];
}

const TITLE_SEPARATORS = [': ', '：'];

function subNav(ctx, entry, data) {
  const items = subNavItems(entry, data);
  if (items.length < 2) return '';
  const base = isEntry(entry.fields.parent) ? entry.fields.parent : entry;
  // a child title reads "Parent: Child"; Japanese titles use the full-width colon
  const prefixes = TITLE_SEPARATORS.map((separator) => `${base.fields.title}${separator}`);
  const nameOf = (page) => {
    const title = String(page.fields.title || '');
    const prefix = prefixes.find((candidate) => title.startsWith(candidate));
    return page !== base && prefix ? title.slice(prefix.length).replace(/^./, (ch) => ch.toUpperCase()) : title;
  };
  return html`
    <nav class="subnav subnav--page" aria-label="${ctx.t('sections_of', { title: base.fields.title })}">
      <div class="subnav__inner container">
        <ul class="subnav__list">
          ${items.map((page) => {
            const current = page.sys?.id === entry.sys?.id;
            return html`<li><a class="subnav__link" href="${ctx.routeFor(page)}"${current ? raw(' aria-current="page"') : ''}>${nameOf(page)}</a></li>`;
          })}
        </ul>
      </div>
    </nav>`;
}

/**
 * Shared by `page` and `home`. Options: `breadcrumbs` (default true) and
 * `title` (overrides the hero heading and document title source).
 */
export function renderPage(data, ctx, options = {}) {
  const entry = data.entry;
  const f = entry.fields;
  const title = options.title || f.title;
  if (options.head) options.head(entry);
  else applyHead(ctx, entry, { title: f.title });
  const trail = [
    { label: ctx.t('home'), href: ctx.href('#/') },
    ...parentChain(entry).map((page) => ({ label: page.fields.title, href: ctx.routeFor(page) })),
    { label: f.title },
  ];
  return html`
    ${options.breadcrumbs === false ? '' : html`<div class="container crumb-bar">${ctx.renderBreadcrumbs(trail, { lang: ctx.lang })}</div>`}
    ${hero(ctx, entry, title)}
    ${subNav(ctx, entry, data)}
    ${renderSections(f.sections, ctx, { latestStories: data.latestStories })}`;
}

export function render(data, ctx) {
  return renderPage(data, ctx);
}
