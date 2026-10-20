/**
 * Bootstrap for the McLaren-style demo site.
 *
 * This is the only module that touches `document`. It loads config, fetches
 * the site settings and vehicle categories, mounts the shell, wires up the
 * navigation, and dispatches hash routes to the render registry.
 */
import { createClient, assetUrl } from './js/cda.js';
import { matchRoute, loadRoute, onRouteChange, navigate, routeFor, linkHref } from './js/router.js';
import { renderRichText } from './js/richtext.js';
import {
  renderHeader,
  renderFooter,
  renderBreadcrumbs,
  renderLoading,
  renderError,
  renderNotFound,
} from './js/shell.js';
import { html, raw, escapeHtml } from './js/dom.js';
import { registry } from './js/render/index.js';

const mounts = {
  header: document.getElementById('header'),
  main: document.getElementById('main'),
  footer: document.getElementById('footer'),
};

const config = window.CONTENTFUL_CONFIG;
const state = { siteSettings: null, categories: [], requestId: 0 };

function setHead({ title, description } = {}) {
  const siteName = state.siteSettings?.fields?.siteName || 'McLaren';
  if (title !== undefined) {
    document.title = title && title !== siteName ? `${title} | ${siteName}` : siteName;
  }
  if (description !== undefined) {
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', description || '');
  }
}

function showMain(content) {
  mounts.main.innerHTML = String(content);
}

function closeMenus() {
  document.body.classList.remove('nav-open');
  for (const toggle of document.querySelectorAll('[data-nav-toggle], [data-dropdown-toggle]')) {
    toggle.setAttribute('aria-expanded', 'false');
  }
  for (const item of document.querySelectorAll('.has-dropdown.is-open')) item.classList.remove('is-open');
}

function bindShell() {
  document.addEventListener('click', (event) => {
    const navToggle = event.target.closest('[data-nav-toggle]');
    if (navToggle) {
      const open = !document.body.classList.contains('nav-open');
      document.body.classList.toggle('nav-open', open);
      navToggle.setAttribute('aria-expanded', String(open));
      if (!open) closeMenus();
      return;
    }
    const dropdownToggle = event.target.closest('[data-dropdown-toggle]');
    if (dropdownToggle) {
      const item = dropdownToggle.closest('.has-dropdown');
      const open = !item.classList.contains('is-open');
      for (const other of document.querySelectorAll('.has-dropdown.is-open')) {
        if (other !== item) {
          other.classList.remove('is-open');
          other.querySelector('[data-dropdown-toggle]')?.setAttribute('aria-expanded', 'false');
        }
      }
      item.classList.toggle('is-open', open);
      dropdownToggle.setAttribute('aria-expanded', String(open));
      return;
    }
    if (event.target.closest('[data-nav-close]')) {
      closeMenus();
      return;
    }
    if (!event.target.closest('.has-dropdown')) {
      for (const item of document.querySelectorAll('.has-dropdown.is-open')) {
        item.classList.remove('is-open');
        item.querySelector('[data-dropdown-toggle]')?.setAttribute('aria-expanded', 'false');
      }
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMenus();
  });
  window.addEventListener('hashchange', closeMenus);
}

function renderShell() {
  mounts.header.innerHTML = String(renderHeader(state.siteSettings, state.categories));
  mounts.footer.innerHTML = String(renderFooter(state.siteSettings));
  setHead({ title: '' });
}

function buildContext(cda, route) {
  return {
    siteSettings: state.siteSettings,
    categories: state.categories,
    cda,
    routeFor,
    linkHref,
    renderRichText,
    html,
    raw,
    escapeHtml,
    assetUrl,
    renderBreadcrumbs,
    setHead,
    route,
  };
}

function fallbackTitle(view, data) {
  const entry = data?.entry;
  if (entry?.fields) {
    return entry.fields.seo?.fields?.title || entry.fields.title || entry.fields.name || '';
  }
  if (view === 'retailers') return 'Retailers';
  if (view === 'notFound') return 'Page not found';
  return '';
}

async function handleRoute(route, cda) {
  const requestId = (state.requestId += 1);
  const isCurrent = () => requestId === state.requestId;
  showMain(renderLoading());
  try {
    const { view, data } = await loadRoute(route, cda);
    if (!isCurrent()) return;
    if (view === 'redirect') {
      navigate(data.to, { replace: true });
      return;
    }
    const renderer = registry[view] || registry.notFound || (() => renderNotFound(route));
    const titleBefore = document.title;
    showMain(renderer(data, buildContext(cda, route)));
    if (document.title === titleBefore) setHead({ title: fallbackTitle(view, data) });
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    mounts.main.focus({ preventScroll: true });
  } catch (error) {
    if (!isCurrent()) return;
    console.error(error);
    showMain(renderError(error));
    setHead({ title: 'Error' });
  }
}

async function boot() {
  if (!config || !config.spaceId || !config.deliveryToken) {
    mounts.header.innerHTML = String(renderHeader(null, []));
    showMain(
      renderError(
        'Missing configuration. Copy site/config.example.js to site/config.js, or run npm run build:site with CONTENTFUL_SPACE_ID and CONTENTFUL_DELIVERY_TOKEN set.',
        'The site does not know which Contentful space to read.',
      ),
    );
    return;
  }

  const cda = createClient(config);
  bindShell();

  const [settings, categories] = await Promise.allSettled([cda.getSiteSettings(), cda.getCategories()]);
  if (settings.status === 'fulfilled') state.siteSettings = settings.value;
  else console.warn('siteSettings unavailable:', settings.reason);
  if (categories.status === 'fulfilled') state.categories = categories.value;
  else console.warn('vehicleCategory entries unavailable:', categories.reason);

  renderShell();

  const dispatch = (route) => handleRoute(route, cda);
  onRouteChange(dispatch);
  dispatch(matchRoute(window.location.hash || '#/'));
}

boot().catch((error) => {
  console.error(error);
  showMain(renderError(error, 'The site failed to start.'));
});
