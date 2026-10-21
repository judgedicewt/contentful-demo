/**
 * Bootstrap for the McLaren-style demo site.
 *
 * This is the only module that touches `document`. It loads config, fetches
 * the site settings and vehicle categories, mounts the shell, wires up the
 * navigation, and dispatches hash routes to the render registry.
 *
 * A route change within one vehicle family (a parent and its variants) updates
 * the page in place: no loading state, no scroll reset, and a crossfade when the
 * browser supports view transitions. Any other route replaces the page, and its
 * loading indicator only appears if loading takes longer than SPINNER_DELAY_MS.
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
import { initMotion } from './js/motion.js';
import { initEnquiry } from './js/enquiry.js';
import { prefetchFamily, warmHeroImages } from './js/prefetch.js';
import { isFamilySwitch, SPINNER_DELAY_MS, HERO_DECODE_CAP_MS } from './js/swap.js';

const mounts = {
  header: document.getElementById('header'),
  main: document.getElementById('main'),
  footer: document.getElementById('footer'),
};

const config = window.CONTENTFUL_CONFIG;
const state = {
  siteSettings: null,
  categories: [],
  requestId: 0,
  headSet: false,
  cancelPrefetch: () => {},
  /** The last view shown, as `{ view, data }`, or null before the first view and after an error. */
  current: null,
};

function setHead({ title, description } = {}) {
  state.headSet = true;
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

let teardownMotion = () => {};
let teardownEnquiry = () => {};

/** Replaces the main content. Behaviour bound to the old content is torn down first. */
function showMain(content, { motion = false } = {}) {
  teardownMotion();
  teardownMotion = () => {};
  teardownEnquiry();
  teardownEnquiry = () => {};
  mounts.main.innerHTML = String(content);
  if (motion) {
    teardownMotion = initMotion(mounts.main);
    teardownEnquiry = initEnquiry(mounts.main);
  }
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
    // The skip link must not touch the hash (the router would treat `#main` as a page).
    if (event.target.closest('.skip-link')) {
      event.preventDefault();
      if (!mounts.main.hasAttribute('tabindex')) mounts.main.setAttribute('tabindex', '-1');
      mounts.main.focus();
      return;
    }
    const navToggle = event.target.closest('[data-nav-toggle]');
    if (navToggle) {
      const open = !document.body.classList.contains('nav-open');
      document.body.classList.toggle('nav-open', open);
      navToggle.setAttribute('aria-expanded', String(open));
      if (!open) closeMenus();
      return;
    }
    // Tapping a nav link to the current route fires no hashchange, so close here.
    if (event.target.closest('.site-nav a')) closeMenus();
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
    if (event.key !== 'Escape') return;
    // Return focus to the toggle that owns the open dropdown (or the mobile menu button).
    const openItem = document.querySelector('.has-dropdown.is-open');
    const menuOpen = document.body.classList.contains('nav-open');
    const toggle = openItem
      ? openItem.querySelector('[data-dropdown-toggle]')
      : menuOpen
        ? document.querySelector('[data-nav-toggle]')
        : null;
    closeMenus();
    toggle?.focus();
  });
  window.addEventListener('hashchange', closeMenus);
  // The toggle event does not bubble, so listen in the capture phase.
  document.addEventListener(
    'toggle',
    (event) => {
      const menu = event.target;
      if (menu?.matches?.('details[data-variant-menu]') && menu.open) warmHeroImages(menu);
    },
    true,
  );
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

function prefersReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** Resolves once the hero image in `markup` has decoded, or after HERO_DECODE_CAP_MS. */
function waitForHero(markup) {
  const template = document.createElement('template');
  template.innerHTML = markup;
  const hero = template.content.querySelector('.hero__image');
  if (!hero) return Promise.resolve();
  const img = new Image();
  if (hero.getAttribute('sizes')) img.sizes = hero.getAttribute('sizes');
  if (hero.getAttribute('srcset')) img.srcset = hero.getAttribute('srcset');
  img.src = hero.getAttribute('src');
  const decoded = img.decode().catch(() => {});
  const capped = new Promise((resolve) => setTimeout(resolve, HERO_DECODE_CAP_MS));
  return Promise.race([decoded, capped]);
}

/**
 * Replaces the main content without a loading state, crossfading when the
 * browser can. Returns false, leaving the page untouched, when `isCurrent`
 * reports that a newer navigation has taken over.
 */
async function swapInPlace(content, isCurrent) {
  const markup = String(content);
  await waitForHero(markup);
  if (!isCurrent()) return false;
  let applied = false;
  const apply = () => {
    // The view transition runs this callback asynchronously, so check again.
    if (!isCurrent()) return;
    showMain(markup, { motion: true });
    applied = true;
  };
  if (typeof document.startViewTransition === 'function' && !prefersReducedMotion()) {
    await document.startViewTransition(apply).updateCallbackDone;
  } else {
    apply();
  }
  return applied;
}

async function handleRoute(route, cda) {
  // In-page anchors are not routes: keep the current view.
  if (route.name === 'ignore') return;
  const requestId = (state.requestId += 1);
  const isCurrent = () => requestId === state.requestId;
  // A vehicle page that may be followed by another vehicle keeps its content
  // while loading, so a slow load never collapses the page or resets the scroll.
  const keepContent = state.current?.view === 'vehicle' && route.name === 'page';
  // Fast loads never show a loading indicator.
  const spinner = setTimeout(() => {
    if (!isCurrent()) return;
    if (keepContent) {
      mounts.main.setAttribute('aria-busy', 'true');
      document.body.classList.add('is-loading');
    } else {
      showMain(renderLoading());
    }
  }, SPINNER_DELAY_MS);
  try {
    const { view, data } = await loadRoute(route, cda);
    // Loading is done: the hero wait below must not trigger the indicator.
    clearTimeout(spinner);
    if (!isCurrent()) return;
    if (view === 'redirect') {
      navigate(data.to, { replace: true });
      return;
    }
    const inPlace = isFamilySwitch(state.current, { view, data });
    const renderer = registry[view] || registry.notFound || (() => renderNotFound(route));
    state.headSet = false;
    const content = renderer(data, buildContext(cda, route));
    if (inPlace) {
      // The swap yields, so a newer navigation may take over. It then skips the swap.
      if (!(await swapInPlace(content, isCurrent))) return;
    } else {
      showMain(content, { motion: true });
    }
    state.cancelPrefetch();
    state.cancelPrefetch = view === 'vehicle' ? prefetchFamily(cda, data) : () => {};
    if (!state.headSet) setHead({ title: fallbackTitle(view, data) });
    if (!inPlace) window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    mounts.main.focus({ preventScroll: true });
    state.current = { view, data };
  } catch (error) {
    if (!isCurrent()) return;
    console.error(error);
    state.current = null;
    showMain(renderError(error));
    setHead({ title: 'Error' });
  } finally {
    clearTimeout(spinner);
    // A newer request owns the indicator, and clears it when it finishes.
    if (isCurrent()) {
      mounts.main.removeAttribute('aria-busy');
      document.body.classList.remove('is-loading');
    }
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
  const initial = matchRoute(window.location.hash || '#/');
  dispatch(initial.name === 'ignore' ? matchRoute('#/') : initial);
}

boot().catch((error) => {
  console.error(error);
  showMain(renderError(error, 'The site failed to start.'));
});
