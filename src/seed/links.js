/**
 * Navigation and CTA links: `link` and `linkGroup` entries.
 *
 * ID conventions other templates may rely on:
 *   link-nav-*      main navigation (link-nav-models has the category children)
 *   link-footer-*   footer columns
 *   link-social-*   social profiles
 *   link-legal-*    legal links
 *   link-retailer   persistent "Find a retailer"
 *   link-cta-*      CTAs used by sections, banners and cards
 *   group-footer-*  footer link groups
 */

const link = (id, label, { target, url, style = 'text', children } = {}) => ({
  id,
  contentType: 'link',
  fields: { label, ...(url ? { externalUrl: url } : {}), style },
  links: {
    ...(target ? { target } : {}),
    ...(children ? { children } : {}),
  },
});

const group = (id, heading, links) => ({
  id,
  contentType: 'linkGroup',
  fields: { heading },
  links: { links },
});

const CATEGORIES = [
  ['supercars', 'Supercars'],
  ['grand-tourer', 'Grand Tourers'],
  ['ultimate', 'Hypercars'],
  ['motorsport', 'Motorsport'],
];

const SOCIAL = [
  ['instagram', 'Instagram', 'https://www.instagram.com/'],
  ['youtube', 'YouTube', 'https://www.youtube.com/'],
  ['linkedin', 'LinkedIn', 'https://www.linkedin.com/'],
  ['facebook', 'Facebook', 'https://www.facebook.com/'],
];

const entries = [
  // Main navigation
  ...CATEGORIES.map(([slug, name]) => link(`link-nav-cat-${slug}`, name, { target: `cat-${slug}` })),
  link('link-nav-models', 'Models', { children: CATEGORIES.map(([slug]) => `link-nav-cat-${slug}`) }),
  link('link-nav-mso', 'Su Misura', { target: 'page-mso' }),
  link('link-nav-ownership', 'Ownership', { target: 'page-ownership' }),
  link('link-nav-experiences', 'Experiences', { target: 'page-experiences' }),
  link('link-nav-legacy', 'Legacy', { target: 'page-legacy' }),

  // Retailer link (header and footer)
  link('link-retailer', 'Find a retailer', { url: '#/retailers', style: 'secondary' }),

  // Footer columns
  link('link-footer-careers', 'Careers', { url: '#/placeholder/careers' }),
  link('link-footer-media', 'Media', { url: '#/placeholder/media' }),
  link('link-footer-group', 'Strada Nova Group', { url: '#/placeholder/strada-nova-group' }),
  link('link-footer-retailers', 'Retailers', { url: '#/retailers' }),
  link('link-footer-roadside', 'Roadside assistance', { target: 'page-ownership-roadside-assistance' }),
  link('link-footer-experiences', 'Experiences', { target: 'page-experiences' }),
  link('link-footer-contact', 'Contact', { url: '#/contact' }),
  link('link-footer-enquire', 'Enquire', { url: '#/enquire' }),
  group('group-footer-more', 'More links', ['link-footer-careers', 'link-footer-media', 'link-footer-group']),
  group('group-footer-useful', 'Useful links', ['link-footer-retailers', 'link-footer-roadside', 'link-footer-experiences']),
  group('group-footer-contact', 'Contact us', ['link-footer-contact', 'link-footer-enquire']),

  // Social
  ...SOCIAL.map(([slug, label, url]) => link(`link-social-${slug}`, label, { url })),

  // Legal
  link('link-legal-privacy', 'Privacy', { url: '#/legal/privacy' }),
  link('link-legal-terms', 'Terms', { url: '#/legal/terms' }),
  link('link-legal-cookies', 'Cookies', { url: '#/legal/cookies' }),

  // CTAs used by sections, banners and cards
  link('link-cta-explore-supercars', 'Explore supercars', { target: 'cat-supercars', style: 'primary' }),
  link('link-cta-explore-grand-tourer', 'Explore Grand Tourers', { target: 'cat-grand-tourer', style: 'secondary' }),
  link('link-cta-customise', 'Customise your Strada Nova', { target: 'page-mso', style: 'primary' }),
  link('link-cta-stories', 'Strada Nova stories', { target: 'story-750s-five-key-facts', style: 'text' }),
  link('link-cta-find-retailer', 'Find a retailer', { url: '#/retailers', style: 'secondary' }),
  link('link-cta-contact', 'Contact us', { url: '#/contact', style: 'text' }),
  link('link-cta-register-interest', 'Register interest', { url: '#/enquire', style: 'secondary' }),
  link('link-cta-discover', 'Discover', { target: 'page-experiences', style: 'primary' }),
  link('link-cta-discover-winter-ball', 'Discover', { url: '#/placeholder/winter-ball', style: 'primary' }),
  link('link-cta-discover-arctic', 'Discover', { url: '#/placeholder/arctic-experience', style: 'primary' }),
  link('link-cta-register-track-day', 'Register interest', { url: '#/enquire', style: 'secondary' }),
  link('link-cta-explore-mcl-6gt', 'Discover the Nova 6GT', { url: '#/nova-6gt', style: 'primary' }),
  link('link-cta-ownership', 'Ownership', { target: 'page-ownership', style: 'text' }),
  link('link-cta-roadside', 'Roadside assistance', { target: 'page-ownership-roadside-assistance', style: 'text' }),
  link('link-cta-experiences', 'Experiences', { target: 'page-experiences', style: 'text' }),
  link('link-cta-legacy', 'Legacy models', { target: 'page-legacy', style: 'text' }),
  link('link-cta-mso', 'Strada Nova Su Misura', { target: 'page-mso', style: 'text' }),
  link('link-cta-vehicle-750s', 'Explore the 750S', { target: 'vehicle-750s', style: 'primary' }),
  link('link-cta-vehicle-artura-spider', 'Explore the Artura Spider', { target: 'vehicle-artura-spider', style: 'primary' }),
  link('link-cta-vehicle-w1', 'Explore the W1', { target: 'vehicle-w1', style: 'primary' }),
  link('link-cta-enquire-750s', 'Enquire', { url: '#/enquire/750s', style: 'secondary' }),
  link('link-cta-uk-retailer', 'Visit a UK retailer', { url: '#/retailers', style: 'secondary' }),

];

export const LINKS_GROUP = { name: 'links', assets: [], entries };
