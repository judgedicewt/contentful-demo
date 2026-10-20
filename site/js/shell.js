/**
 * Site shell: header, footer, breadcrumbs, and the loading / error / 404
 * panels. Every function returns HTML (a SafeHtml from `html`) and never
 * touches the DOM; app.js mounts the output and wires up interactions via
 * the `data-*` hooks below:
 *
 *   [data-nav-toggle]       hamburger; toggles `.nav-open` on <body>
 *   [data-dropdown-toggle]  opens the dropdown that follows it (aria-expanded)
 *   [data-nav-close]        closes the mobile menu
 */
import { html, raw } from './dom.js';
import { routeFor, linkHref, isExternalHref } from './router.js';

const MAX_INTRO = 90;

function truncate(text, max = MAX_INTRO) {
  const value = String(text || '').trim();
  if (value.length <= max) return value;
  return `${value.slice(0, max).replace(/\s+\S*$/, '')}…`;
}

function anchorAttrs(href) {
  return isExternalHref(href) ? raw(' rel="noopener" target="_blank"') : '';
}

/** A nav link entry rendered as an anchor. */
export function renderLink(link, className = '') {
  if (!link || !link.fields) return '';
  const href = linkHref(link);
  return html`<a href="${href}" class="${className}"${anchorAttrs(href)}>${link.fields.label}</a>`;
}

function isModelsLink(link) {
  const label = String(link?.fields?.label || '').trim().toLowerCase();
  if (label === 'models' || label === 'current models') return true;
  const target = link?.fields?.target;
  return Boolean(target && target.sys?.contentType?.sys?.id === 'vehicleCategory' && (link.fields.children || []).length);
}

function renderCategoryDropdown(id, categories) {
  return html`
    <div class="dropdown" id="${id}">
      <ul class="dropdown__list">
        ${categories.map(
          (category) => html`
            <li>
              <a href="${routeFor(category)}" class="dropdown__link">
                <span class="dropdown__title">${category.fields.name}</span>
                ${category.fields.intro ? html`<span class="dropdown__desc">${truncate(category.fields.intro)}</span>` : ''}
              </a>
            </li>`,
        )}
      </ul>
    </div>`;
}

function renderChildDropdown(id, children) {
  return html`
    <div class="dropdown" id="${id}">
      <ul class="dropdown__list">
        ${children.filter(Boolean).map(
          (child) => html`<li><a href="${linkHref(child)}" class="dropdown__link"><span class="dropdown__title">${child.fields?.label}</span></a></li>`,
        )}
      </ul>
    </div>`;
}

function renderNavItem(link, index, categories) {
  if (!link || !link.fields) return '';
  const models = isModelsLink(link);
  const children = (link.fields.children || []).filter(Boolean);
  const hasDropdown = (models && categories.length > 0) || children.length > 0;
  if (!hasDropdown) {
    return html`<li class="site-nav__item">${renderLink(link, 'site-nav__link')}</li>`;
  }
  const id = `nav-menu-${index}`;
  const dropdown = models && categories.length > 0 ? renderCategoryDropdown(id, categories) : renderChildDropdown(id, children);
  return html`
    <li class="site-nav__item has-dropdown">
      <button type="button" class="site-nav__link site-nav__button" aria-expanded="false" aria-controls="${id}" data-dropdown-toggle>
        ${link.fields.label}
        <span class="site-nav__caret" aria-hidden="true"></span>
      </button>
      ${dropdown}
    </li>`;
}

/** Header: wordmark, main navigation with Models dropdown, retailer link. */
export function renderHeader(siteSettings, categories = []) {
  const fields = siteSettings?.fields || {};
  const siteName = fields.siteName || 'McLaren';
  let navigation = (fields.mainNavigation || []).filter(Boolean);
  const cats = (categories || []).filter((category) => category && category.fields);
  if (navigation.length === 0 && cats.length > 0) {
    navigation = [{ fields: { label: 'Models', children: [] } }];
  }
  const retailer = fields.retailerLink;

  return html`
    <a class="skip-link" href="#main">Skip to content</a>
    <header class="site-header">
      <div class="site-header__inner">
        <a class="wordmark" href="#/" aria-label="${siteName} home">${siteName}</a>
        <button type="button" class="nav-toggle" aria-expanded="false" aria-controls="site-nav" data-nav-toggle>
          <span class="nav-toggle__bars" aria-hidden="true"></span>
          <span class="nav-toggle__label">Menu</span>
        </button>
        <nav class="site-nav" id="site-nav" aria-label="Main">
          <ul class="site-nav__list">
            ${navigation.map((link, index) => renderNavItem(link, index, cats))}
          </ul>
          ${retailer && retailer.fields
            ? html`<a href="${linkHref(retailer)}" class="site-nav__retailer"${anchorAttrs(linkHref(retailer))}>${retailer.fields.label}</a>`
            : ''}
        </nav>
      </div>
    </header>`;
}

function renderLinkGroup(group) {
  if (!group || !group.fields) return '';
  const links = (group.fields.links || []).filter(Boolean);
  return html`
    <div class="footer__group">
      <h2 class="footer__heading">${group.fields.heading}</h2>
      <ul class="footer__links">
        ${links.map((link) => html`<li>${renderLink(link, 'footer__link')}</li>`)}
      </ul>
    </div>`;
}

/** Footer: link groups, social links, newsletter text, legal links. */
export function renderFooter(siteSettings) {
  const fields = siteSettings?.fields || {};
  const siteName = fields.siteName || 'McLaren';
  const groups = (fields.footerGroups || []).filter(Boolean);
  const social = (fields.socialLinks || []).filter(Boolean);
  const legal = (fields.legalLinks || []).filter(Boolean);
  const year = new Date().getFullYear();

  return html`
    <footer class="site-footer">
      <div class="site-footer__inner">
        ${groups.length || social.length || fields.newsletterText
          ? html`
            <div class="footer__columns">
              ${groups.map(renderLinkGroup)}
              ${social.length
                ? html`
                  <div class="footer__group">
                    <h2 class="footer__heading">Follow us</h2>
                    <ul class="footer__links footer__social">
                      ${social.map((link) => html`<li>${renderLink(link, 'footer__link')}</li>`)}
                    </ul>
                  </div>`
                : ''}
              ${fields.newsletterText
                ? html`
                  <div class="footer__group footer__newsletter">
                    <h2 class="footer__heading">Subscribe</h2>
                    <p>${fields.newsletterText}</p>
                  </div>`
                : ''}
            </div>`
          : ''}
        <div class="footer__bottom">
          <p class="footer__copyright">&copy; ${String(year)} ${siteName}. ${fields.locale ? html`<span class="footer__locale">${fields.locale}</span>` : ''}</p>
          ${legal.length
            ? html`<ul class="footer__legal">${legal.map((link) => html`<li>${renderLink(link, 'footer__link')}</li>`)}</ul>`
            : ''}
          <p class="footer__note">Demo site. Content served from Contentful and rendered in the browser; imagery is placeholder artwork.</p>
        </div>
      </div>
    </footer>`;
}

/** Breadcrumb trail: `[{ label, href }]`, the last item is the current page. */
export function renderBreadcrumbs(trail = []) {
  const items = (trail || []).filter((item) => item && item.label);
  if (items.length === 0) return '';
  return html`
    <nav class="breadcrumbs" aria-label="Breadcrumb">
      <ol class="breadcrumbs__list">
        ${items.map((item, index) => {
          const last = index === items.length - 1;
          return last || !item.href
            ? html`<li class="breadcrumbs__item" aria-current="page">${item.label}</li>`
            : html`<li class="breadcrumbs__item"><a href="${item.href}">${item.label}</a></li>`;
        })}
      </ol>
    </nav>`;
}

/** Loading indicator for <main>. */
export function renderLoading(message = 'Loading') {
  return html`
    <div class="status status--loading" role="status" aria-live="polite">
      <span class="spinner" aria-hidden="true"></span>
      <span>${message}…</span>
    </div>`;
}

/** Readable error panel. */
export function renderError(error, context = 'Something went wrong while loading this page.') {
  const message = error instanceof Error ? error.message : String(error || 'Unknown error');
  return html`
    <section class="section">
      <div class="container">
        <div class="status status--error" role="alert">
          <p class="eyebrow">Error</p>
          <h1>Content unavailable</h1>
          <p>${context}</p>
          <pre class="status__detail">${message}</pre>
          <div class="btn-group"><a class="btn btn-secondary" href="#/">Back to home</a></div>
        </div>
      </div>
    </section>`;
}

/** 404 view. */
export function renderNotFound(route) {
  const path = route?.params?.slug || route?.params?.path || '';
  return html`
    <section class="section">
      <div class="container">
        <div class="status status--not-found">
          <p class="eyebrow">404</p>
          <h1>Page not found</h1>
          <p>${path ? html`Nothing is published at <code>/${path}</code>.` : 'Nothing is published at this address.'}</p>
          <div class="btn-group"><a class="btn btn-primary" href="#/">Back to home</a><a class="btn btn-secondary" href="#/current-models/supercars">Explore models</a></div>
        </div>
      </div>
    </section>`;
}
