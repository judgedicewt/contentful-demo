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
import { routeFor, linkHref, isExternalHref, withLang, hashForLang } from './router.js';
import { t, DEFAULT_LANG, LANGS, STRINGS } from './i18n.js';

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
export function renderLink(link, className = '', lang = DEFAULT_LANG) {
  if (!link || !link.fields) return '';
  const href = linkHref(link, lang);
  return html`<a href="${href}" class="${className}"${anchorAttrs(href)}>${link.fields.label}</a>`;
}

// the CMS label of the Models nav item, in every language the site speaks
const MODELS_LABELS = new Set(
  LANGS.flatMap((code) => [STRINGS[code].models, STRINGS[code].current_models]).map((label) => label.toLowerCase()),
);

function isModelsLink(link) {
  const label = String(link?.fields?.label || '').trim().toLowerCase();
  if (MODELS_LABELS.has(label)) return true;
  const target = link?.fields?.target;
  return Boolean(target && target.sys?.contentType?.sys?.id === 'vehicleCategory' && (link.fields.children || []).length);
}

function renderCategoryDropdown(id, categories, lang) {
  return html`
    <div class="dropdown" id="${id}">
      <ul class="dropdown__list">
        ${categories.map(
          (category) => html`
            <li>
              <a href="${routeFor(category, lang)}" class="dropdown__link">
                <span class="dropdown__title">${category.fields.name}</span>
                ${category.fields.intro ? html`<span class="dropdown__desc">${truncate(category.fields.intro)}</span>` : ''}
              </a>
            </li>`,
        )}
      </ul>
    </div>`;
}

function renderChildDropdown(id, children, lang) {
  return html`
    <div class="dropdown" id="${id}">
      <ul class="dropdown__list">
        ${children.filter(Boolean).map(
          (child) => html`<li><a href="${linkHref(child, lang)}" class="dropdown__link"><span class="dropdown__title">${child.fields?.label}</span></a></li>`,
        )}
      </ul>
    </div>`;
}

function renderNavItem(link, index, categories, lang) {
  if (!link || !link.fields) return '';
  const models = isModelsLink(link);
  const children = (link.fields.children || []).filter(Boolean);
  const hasDropdown = (models && categories.length > 0) || children.length > 0;
  if (!hasDropdown) {
    return html`<li class="site-nav__item">${renderLink(link, 'site-nav__link', lang)}</li>`;
  }
  const id = `nav-menu-${index}`;
  const dropdown = models && categories.length > 0 ? renderCategoryDropdown(id, categories, lang) : renderChildDropdown(id, children, lang);
  return html`
    <li class="site-nav__item has-dropdown">
      <button type="button" class="site-nav__link site-nav__button" aria-expanded="false" aria-controls="${id}" data-dropdown-toggle>
        ${link.fields.label}
        <span class="site-nav__caret" aria-hidden="true"></span>
      </button>
      ${dropdown}
    </li>`;
}

/** Language switcher: the current route in each language; the current one carries aria-current. */
function renderLangSwitch(lang, hash) {
  const link = (code, text) => html`<a href="${hashForLang(hash, code)}" hreflang="${code}" lang="${code}" data-lang-link="${code}"${lang === code ? raw(' aria-current="true"') : ''}>${text}</a>`;
  return html`<nav class="lang-switch" aria-label="${t('language', lang)}">${link('en', 'EN')}${link('ja', '日本語')}</nav>`;
}

/** Header: wordmark, main navigation with Models dropdown, retailer link, language switcher. */
export function renderHeader(siteSettings, categories = [], { lang = DEFAULT_LANG, hash = '#/' } = {}) {
  const fields = siteSettings?.fields || {};
  const siteName = fields.siteName || 'McLaren';
  let navigation = (fields.mainNavigation || []).filter(Boolean);
  const cats = (categories || []).filter((category) => category && category.fields);
  if (navigation.length === 0 && cats.length > 0) {
    navigation = [{ fields: { label: t('models', lang), children: [] } }];
  }
  const retailer = fields.retailerLink;

  return html`
    <a class="skip-link" href="#main">${t('skip_to_content', lang)}</a>
    <header class="site-header">
      <div class="site-header__inner">
        <a class="wordmark" href="${withLang('#/', lang)}" aria-label="${t('site_home', lang, { siteName })}">${siteName}</a>
        <button type="button" class="nav-toggle" aria-expanded="false" aria-controls="site-nav" data-nav-toggle>
          <span class="nav-toggle__bars" aria-hidden="true"></span>
          <span class="nav-toggle__label">${t('menu', lang)}</span>
        </button>
        <nav class="site-nav" id="site-nav" aria-label="${t('main_navigation', lang)}">
          <ul class="site-nav__list">
            ${navigation.map((link, index) => renderNavItem(link, index, cats, lang))}
          </ul>
          ${retailer && retailer.fields
            ? html`<a href="${linkHref(retailer, lang)}" class="site-nav__retailer"${anchorAttrs(linkHref(retailer, lang))}>${retailer.fields.label}</a>`
            : ''}
        </nav>
        ${renderLangSwitch(lang, hash)}
      </div>
    </header>`;
}

function renderLinkGroup(group, lang) {
  if (!group || !group.fields) return '';
  const links = (group.fields.links || []).filter(Boolean);
  return html`
    <div class="footer__group">
      <h2 class="footer__heading">${group.fields.heading}</h2>
      <ul class="footer__links">
        ${links.map((link) => html`<li>${renderLink(link, 'footer__link', lang)}</li>`)}
      </ul>
    </div>`;
}

/** Footer: link groups, social links, newsletter text, legal links. */
export function renderFooter(siteSettings, { lang = DEFAULT_LANG } = {}) {
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
              ${groups.map((group) => renderLinkGroup(group, lang))}
              ${social.length
                ? html`
                  <div class="footer__group">
                    <h2 class="footer__heading">${t('follow_us', lang)}</h2>
                    <ul class="footer__links footer__social">
                      ${social.map((link) => html`<li>${renderLink(link, 'footer__link', lang)}</li>`)}
                    </ul>
                  </div>`
                : ''}
              ${fields.newsletterText
                ? html`
                  <div class="footer__group footer__newsletter">
                    <h2 class="footer__heading">${t('subscribe', lang)}</h2>
                    <p>${fields.newsletterText}</p>
                  </div>`
                : ''}
            </div>`
          : ''}
        <div class="footer__bottom">
          <p class="footer__copyright">&copy; ${String(year)} ${siteName}. ${fields.locale ? html`<span class="footer__locale">${fields.locale}</span>` : ''}</p>
          ${legal.length
            ? html`<ul class="footer__legal">${legal.map((link) => html`<li>${renderLink(link, 'footer__link', lang)}</li>`)}</ul>`
            : ''}
          <p class="footer__note">${t('demo_footer_note', lang)}</p>
        </div>
      </div>
    </footer>`;
}

/** Breadcrumb trail: `[{ label, href }]`, the last item is the current page. */
export function renderBreadcrumbs(trail = [], { lang = DEFAULT_LANG } = {}) {
  const items = (trail || []).filter((item) => item && item.label);
  if (items.length === 0) return '';
  return html`
    <nav class="breadcrumbs" aria-label="${t('breadcrumb', lang)}">
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
export function renderError(error, context, { lang = DEFAULT_LANG } = {}) {
  const message = error instanceof Error ? error.message : String(error || t('unknown_error', lang));
  return html`
    <section class="section">
      <div class="container">
        <div class="status status--error" role="alert">
          <p class="eyebrow">${t('error', lang)}</p>
          <h1>${t('content_unavailable', lang)}</h1>
          <p>${context ?? t('error_context', lang)}</p>
          <pre class="status__detail">${message}</pre>
          <div class="btn-group"><a class="btn btn-secondary" href="${withLang('#/', lang)}">${t('back_to_home', lang)}</a></div>
        </div>
      </div>
    </section>`;
}

/** 404 view. */
export function renderNotFound(route) {
  const lang = route?.lang === 'ja' ? 'ja' : DEFAULT_LANG;
  const path = route?.params?.slug || route?.params?.path || '';
  return html`
    <section class="section">
      <div class="container">
        <div class="status status--not-found">
          <p class="eyebrow">404</p>
          <h1>${t('page_not_found', lang)}</h1>
          <p>${path ? t('nothing_published_at', lang, { path: html`<code>/${path}</code>` }) : t('nothing_published_here', lang)}</p>
          <div class="btn-group"><a class="btn btn-primary" href="${withLang('#/', lang)}">${t('back_to_home', lang)}</a><a class="btn btn-secondary" href="${withLang('#/current-models/supercars', lang)}">${t('explore_models', lang)}</a></div>
        </div>
      </div>
    </section>`;
}
