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
import {
  matchRoute,
  loadRoute,
  onRouteChange,
  navigate,
  routeFor,
  linkHref,
  withLang,
  hashForLang,
} from './js/router.js';
import { t, LOCALES } from './js/i18n.js';
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
import { createLocalProvider, createResolver } from './js/audience.js';
import { load, recordBoot, recordView, setOverrides, reset, viewFrom } from './js/signals.js';
import { initPanel } from './js/panel.js';
import { isFamilySwitch, SPINNER_DELAY_MS, HERO_DECODE_CAP_MS } from './js/swap.js';

const mounts = {
  header: document.getElementById('header'),
  main: document.getElementById('main'),
  footer: document.getElementById('footer'),
};

const config = window.CONTENTFUL_CONFIG;
/** The client without a locale; `clientFor` derives the locale-bound clients from it. */
let rootClient = null;
const state = {
  /** The language the shell is rendered in, or null before the first render. */
  lang: null,
  /** The locale-bound client in use. */
  client: null,
  siteSettings: null,
  categories: [],
  /** Audience entries from the Delivery API, or an empty list when the fetch failed. */
  audiences: [],
  /** True when the audience fetch failed. Every render then shows defaults. */
  audiencesFailed: false,
  /** Resolves a visitor profile to audience keys, or null before the audiences load. */
  resolver: null,
  /** The audience keys used for the latest render. */
  matched: new Set(),
  requestId: 0,
  headSet: false,
  cancelPrefetch: () => {},
  /** The last view shown, as `{ view, data, route }`, or null before the first view and after an error. */
  current: null,
  /** The demo panel controller, or null before boot mounts it. */
  panel: null,
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

/** The shared-cache client bound to the Contentful locale for `lang`. */
function clientFor(lang) {
  return rootClient.forLocale(LOCALES[lang]);
}

function renderShell(hash) {
  mounts.header.innerHTML = String(renderHeader(state.siteSettings, state.categories, { lang: state.lang, hash }));
  mounts.footer.innerHTML = String(renderFooter(state.siteSettings, { lang: state.lang }));
  setHead({ title: '' });
}

let shellRequest = 0;

/**
 * Makes the header and footer match `lang`. Does nothing when the shell is
 * already in that language. Otherwise it loads the site settings and
 * categories in that language, then renders the shell. If a newer call starts
 * while this one loads, this one leaves the shell to the newer call.
 */
async function ensureShell(lang, hash) {
  const request = (shellRequest += 1);
  if (lang === state.lang) return;
  const client = clientFor(lang);
  const [settings, categories] = await Promise.allSettled([client.getSiteSettings(), client.getCategories()]);
  if (request !== shellRequest) return;
  if (settings.status === 'fulfilled') state.siteSettings = settings.value;
  else console.warn('siteSettings unavailable:', settings.reason);
  if (categories.status === 'fulfilled') state.categories = categories.value;
  else console.warn('vehicleCategory entries unavailable:', categories.reason);
  state.lang = lang;
  state.client = client;
  document.documentElement.lang = lang;
  renderShell(hash);
}

/** Points each language switcher link at the current route in its language. */
function updateLangLinks(hash) {
  for (const link of document.querySelectorAll('[data-lang-link]')) {
    link.setAttribute('href', hashForLang(hash, link.dataset.langLink));
  }
}

/**
 * Audience keys for one render, computed from the current profile. A failed
 * audience fetch gives an empty set, so defaults render even when the stored
 * profile has overrides.
 */
function matchAudiences() {
  if (state.audiencesFailed || !state.resolver) return new Set();
  return state.resolver.audiencesFor(load());
}

function buildContext(client, route) {
  const lang = route.lang;
  const audiences = matchAudiences();
  state.matched = audiences;
  return {
    siteSettings: state.siteSettings,
    categories: state.categories,
    cda: client,
    lang,
    locale: LOCALES[lang],
    t: (key, vars) => t(key, lang, vars),
    href: (hash) => withLang(hash, lang),
    routeFor: (entry) => routeFor(entry, lang),
    linkHref: (link) => linkHref(link, lang),
    renderRichText,
    html,
    raw,
    escapeHtml,
    assetUrl,
    renderBreadcrumbs,
    setHead,
    route,
    audiences,
  };
}

function fallbackTitle(view, data, lang) {
  const entry = data?.entry;
  if (entry?.fields) {
    return entry.fields.seo?.fields?.title || entry.fields.title || entry.fields.name || '';
  }
  if (view === 'retailers') return t('retailers', lang);
  if (view === 'notFound') return t('page_not_found', lang);
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

/**
 * Shows `route` in the route's language. The optional `preloaded` argument is
 * a promise from `loadRoute(route, clientFor(route.lang))` that the caller
 * started earlier, so the load can overlap other work.
 */
async function handleRoute(route, preloaded) {
  // In-page anchors are not routes: keep the current view.
  if (route.name === 'ignore') return;
  const lang = route.lang;
  const hash = routeHash(window.location.hash);
  const client = clientFor(lang);
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
      showMain(renderLoading(t('loading', lang)));
    }
  }, SPINNER_DELAY_MS);
  try {
    // Start loading the content now so it overlaps the shell, which may need its own requests.
    const loading = preloaded || loadRoute(route, client);
    loading.catch(() => {});
    await ensureShell(lang, hash);
    if (!isCurrent()) return;
    const { view, data } = await loading;
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
    const content = renderer(data, buildContext(client, route));
    if (inPlace) {
      // The swap yields, so a newer navigation may take over. It then skips the swap.
      if (!(await swapInPlace(content, isCurrent))) return;
    } else {
      showMain(content, { motion: true });
    }
    state.cancelPrefetch();
    state.cancelPrefetch = view === 'vehicle' ? prefetchFamily(client, data) : () => {};
    if (!state.headSet) setHead({ title: fallbackTitle(view, data, lang) });
    updateLangLinks(hash);
    if (!inPlace) window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    mounts.main.focus({ preventScroll: true });
    state.current = { view, data, route };
    // Record the view only now: a superseded or failed request returned or threw above.
    // Recording never starts a render, so the next route sees the updated profile.
    // A failure here must not replace the rendered page, so it only logs.
    try {
      const seen = viewFrom(view, data);
      if (seen) recordView(seen);
      state.panel?.refresh();
    } catch (recordError) {
      console.warn('view recording or panel refresh failed:', recordError);
    }
  } catch (error) {
    if (!isCurrent()) return;
    console.error(error);
    state.current = null;
    showMain(renderError(error, undefined, { lang }));
    setHead({ title: t('error', lang) });
    updateLangLinks(hash);
  } finally {
    clearTimeout(spinner);
    // A newer request owns the indicator, and clears it when it finishes.
    if (isCurrent()) {
      mounts.main.removeAttribute('aria-busy');
      document.body.classList.remove('is-loading');
    }
  }
}

/**
 * Renders the current route again in place, for example after a demo panel
 * control changes the profile. It reuses the loaded data and never records a
 * view, scrolls, moves focus or prefetches. It does not bump the request id,
 * so a navigation already in flight is not cancelled, and a navigation that
 * starts later skips this swap.
 */
async function rerenderCurrent() {
  const current = state.current;
  if (!current) return;
  const requestId = state.requestId;
  const isCurrent = () => requestId === state.requestId;
  const renderer = registry[current.view] || registry.notFound || (() => renderNotFound(current.route));
  const content = renderer(current.data, buildContext(clientFor(current.route.lang), current.route));
  await swapInPlace(content, isCurrent);
}

/** Route for a location hash; in-page anchors (`#main`) fall back to the home route. */
function routeFromHash(hash) {
  const matched = matchRoute(hash);
  return matched.name === 'ignore' ? matchRoute('#/') : matched;
}

/** The hash to build language links from: in-page anchors (`#main`) count as the home route. */
function routeHash(hash) {
  const value = hash || '#/';
  return matchRoute(value).name === 'ignore' ? '#/' : value;
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

  rootClient = createClient(config);
  bindShell();
  // Record the campaign and visit count before the first route loads, so the first render sees them.
  recordBoot(window.location, navigator);

  // Start loading the first route now, so it overlaps the site settings and categories requests.
  const initialHash = window.location.hash || '#/';
  const initial = routeFromHash(initialHash);
  const preloaded = loadRoute(initial, clientFor(initial.lang));
  // handleRoute awaits this later; mark it handled so an early failure is not reported as unhandled.
  preloaded.catch(() => {});

  // Audiences come through the same locale-bound client the first route uses, so they share its cache.
  const audiencesLoading = Promise.allSettled([clientFor(initial.lang).getAudiences()]);

  await ensureShell(initial.lang, routeHash(initialHash));

  const [audiences] = await audiencesLoading;
  if (audiences.status === 'fulfilled') {
    state.audiences = audiences.value;
  } else {
    console.warn('audiences unavailable:', audiences.reason);
    state.audiencesFailed = true;
  }
  state.resolver = createResolver({ providers: [createLocalProvider(state.audiences)] });

  const mount = document.createElement('div');
  mount.id = 'demo-panel';
  document.body.append(mount);
  state.panel = initPanel({
    mount,
    location: window.location,
    storage: () => window.sessionStorage,
    keydownTarget: document,
    signals: { load, setOverrides, reset },
    getModel: () => ({ profile: load(), audiences: state.audiences, matched: state.matched, unavailable: state.audiencesFailed }),
    rerender: () => rerenderCurrent(),
  });

  onRouteChange(handleRoute);
  // The hash may have changed while the shell loaded, before the listener existed. Then discard the preload.
  const currentHash = window.location.hash || '#/';
  if (currentHash === initialHash) {
    handleRoute(initial, preloaded);
  } else {
    handleRoute(routeFromHash(currentHash));
  }
}

boot().catch((error) => {
  console.error(error);
  showMain(renderError(error, 'The site failed to start.'));
});
