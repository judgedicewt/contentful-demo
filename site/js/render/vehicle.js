/**
 * Vehicle landing page. Order: hero, product sub-nav, statement, overview
 * carousel, in-detail tabs, specifications, performance, MSO banner,
 * lineage, related stories, FAQs. Only sections with data are rendered, so
 * legacy vehicles with a handful of fields still produce a clean page.
 */
import { attrs, html, raw } from '../dom.js';
import {
  anchor,
  applyHead,
  contentTypeOf,
  HERO_WIDTHS,
  imageSrc,
  imageSrcset,
  imageTag,
  isEntry,
  paragraphs,
  present,
  richText,
  sortByOrder,
} from './common.js';
import { cardList, storyCard } from './cards.js';
import { render as renderBanner } from './bannerButton.js';
import { STRINGS } from '../i18n.js';
import { renderSection } from './sections.js';
import { renderPersonalized } from './personalized.js';

const SPEC_GROUPS = ['performance', 'powertrain', 'dimensions', 'weight'];
const AREAS = ['exterior', 'interior'];

const capitalise = (value) => String(value || '').replace(/^./, (ch) => ch.toUpperCase());

/** Spec group heading: the dictionary entry when there is one, else the capitalised group (a custom CMS group). */
const groupLabel = (ctx, group) => (`spec_group_${group}` in STRINGS.en ? ctx.t(`spec_group_${group}`) : capitalise(group));

function breadcrumbs(ctx, entry) {
  const f = entry.fields;
  const legacy = f.status === 'legacy';
  const trail = [
    { label: ctx.t('home'), href: ctx.href('#/') },
    legacy
      ? { label: ctx.t('legacy'), href: ctx.href('#/legacy') }
      : { label: ctx.t('current_models'), href: ctx.href('#/current-models') },
  ];
  if (isEntry(f.category)) trail.push({ label: f.category.fields.name, href: ctx.routeFor(f.category) });
  trail.push({ label: f.name });
  return html`<div class="container crumb-bar">${ctx.renderBreadcrumbs(trail, { lang: ctx.lang })}</div>`;
}

function hero(ctx, entry) {
  const f = entry.fields;
  return html`
    <section class="hero hero--full hero--vehicle theme-carbon" aria-labelledby="vehicle-title" data-hero>
      ${isEntry(f.heroImage) ? html`<div class="hero__media">${imageTag(ctx, f.heroImage, { w: 1920, className: 'hero__image', eager: true, alt: '', widths: HERO_WIDTHS, sizes: '100vw' })}</div>` : ''}
      <div class="hero__content container">
        ${isEntry(f.category) ? html`<span class="eyebrow">${f.category.fields.name}</span>` : ''}
        <h1 id="vehicle-title" class="hero__title">${f.name}</h1>
        ${f.tagline ? html`<p class="hero__tagline lead">${f.tagline}</p>` : ''}
      </div>
    </section>`;
}

/**
 * Builds the variant menu: the family root, then the variants, then the
 * current entry as a fallback, deduplicated by `sys.id`.
 */
function variantItems(entry, variants) {
  const root = isEntry(entry.fields.parentModel) ? entry.fields.parentModel : entry;
  const seen = new Set();
  const items = [];
  for (const candidate of [root, ...present(variants), entry]) {
    if (!isEntry(candidate) || seen.has(candidate.sys?.id)) continue;
    seen.add(candidate.sys?.id);
    items.push(candidate);
  }
  return items;
}

/** A `link` entry as the enquire button, or '' for any other type. */
function renderCtaLink(link, ctx) {
  if (!isEntry(link) || contentTypeOf(link) !== 'link') return '';
  return anchor(ctx.linkHref(link), 'btn btn-secondary btn--sm', link.fields.label);
}

/**
 * The enquire slot. The `enquiryCta` link (directly or through a personalized
 * wrapper) replaces the button when it resolves. Otherwise the `enquiryUrl`
 * button is used, or nothing when that is unset.
 */
function enquiryItem(ctx, entry) {
  const f = entry.fields;
  if (isEntry(f.enquiryCta)) {
    const cta = f.enquiryCta;
    const markup = contentTypeOf(cta) === 'personalizedContent'
      ? renderPersonalized(cta, ctx, renderCtaLink)
      : renderCtaLink(cta, ctx);
    if (String(markup)) return html`<li>${markup}</li>`;
  }
  return f.enquiryUrl ? html`<li>${anchor(ctx.href(f.enquiryUrl), 'btn btn-secondary btn--sm', ctx.t('enquire'))}</li>` : '';
}

function subNav(ctx, entry, variants) {
  const f = entry.fields;
  const family = variantItems(entry, variants);
  const downloads = present(f.downloads).filter((asset) => ctx.assetUrl(asset));
  return html`
    <nav class="subnav subnav--product" aria-label="${ctx.t('vehicle_navigation', { name: f.name })}" data-compact-bar>
      <div class="subnav__inner container">
        <span class="subnav__title">${f.name}</span>
        <ul class="subnav__list">
          ${f.configureUrl ? html`<li>${anchor(ctx.href(f.configureUrl), 'btn btn-primary btn--sm', ctx.t('configure'))}</li>` : ''}
          ${enquiryItem(ctx, entry)}
          ${family.length > 1
            ? html`
              <li>
                <details class="subnav__menu" name="subnav-menu" data-variant-menu>
                  <summary class="subnav__summary">${ctx.t('change_model_variant')}</summary>
                  <ul class="subnav__panel">
                    ${family.map((item) => {
                      const current = item === entry || item.sys?.id === entry.sys?.id;
                      const heroData = !current && isEntry(item.fields.heroImage)
                        ? attrs({
                          'data-hero-srcset': imageSrcset(ctx, item.fields.heroImage, HERO_WIDTHS) || null,
                          'data-hero-src': imageSrc(ctx, item.fields.heroImage, 1920) || null,
                        })
                        : '';
                      return html`<li><a href="${ctx.routeFor(item)}"${current ? raw(' aria-current="page"') : ''}${heroData}>${item.fields.name}${current ? html` <span class="muted">${ctx.t('current')}</span>` : ''}</a></li>`;
                    })}
                  </ul>
                </details>
              </li>`
            : ''}
          ${downloads.length
            ? html`
              <li>
                <details class="subnav__menu" name="subnav-menu">
                  <summary class="subnav__summary">${ctx.t('downloads')}</summary>
                  <ul class="subnav__panel">
                    ${downloads.map((asset) => html`<li><a href="${ctx.assetUrl(asset)}" target="_blank" rel="noopener">${asset.fields.title || ctx.t('download')}</a></li>`)}
                  </ul>
                </details>
              </li>`
            : ''}
        </ul>
      </div>
    </nav>`;
}

function statement(ctx, entry) {
  const f = entry.fields;
  if (!f.statement) return '';
  return html`
    <section class="section statement theme-carbon">
      <div class="container container--narrow">
        <p class="statement__text" data-reveal>${f.statement}</p>
        ${f.filmUrl ? html`<div class="btn-group">${anchor(ctx.href(f.filmUrl), 'btn btn-secondary', ctx.t('watch_the_film'))}</div>` : ''}
      </div>
    </section>`;
}

function carousel(ctx, entry) {
  const slides = present(entry.fields.overviewSlides);
  if (!slides.length) return '';
  return html`
    <section class="section carousel theme-midnight" aria-roledescription="carousel" aria-label="${ctx.t('overview')}">
      <div class="container carousel__head">
        <h2 class="carousel__title" data-reveal>${ctx.t('overview')}</h2>
        <div class="carousel__controls">
          <button type="button" class="carousel__button" data-carousel-prev aria-label="${ctx.t('previous_slide')}">&larr;</button>
          <button type="button" class="carousel__button" data-carousel-next aria-label="${ctx.t('next_slide')}">&rarr;</button>
        </div>
      </div>
      <ul class="carousel__track" data-carousel-track tabindex="0" aria-label="${ctx.t('overview_slides')}">
        ${slides.map(
          (slide, index) => html`
            <li class="carousel__slide" id="overview-slide-${String(index + 1)}" aria-label="${ctx.t('slide_of', { index: String(index + 1), total: String(slides.length) })}">
              ${isEntry(slide.fields.media) ? html`<div class="carousel__media">${imageTag(ctx, slide.fields.media, { w: 1200, aspect: '16:9', focus: index % 2 ? 'right' : 'left' })}</div>` : ''}
              <div class="carousel__copy">
                <h3 class="carousel__heading">${slide.fields.heading}</h3>
                ${slide.fields.body ? html`<div class="carousel__body muted">${paragraphs(slide.fields.body)}</div>` : ''}
              </div>
            </li>`,
        )}
      </ul>
    </section>`;
}

// Exterior and interior shots share one source photo family; opposite focus keeps the crops distinct.
const HIGHLIGHT_FOCUS = { exterior: 'left', interior: 'right' };

function highlightItem(ctx, highlight) {
  const f = highlight.fields;
  return html`
    <li class="highlight" data-reveal>
      ${isEntry(f.image) ? html`<div class="highlight__media">${imageTag(ctx, f.image, { w: 800, aspect: '4:3', focus: HIGHLIGHT_FOCUS[f.area] || 'center' })}</div>` : ''}
      <div class="highlight__copy">
        ${f.tag ? html`<span class="eyebrow highlight__tag">${f.tag}</span>` : ''}
        <h3 class="highlight__title">${f.title}</h3>
        ${f.body ? html`<div class="highlight__body">${paragraphs(f.body)}</div>` : ''}
      </div>
    </li>`;
}

function inDetail(ctx, entry) {
  const highlights = present(entry.fields.highlights);
  const areas = AREAS.map((key) => ({
    key,
    title: ctx.t(key),
    items: highlights.filter((item) => item.fields.area === key),
  })).filter((area) => area.items.length);
  if (!areas.length) return '';
  const panel = (area) => html`
    <div class="tabs__panel tabs__panel--${area.key}">
      <ul class="highlights">${area.items.map((item) => highlightItem(ctx, item))}</ul>
    </div>`;
  if (areas.length === 1) {
    return html`
      <section class="section in-detail theme-white">
        <div class="container">
          <h2 class="section__title" data-reveal>${ctx.t('in_detail')}</h2>
          <h3 class="eyebrow">${areas[0].title}</h3>
          ${panel(areas[0])}
        </div>
      </section>`;
  }
  return html`
    <section class="section in-detail theme-white">
      <div class="container">
        <h2 class="section__title" data-reveal>${ctx.t('in_detail')}</h2>
        <div class="tabs">
          <div class="tabs__group" role="radiogroup" aria-label="${ctx.t('in_detail')}">
            ${areas.map(
              (area, index) =>
                html`<input class="tabs__radio" type="radio" name="detail-area" id="detail-tab-${area.key}"${index === 0 ? raw(' checked') : ''}>`,
            )}
            <div class="tabs__list">
              ${areas.map((area) => html`<label class="tabs__tab tabs__tab--${area.key}" for="detail-tab-${area.key}">${area.title}</label>`)}
            </div>
          </div>
          ${areas.map(panel)}
        </div>
      </div>
    </section>`;
}

function specValue(spec) {
  const f = spec.fields;
  return html`${f.value}${f.unit ? html`<small class="spec-tile__unit">${f.unit}</small>` : ''}`;
}

function specifications(ctx, entry) {
  const f = entry.fields;
  const specs = present(f.specifications);
  const featured = specs.filter((spec) => spec.fields.featured === true);
  const groups = [];
  for (const key of [...SPEC_GROUPS, ...specs.map((spec) => spec.fields.group)]) {
    if (!key || groups.some((group) => group.key === key)) continue;
    const rows = sortByOrder(specs.filter((spec) => spec.fields.group === key));
    if (rows.length) groups.push({ key, rows });
  }
  const hasPerformance = f.performanceHeading || f.performanceBody;
  if (!featured.length && !groups.length && !hasPerformance) return '';
  return html`
    <section class="section specs theme-carbon">
      <div class="container">
        <h2 class="section__title" data-reveal>${ctx.t('specifications')}</h2>
        ${featured.length
          ? html`
            <ul class="spec-tiles" data-reveal>
              ${featured.map(
                (spec) => html`
                  <li class="spec-tile">
                    <span class="eyebrow spec-tile__label">${spec.fields.label}</span>
                    <span class="spec-tile__value">${specValue(spec)}</span>
                  </li>`,
              )}
            </ul>`
          : ''}
        ${groups.length
          ? html`
            <details class="spec-full" data-reveal>
              <summary class="spec-full__summary">${ctx.t('full_specifications')}</summary>
              <table class="spec-table">
                <caption class="visually-hidden">${f.name} ${ctx.t('full_specifications').toLowerCase()}</caption>
                ${groups.map(
                  (group) => html`
                    <tbody>
                      <tr class="spec-table__group"><th scope="colgroup" colspan="2">${groupLabel(ctx, group.key)}</th></tr>
                      ${group.rows.map(
                        (spec) => html`<tr><th scope="row">${spec.fields.label}</th><td>${spec.fields.value}${spec.fields.unit ? html` <span class="muted">${spec.fields.unit}</span>` : ''}</td></tr>`,
                      )}
                    </tbody>`,
                )}
              </table>
            </details>`
          : ''}
        ${hasPerformance
          ? html`
            <div class="performance">
              ${f.performanceHeading ? html`<h3 class="performance__title">${f.performanceHeading}</h3>` : ''}
              ${f.performanceBody ? html`<div class="performance__body muted">${paragraphs(f.performanceBody)}</div>` : ''}
            </div>`
          : ''}
      </div>
    </section>`;
}

function lineage(ctx, entry) {
  const f = entry.fields;
  const items = present(f.lineage);
  if (!items.length) return '';
  return html`
    <section class="section lineage theme-mist">
      <div class="container">
        <h2 class="section__title" data-reveal>${ctx.t('lineage')}</h2>
        ${f.lineageIntro ? html`<div class="lineage__intro lead">${paragraphs(f.lineageIntro)}</div>` : ''}
        <ol class="timeline">
          ${items.map((item) => {
            const l = item.fields;
            return html`
              <li class="timeline__item" data-reveal>
                <span class="timeline__year">${String(l.year ?? '')}</span>
                <div class="timeline__body">
                  <h3 class="timeline__title">${l.title}</h3>
                  ${l.body ? html`<div class="timeline__text muted">${paragraphs(l.body)}</div>` : ''}
                  ${isEntry(l.vehicle)
                    ? html`<a class="btn btn-text" href="${ctx.routeFor(l.vehicle)}">${ctx.t('explore_the', { name: l.vehicle.fields.name })}</a>`
                    : ''}
                </div>
                ${isEntry(l.image) ? html`<div class="timeline__media">${imageTag(ctx, l.image, { w: 600, aspect: '3:4', focus: 'left' })}</div>` : ''}
              </li>`;
          })}
        </ol>
      </div>
    </section>`;
}

function relatedStories(ctx, entry) {
  const stories = present(entry.fields.relatedStories);
  if (!stories.length) return '';
  return html`
    <section class="section story-grid theme-white">
      <div class="container">
        <h2 class="section__title" data-reveal>${ctx.t('related_stories')}</h2>
        ${cardList(stories.map((story) => storyCard(ctx, story)))}
      </div>
    </section>`;
}

function faqs(ctx, entry) {
  const items = present(entry.fields.faqs);
  if (!items.length) return '';
  return html`
    <section class="section faqs theme-carbon">
      <div class="container container--narrow">
        <h2 class="section__title" data-reveal>${ctx.t('faqs')}</h2>
        <div class="faq-list" data-reveal>
          ${items.map(
            (item) => html`
              <details class="faq">
                <summary class="faq__question">${item.fields.question}</summary>
                <div class="faq__answer richtext">${richText(ctx, item.fields.answer)}</div>
              </details>`,
          )}
        </div>
      </div>
    </section>`;
}

/** The MSO banner. A personalized wrapper resolves per audience; a bannerButton renders as before. */
function msoBanner(ctx, entry) {
  const banner = entry.fields.msoBanner;
  if (!isEntry(banner)) return '';
  return contentTypeOf(banner) === 'personalizedContent'
    ? renderPersonalized(banner, ctx, renderSection)
    : renderBanner(banner, ctx);
}

export function render(data, ctx) {
  const entry = data.entry;
  const f = entry.fields;
  applyHead(ctx, entry, { title: f.name, description: f.shortDescription });
  return html`
    ${breadcrumbs(ctx, entry)}
    ${hero(ctx, entry)}
    ${subNav(ctx, entry, data.variants)}
    ${statement(ctx, entry)}
    ${carousel(ctx, entry)}
    ${inDetail(ctx, entry)}
    ${specifications(ctx, entry)}
    ${msoBanner(ctx, entry)}
    ${lineage(ctx, entry)}
    ${relatedStories(ctx, entry)}
    ${faqs(ctx, entry)}`;
}
