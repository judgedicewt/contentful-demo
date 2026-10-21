/**
 * Content model provisioned by `npm run setup`.
 *
 * Source of truth: docs/plans/2026-10-20-mclaren-schema-design.md, section
 * "Content model". Each content type's `description` carries the McLaren
 * component code it maps to where the design lists one.
 *
 * The array is in dependency order (types referenced by link validations
 * come first where the graph allows it). The model contains cycles
 * (link -> page -> bannerButton -> link, vehicle -> story -> vehicle), so
 * setup provisions in two passes: create/update every type, then publish
 * every type.
 */

/** The default locale of the space. Every field value is written under it. */
export const DEFAULT_LOCALE = 'en-US';

/** Locales added to the space besides the default. Created by setup if missing. */
export const LOCALES = [
  { code: 'ja-JP', name: 'Japanese (Japan)', fallbackCode: 'en-US', optional: true, contentDeliveryApi: true, contentManagementApi: true },
];

/** A URL-ish string: absolute http(s), root-relative, hash route, mailto or tel. */
export const URL_PATTERN = '^(https?://[^\\s]+|/[^\\s]*|#/[^\\s]*|mailto:[^\\s]+|tel:[^\\s]+)$';

const urlValidation = {
  regexp: { pattern: URL_PATTERN },
  message: 'Must be an absolute http(s) URL, a root-relative path, a #/ route, or a mailto:/tel: link.',
};

const imageAsset = (id, name, extra = {}) => ({
  id,
  name,
  type: 'Link',
  linkType: 'Asset',
  validations: [{ linkMimetypeGroup: ['image'] }],
  ...extra,
});

const entryLink = (id, name, contentTypes, extra = {}) => ({
  id,
  name,
  type: 'Link',
  linkType: 'Entry',
  validations: [{ linkContentType: contentTypes }],
  ...extra,
});

const entryLinks = (id, name, contentTypes, extra = {}) => ({
  id,
  name,
  type: 'Array',
  items: { type: 'Link', linkType: 'Entry', validations: [{ linkContentType: contentTypes }] },
  ...extra,
});

const symbolIn = (id, name, values, extra = {}) => ({
  id,
  name,
  type: 'Symbol',
  validations: [{ in: values }],
  ...extra,
});

const defaultValue = (value) => ({ defaultValue: { [DEFAULT_LOCALE]: value } });

const SECTION_TYPES = ['textBlock', 'imageBlock', 'bannerButton', 'cardGrid', 'vehicleGrid', 'storyGrid', 'ctaGroup'];
const STORY_SECTION_TYPES = ['textBlock', 'imageBlock', 'ctaGroup'];
const LINK_TARGET_TYPES = ['page', 'vehicle', 'vehicleCategory', 'story'];

export const CONTENT_TYPES = [
  {
    id: 'seoMetadata',
    name: 'SEO metadata',
    description: 'Search and social metadata attached to a page, vehicle, category or story.',
    displayField: 'title',
    fields: [
      { id: 'title', name: 'Title', type: 'Symbol', required: true, validations: [{ size: { max: 120 } }], localized: true },
      { id: 'description', name: 'Description', type: 'Text', validations: [{ size: { max: 320 } }], localized: true },
      imageAsset('ogImage', 'Open Graph image'),
      { id: 'noIndex', name: 'No index', type: 'Boolean', ...defaultValue(false) },
    ],
  },
  {
    id: 'link',
    name: 'Link',
    description:
      'A labelled pointer used for navigation and CTAs. Points at an internal entry via target, or at externalUrl when target is empty.',
    displayField: 'label',
    fields: [
      { id: 'label', name: 'Label', type: 'Symbol', required: true, validations: [{ size: { max: 80 } }], localized: true },
      entryLink('target', 'Target', LINK_TARGET_TYPES),
      { id: 'externalUrl', name: 'External URL', type: 'Symbol', validations: [urlValidation] },
      symbolIn('style', 'Style', ['primary', 'secondary', 'text'], defaultValue('text')),
      entryLinks('children', 'Children', ['link']),
    ],
  },
  {
    id: 'linkGroup',
    name: 'Link group',
    description: 'A footer column or sub-navigation group: a heading with an ordered list of links.',
    displayField: 'heading',
    fields: [
      { id: 'heading', name: 'Heading', type: 'Symbol', required: true, localized: true },
      entryLinks('links', 'Links', ['link']),
    ],
  },
  {
    id: 'bannerButton',
    name: 'Banner with button',
    description:
      'componentCode: c002-banner-button. Full-width banner with eyebrow, heading, body, image and one CTA. Also used as the VLP mso banner.',
    displayField: 'heading',
    fields: [
      { id: 'eyebrow', name: 'Eyebrow', type: 'Symbol', localized: true },
      { id: 'heading', name: 'Heading', type: 'Symbol', required: true, localized: true },
      { id: 'body', name: 'Body', type: 'Text', localized: true },
      imageAsset('image', 'Image'),
      entryLink('cta', 'CTA', ['link']),
      symbolIn('theme', 'Theme', ['carbon', 'colnbrook', 'white'], defaultValue('carbon')),
    ],
  },
  {
    id: 'vehicleCategory',
    name: 'Vehicle category',
    description:
      'componentCode: t002-header (intro). A category tab on /current-models: Supercars, Grand Tourers, Hypercars, Motorsport. Vehicles are queried by category, not curated.',
    displayField: 'name',
    fields: [
      { id: 'name', name: 'Name', type: 'Symbol', required: true, localized: true },
      {
        id: 'slug',
        name: 'Slug',
        type: 'Symbol',
        required: true,
        validations: [{ unique: true }, { regexp: { pattern: '^[a-z0-9]+(-[a-z0-9]+)*$' } }],
      },
      { id: 'intro', name: 'Intro', type: 'Text', localized: true },
      { id: 'order', name: 'Order', type: 'Integer' },
      imageAsset('heroImage', 'Hero image'),
      entryLink('featuredBanner', 'Featured banner', ['bannerButton']),
      entryLink('seo', 'SEO', ['seoMetadata']),
    ],
  },
  {
    id: 'specification',
    name: 'Specification',
    description:
      'componentCode: x003-specs. One labelled figure (Top speed 332 km/h). Featured specifications render as tiles; a vehicle should feature at most three.',
    displayField: 'label',
    fields: [
      { id: 'label', name: 'Label', type: 'Symbol', required: true, localized: true },
      { id: 'value', name: 'Value', type: 'Symbol', required: true, localized: true },
      { id: 'unit', name: 'Unit', type: 'Symbol', localized: true },
      symbolIn('group', 'Group', ['performance', 'powertrain', 'dimensions', 'weight'], { required: true }),
      { id: 'featured', name: 'Featured', type: 'Boolean', ...defaultValue(false) },
      { id: 'order', name: 'Order', type: 'Integer' },
    ],
  },
  {
    id: 'featureHighlight',
    name: 'Feature highlight',
    description:
      'componentCode: in-detail. One highlight in the Exterior / Interior tabs; the area field decides which tab it appears in.',
    displayField: 'title',
    fields: [
      { id: 'title', name: 'Title', type: 'Symbol', required: true, localized: true },
      { id: 'body', name: 'Body', type: 'Text', localized: true },
      symbolIn('area', 'Area', ['exterior', 'interior'], { required: true }),
      { id: 'tag', name: 'Tag', type: 'Symbol', localized: true },
      imageAsset('image', 'Image'),
    ],
  },
  {
    id: 'mediaSlide',
    name: 'Media slide',
    description: 'componentCode: c060-full-bleed-carousel. One slide of the VLP overview carousel: heading, body and media.',
    displayField: 'heading',
    fields: [
      { id: 'heading', name: 'Heading', type: 'Symbol', required: true, localized: true },
      { id: 'body', name: 'Body', type: 'Text', localized: true },
      {
        id: 'media',
        name: 'Media',
        type: 'Link',
        linkType: 'Asset',
        required: true,
        validations: [{ linkMimetypeGroup: ['image', 'video'] }],
      },
    ],
  },
  {
    id: 'lineageEntry',
    name: 'Lineage entry',
    description: 'componentCode: P001EvolutionLineage. A year-stamped predecessor in the VLP lineage timeline.',
    displayField: 'title',
    fields: [
      { id: 'year', name: 'Year', type: 'Integer', required: true, validations: [{ range: { min: 1960, max: 2100 } }] },
      { id: 'title', name: 'Title', type: 'Symbol', required: true, localized: true },
      { id: 'body', name: 'Body', type: 'Text', localized: true },
      imageAsset('image', 'Image'),
      entryLink('vehicle', 'Vehicle', ['vehicle']),
    ],
  },
  {
    id: 'faqItem',
    name: 'FAQ item',
    description: 'A question and rich-text answer shown as a disclosure at the end of a vehicle page.',
    displayField: 'question',
    fields: [
      { id: 'question', name: 'Question', type: 'Symbol', required: true, localized: true },
      { id: 'answer', name: 'Answer', type: 'RichText', localized: true },
    ],
  },
  {
    id: 'textBlock',
    name: 'Text block',
    description:
      'componentCode: t001-text (variant text), t002-header (variant header). Rich text section with optional heading and theme.',
    displayField: 'heading',
    fields: [
      { id: 'heading', name: 'Heading', type: 'Symbol', localized: true },
      { id: 'body', name: 'Body', type: 'RichText', required: true, localized: true },
      symbolIn('variant', 'Variant', ['text', 'header'], defaultValue('text')),
      symbolIn('theme', 'Theme', ['white', 'mist', 'carbon'], defaultValue('white')),
    ],
  },
  {
    id: 'imageBlock',
    name: 'Image block',
    description: 'componentCode: m020-image. A single image section with optional caption, contained or full width.',
    displayField: 'caption',
    fields: [
      imageAsset('image', 'Image', { required: true }),
      { id: 'caption', name: 'Caption', type: 'Symbol', localized: true },
      symbolIn('layout', 'Layout', ['contained', 'full'], defaultValue('contained')),
    ],
  },
  {
    id: 'card',
    name: 'Card',
    description: 'An experience or generic promo card: title, body, image and one CTA.',
    displayField: 'title',
    fields: [
      { id: 'title', name: 'Title', type: 'Symbol', required: true, localized: true },
      { id: 'body', name: 'Body', type: 'Text', localized: true },
      imageAsset('image', 'Image'),
      entryLink('cta', 'CTA', ['link']),
    ],
  },
  {
    id: 'cardGrid',
    name: 'Card grid',
    description: 'A grid of cards with an optional heading (Experiences: Winter Ball, Arctic Experience).',
    displayField: 'heading',
    fields: [
      { id: 'heading', name: 'Heading', type: 'Symbol', localized: true },
      entryLinks('cards', 'Cards', ['card'], { required: true }),
    ],
  },
  {
    id: 'ctaGroup',
    name: 'CTA group',
    description: 'The "Continue your journey" group of links at the end of a page.',
    displayField: 'heading',
    fields: [
      { id: 'heading', name: 'Heading', type: 'Symbol', localized: true, ...defaultValue('Continue your journey') },
      entryLinks('links', 'Links', ['link'], { required: true }),
    ],
  },
  {
    id: 'story',
    name: 'Story',
    description:
      'componentCode: h001-hero. An editorial post under /post/<slug> with kicker, standfirst, sections and related vehicles.',
    displayField: 'title',
    fields: [
      { id: 'title', name: 'Title', type: 'Symbol', required: true, localized: true },
      {
        id: 'slug',
        name: 'Slug',
        type: 'Symbol',
        required: true,
        validations: [{ unique: true }, { regexp: { pattern: '^[a-z0-9]+(-[a-z0-9]+)*$' } }],
      },
      { id: 'kicker', name: 'Kicker', type: 'Symbol', localized: true },
      { id: 'publishDate', name: 'Publish date', type: 'Date', required: true },
      { id: 'standfirst', name: 'Standfirst', type: 'Text', localized: true },
      imageAsset('heroImage', 'Hero image', { required: true }),
      imageAsset('cardImage', 'Card image'),
      entryLinks('sections', 'Sections', STORY_SECTION_TYPES),
      entryLinks('relatedVehicles', 'Related vehicles', ['vehicle']),
      entryLink('seo', 'SEO', ['seoMetadata']),
    ],
  },
  {
    id: 'vehicle',
    name: 'Vehicle',
    description:
      'componentCode: h010-vlp-hero, product-sub-nav, t006-statement, c060-full-bleed-carousel, in-detail, x003-specs, mso, P001EvolutionLineage, relevant-content-section. One entry per model variant; renders the vehicle landing page.',
    displayField: 'name',
    fields: [
      { id: 'name', name: 'Name', type: 'Symbol', required: true, localized: true },
      {
        id: 'slug',
        name: 'Slug',
        type: 'Symbol',
        required: true,
        validations: [{ unique: true }, { regexp: { pattern: '^[a-z0-9]+(-[a-z0-9]+)*$' } }],
      },
      entryLink('category', 'Category', ['vehicleCategory'], { required: true }),
      symbolIn('status', 'Status', ['current', 'legacy', 'motorsport'], { required: true }),
      symbolIn('bodyStyle', 'Body style', ['coupe', 'spider', 'gt', 'race']),
      { id: 'order', name: 'Order', type: 'Integer' },
      entryLink('parentModel', 'Parent model', ['vehicle']),
      { id: 'shortDescription', name: 'Short description', type: 'Text', validations: [{ size: { max: 200 } }], localized: true },
      { id: 'tagline', name: 'Tagline', type: 'Symbol', localized: true },
      { id: 'statement', name: 'Statement', type: 'Text', localized: true },
      imageAsset('heroImage', 'Hero image', { required: true }),
      imageAsset('cardImage', 'Card image'),
      { id: 'filmUrl', name: 'Film URL', type: 'Symbol', validations: [urlValidation] },
      { id: 'configureUrl', name: 'Configure URL', type: 'Symbol', validations: [urlValidation] },
      { id: 'enquiryUrl', name: 'Enquiry URL', type: 'Symbol', validations: [urlValidation] },
      { id: 'downloads', name: 'Downloads', type: 'Array', items: { type: 'Link', linkType: 'Asset', validations: [] } },
      entryLinks('overviewSlides', 'Overview slides', ['mediaSlide']),
      entryLinks('highlights', 'Highlights', ['featureHighlight']),
      entryLinks('specifications', 'Specifications', ['specification']),
      { id: 'performanceHeading', name: 'Performance heading', type: 'Symbol', localized: true },
      { id: 'performanceBody', name: 'Performance body', type: 'Text', localized: true },
      { id: 'lineageIntro', name: 'Lineage intro', type: 'Text', localized: true },
      entryLinks('lineage', 'Lineage', ['lineageEntry']),
      entryLink('msoBanner', 'MSO banner', ['bannerButton']),
      entryLinks('relatedStories', 'Related stories', ['story']),
      entryLinks('faqs', 'FAQs', ['faqItem']),
      {
        id: 'yearIntroduced',
        name: 'Year introduced',
        type: 'Integer',
        validations: [{ range: { min: 1960, max: 2100 } }],
      },
      entryLink('seo', 'SEO', ['seoMetadata']),
    ],
  },
  {
    id: 'vehicleGrid',
    name: 'Vehicle grid',
    description: 'componentCode: P110ProductCards. A curated grid of vehicle product cards (category pages query instead).',
    displayField: 'heading',
    fields: [
      { id: 'heading', name: 'Heading', type: 'Symbol', localized: true },
      entryLinks('vehicles', 'Vehicles', ['vehicle'], { required: true }),
    ],
  },
  {
    id: 'storyGrid',
    name: 'Story grid',
    description:
      'componentCode: relevant-content-section. Related story cards; an empty list means the latest three by publishDate.',
    displayField: 'heading',
    fields: [
      { id: 'heading', name: 'Heading', type: 'Symbol', localized: true, ...defaultValue('Stories') },
      entryLinks('stories', 'Stories', ['story']),
    ],
  },
  {
    id: 'page',
    name: 'Page',
    description:
      'componentCode: h001-hero, n010-sub-navigation. Modular page for everything that is not a vehicle, category or story. Nested slugs use / (ownership/roadside-assistance).',
    displayField: 'title',
    fields: [
      { id: 'title', name: 'Title', type: 'Symbol', required: true, localized: true },
      {
        id: 'slug',
        name: 'Slug',
        type: 'Symbol',
        required: true,
        validations: [{ unique: true }, { regexp: { pattern: '^[a-z0-9]+(-[a-z0-9]+)*(/[a-z0-9]+(-[a-z0-9]+)*)*$' } }],
      },
      { id: 'kicker', name: 'Kicker', type: 'Symbol', localized: true },
      imageAsset('heroImage', 'Hero image'),
      symbolIn('heroStyle', 'Hero style', ['full', 'compact'], defaultValue('compact')),
      entryLink('parent', 'Parent', ['page']),
      { id: 'order', name: 'Order', type: 'Integer' },
      entryLinks('sections', 'Sections', SECTION_TYPES),
      entryLink('seo', 'SEO', ['seoMetadata']),
    ],
  },
  {
    id: 'retailer',
    name: 'Retailer',
    description: 'A retailer location for the query-driven /retailers list, with a Location field for the map link.',
    displayField: 'name',
    fields: [
      { id: 'name', name: 'Name', type: 'Symbol', required: true, localized: true },
      { id: 'city', name: 'City', type: 'Symbol', required: true, localized: true },
      { id: 'country', name: 'Country', type: 'Symbol', required: true, localized: true },
      { id: 'address', name: 'Address', type: 'Text', localized: true },
      { id: 'phone', name: 'Phone', type: 'Symbol' },
      { id: 'website', name: 'Website', type: 'Symbol', validations: [urlValidation] },
      { id: 'location', name: 'Location', type: 'Location' },
    ],
  },
  {
    id: 'enquiryForm',
    name: 'Enquiry form',
    description: 'Enquiry form copy and webhook endpoint (singleton)',
    displayField: 'title',
    fields: [
      { id: 'title', name: 'Title', type: 'Symbol', required: true, validations: [{ size: { max: 120 } }], localized: true },
      { id: 'intro', name: 'Intro', type: 'Text', localized: true },
      {
        id: 'endpoint',
        name: 'Webhook endpoint',
        type: 'Symbol',
        required: true,
        validations: [{ regexp: { pattern: '^https://[^\\s]+$' }, message: 'Must be an https URL.' }],
      },
      { id: 'submitLabel', name: 'Submit label', type: 'Symbol', localized: true, ...defaultValue('Send enquiry') },
      { id: 'consentText', name: 'Consent text', type: 'Text', required: true, localized: true },
      { id: 'successTitle', name: 'Success title', type: 'Symbol', required: true, localized: true, ...defaultValue('Thank you') },
      { id: 'successBody', name: 'Success body', type: 'Text', required: true, localized: true },
      { id: 'errorBody', name: 'Error body', type: 'Text', required: true, localized: true },
    ],
  },
  {
    id: 'siteSettings',
    name: 'Site settings',
    description:
      'Singleton (entry id: site). Site name, main navigation, footer groups, social and legal links, retailer link and home page.',
    displayField: 'siteName',
    fields: [
      { id: 'siteName', name: 'Site name', type: 'Symbol', required: true, localized: true },
      { id: 'locale', name: 'Locale', type: 'Symbol', ...defaultValue('gl_en') },
      entryLinks('mainNavigation', 'Main navigation', ['link']),
      entryLinks('footerGroups', 'Footer groups', ['linkGroup']),
      entryLinks('socialLinks', 'Social links', ['link']),
      { id: 'newsletterText', name: 'Newsletter text', type: 'Text', localized: true },
      entryLink('retailerLink', 'Retailer link', ['link']),
      entryLinks('legalLinks', 'Legal links', ['link']),
      entryLink('homePage', 'Home page', ['page']),
    ],
  },
];

/** Looks up a content type definition by ID. */
export function getContentType(id) {
  return CONTENT_TYPES.find((type) => type.id === id);
}
