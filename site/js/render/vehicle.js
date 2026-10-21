/**
 * Vehicle landing page. Order: hero, product sub-nav, statement, overview
 * carousel, in-detail tabs, specifications, performance, MSO banner,
 * lineage, related stories, FAQs. Only sections with data are rendered, so
 * legacy vehicles with a handful of fields still produce a clean page.
 */
import { html, raw } from '../dom.js';
import {
  anchor,
  applyHead,
  HERO_WIDTHS,
  imageTag,
  isEntry,
  paragraphs,
  present,
  richText,
  sortByOrder,
} from './common.js';
import { cardList, storyCard } from './cards.js';
import { render as renderBanner } from './bannerButton.js';

const SPEC_GROUPS = ['performance', 'powertrain', 'dimensions', 'weight'];
const AREAS = [
  ['exterior', 'Exterior'],
  ['interior', 'Interior'],
];

const label = (value) => String(value || '').replace(/^./, (ch) => ch.toUpperCase());

function breadcrumbs(ctx, entry) {
  const f = entry.fields;
  const legacy = f.status === 'legacy';
  const trail = [
    { label: 'Home', href: '#/' },
    legacy
      ? { label: 'Legacy', href: '#/legacy' }
      : { label: 'Current models', href: '#/current-models' },
  ];
  if (isEntry(f.category)) trail.push({ label: f.category.fields.name, href: ctx.routeFor(f.category) });
  trail.push({ label: f.name });
  return html`<div class="container crumb-bar">${ctx.renderBreadcrumbs(trail)}</div>`;
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

function subNav(ctx, entry, variants) {
  const f = entry.fields;
  const family = variantItems(entry, variants);
  const downloads = present(f.downloads).filter((asset) => ctx.assetUrl(asset));
  return html`
    <nav class="subnav subnav--product" aria-label="${f.name} navigation" data-compact-bar>
      <div class="subnav__inner container">
        <span class="subnav__title">${f.name}</span>
        <ul class="subnav__list">
          ${f.configureUrl ? html`<li>${anchor(f.configureUrl, 'btn btn-primary btn--sm', 'Configure')}</li>` : ''}
          ${f.enquiryUrl ? html`<li>${anchor(f.enquiryUrl, 'btn btn-secondary btn--sm', 'Enquire')}</li>` : ''}
          ${family.length > 1
            ? html`
              <li>
                <details class="subnav__menu" name="subnav-menu">
                  <summary class="subnav__summary">Change model variant</summary>
                  <ul class="subnav__panel">
                    ${family.map((item) => {
                      const current = item === entry || item.sys?.id === entry.sys?.id;
                      return html`<li><a href="${ctx.routeFor(item)}"${current ? raw(' aria-current="page"') : ''}>${item.fields.name}${current ? html` <span class="muted">(current)</span>` : ''}</a></li>`;
                    })}
                  </ul>
                </details>
              </li>`
            : ''}
          ${downloads.length
            ? html`
              <li>
                <details class="subnav__menu" name="subnav-menu">
                  <summary class="subnav__summary">Downloads</summary>
                  <ul class="subnav__panel">
                    ${downloads.map((asset) => html`<li><a href="${ctx.assetUrl(asset)}" target="_blank" rel="noopener">${asset.fields.title || 'Download'}</a></li>`)}
                  </ul>
                </details>
              </li>`
            : ''}
        </ul>
      </div>
    </nav>`;
}

function statement(entry) {
  const f = entry.fields;
  if (!f.statement) return '';
  return html`
    <section class="section statement theme-carbon">
      <div class="container container--narrow">
        <p class="statement__text" data-reveal>${f.statement}</p>
        ${f.filmUrl ? html`<div class="btn-group">${anchor(f.filmUrl, 'btn btn-secondary', 'Watch the film')}</div>` : ''}
      </div>
    </section>`;
}

function carousel(ctx, entry) {
  const slides = present(entry.fields.overviewSlides);
  if (!slides.length) return '';
  return html`
    <section class="section carousel theme-midnight" aria-roledescription="carousel" aria-label="Overview">
      <div class="container carousel__head">
        <h2 class="carousel__title" data-reveal>Overview</h2>
        <div class="carousel__controls">
          <button type="button" class="carousel__button" data-carousel-prev aria-label="Previous slide">&larr;</button>
          <button type="button" class="carousel__button" data-carousel-next aria-label="Next slide">&rarr;</button>
        </div>
      </div>
      <ul class="carousel__track" data-carousel-track tabindex="0" aria-label="Overview slides">
        ${slides.map(
          (slide, index) => html`
            <li class="carousel__slide" id="overview-slide-${String(index + 1)}" aria-label="Slide ${String(index + 1)} of ${String(slides.length)}">
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
  const areas = AREAS.map(([key, title]) => ({
    key,
    title,
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
          <h2 class="section__title" data-reveal>In detail</h2>
          <h3 class="eyebrow">${areas[0].title}</h3>
          ${panel(areas[0])}
        </div>
      </section>`;
  }
  return html`
    <section class="section in-detail theme-white">
      <div class="container">
        <h2 class="section__title" data-reveal>In detail</h2>
        <div class="tabs">
          <div class="tabs__group" role="radiogroup" aria-label="In detail">
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
        <h2 class="section__title" data-reveal>Specifications</h2>
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
              <summary class="spec-full__summary">Full specifications</summary>
              <table class="spec-table">
                <caption class="visually-hidden">${f.name} full specifications</caption>
                ${groups.map(
                  (group) => html`
                    <tbody>
                      <tr class="spec-table__group"><th scope="colgroup" colspan="2">${label(group.key)}</th></tr>
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
        <h2 class="section__title" data-reveal>Lineage</h2>
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
                    ? html`<a class="btn btn-text" href="${ctx.routeFor(l.vehicle)}">Explore the ${l.vehicle.fields.name}</a>`
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
        <h2 class="section__title" data-reveal>Related stories</h2>
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
        <h2 class="section__title" data-reveal>FAQs</h2>
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

export function render(data, ctx) {
  const entry = data.entry;
  const f = entry.fields;
  applyHead(ctx, entry, { title: f.name, description: f.shortDescription });
  const banner = isEntry(f.msoBanner) ? renderBanner(f.msoBanner, ctx) : '';
  return html`
    ${breadcrumbs(ctx, entry)}
    ${hero(ctx, entry)}
    ${subNav(ctx, entry, data.variants)}
    ${statement(entry)}
    ${carousel(ctx, entry)}
    ${inDetail(ctx, entry)}
    ${specifications(ctx, entry)}
    ${banner}
    ${lineage(ctx, entry)}
    ${relatedStories(ctx, entry)}
    ${faqs(ctx, entry)}`;
}
