/**
 * Japanese (ja-JP) translation overlays, one file per seed group. Each overlay
 * maps entry ids to localized field values; see GLOSSARY.md for the format.
 */
import categories from './categories.js';
import enquiry from './enquiry.js';
import faqs from './faqs.js';
import highlights from './highlights.js';
import lineage from './lineage.js';
import links from './links.js';
import pages from './pages.js';
import retailers from './retailers.js';
import sections from './sections.js';
import site from './site.js';
import slides from './slides.js';
import specifications from './specifications.js';
import stories from './stories.js';
import vehicles from './vehicles.js';

export const JA_JP_BY_GROUP = { specifications, highlights, slides, lineage, faqs, categories, vehicles, links, sections, stories, pages, retailers, site, enquiry };

export const JA_JP = Object.assign({}, ...Object.values(JA_JP_BY_GROUP));
