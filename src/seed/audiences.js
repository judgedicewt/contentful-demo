/**
 * Audience personalization: audience, contentVariant and personalizedContent
 * entries. Personalized slots resolve to one variant for the visitor, or to
 * their default when none match.
 *
 * ID conventions:
 *   aud-<key>                  audiences, keyed by the audience key
 *   variant-<slot>-<key>       content variants, one per slot and audience
 *   pc-<slot>                  personalized content slots
 */

const LOCAL = { source: 'local', matchMode: 'all' };

const audience = (key, name, fields, links) => ({
  id: `aud-${key}`,
  contentType: 'audience',
  fields: { key, name, ...fields },
  ...(links ? { links } : {}),
});

const variant = (id, title, key, content) => ({
  id,
  contentType: 'contentVariant',
  fields: { title },
  links: { audience: `aud-${key}`, content },
});

const personalized = (id, title, defaultId, variants) => ({
  id,
  contentType: 'personalizedContent',
  fields: { title },
  links: { default: defaultId, variants },
});

const entries = [
  // Audiences
  audience('supercar-fans', 'Supercar fans', LOCAL, { interestCategories: ['cat-supercars'] }),
  audience('returning', 'Returning visitors', { ...LOCAL, visitorType: 'returning' }),
  audience('trackday', 'Track day prospects', { ...LOCAL, campaigns: ['trackday'] }),
  audience('uk', 'UK visitors', { ...LOCAL, regions: ['GB'] }),
  audience('us', 'US visitors', { ...LOCAL, regions: ['US'] }),
  audience('jp', 'Japan visitors', { ...LOCAL, regions: ['JP'] }),
  audience('fr', 'France visitors', { ...LOCAL, regions: ['FR'] }),
  audience('it', 'Italy visitors', { ...LOCAL, regions: ['IT'] }),
  audience('vip', 'VIP guests', { source: 'external' }),

  // Content variants
  variant('variant-home-banner-supercar-fans', 'Home banner for supercar fans', 'supercar-fans', 'banner-supercar-fans'),
  variant('variant-home-banner-trackday', 'Home banner for track day prospects', 'trackday', 'banner-trackday'),
  variant('variant-750s-mso-returning', '750S Su Misura banner for returning visitors', 'returning', 'banner-mso-returning'),
  variant('variant-750s-enquiry-uk', '750S enquiry CTA for UK visitors', 'uk', 'link-cta-uk-retailer'),
  variant('variant-home-hero-vip', 'Home hero for VIP guests', 'vip', 'banner-hero-vip'),
  variant('variant-home-hero-trackday', 'Home hero for track day prospects', 'trackday', 'banner-hero-trackday'),
  variant('variant-home-hero-supercar-fans', 'Home hero for supercar fans', 'supercar-fans', 'banner-hero-supercar-fans'),
  variant('variant-home-hero-uk', 'Home hero for UK visitors', 'uk', 'banner-hero-uk'),
  variant('variant-home-hero-us', 'Home hero for US visitors', 'us', 'banner-hero-us'),
  variant('variant-home-hero-jp', 'Home hero for Japan visitors', 'jp', 'banner-hero-jp'),
  variant('variant-home-hero-fr', 'Home hero for France visitors', 'fr', 'banner-hero-fr'),
  variant('variant-home-hero-it', 'Home hero for Italy visitors', 'it', 'banner-hero-it'),
  variant('variant-home-hero-returning', 'Home hero for returning visitors', 'returning', 'banner-hero-returning'),

  // Personalized content slots
  personalized('pc-home-hero', 'Home hero', 'banner-hero-home', [
    'variant-home-hero-vip',
    'variant-home-hero-trackday',
    'variant-home-hero-supercar-fans',
    'variant-home-hero-uk',
    'variant-home-hero-us',
    'variant-home-hero-jp',
    'variant-home-hero-fr',
    'variant-home-hero-it',
    'variant-home-hero-returning',
  ]),
  personalized('pc-home-banner', 'Home banner', 'banner-mcl-6gt', [
    'variant-home-banner-supercar-fans',
    'variant-home-banner-trackday',
  ]),
  personalized('pc-750s-mso-banner', '750S Su Misura banner', 'banner-mso-generic', ['variant-750s-mso-returning']),
  personalized('pc-750s-enquiry-cta', '750S enquiry CTA', 'link-cta-enquire-750s', ['variant-750s-enquiry-uk']),
];

export const AUDIENCES_GROUP = { name: 'audiences', assets: [], entries };
