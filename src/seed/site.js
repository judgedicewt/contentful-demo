/** The siteSettings singleton (entry id `site`). */
const entries = [
  {
    id: 'site',
    contentType: 'siteSettings',
    fields: {
      siteName: 'McLaren Automotive demo',
      locale: 'gl_en',
      newsletterText: 'Subscribe for new models, stories and events. Placeholder form: no data is collected.',
    },
    links: {
      mainNavigation: ['link-nav-models', 'link-nav-mso', 'link-nav-ownership', 'link-nav-experiences', 'link-nav-legacy'],
      footerGroups: ['group-footer-more', 'group-footer-useful', 'group-footer-contact'],
      socialLinks: ['link-social-instagram', 'link-social-youtube', 'link-social-linkedin', 'link-social-facebook'],
      retailerLink: 'link-retailer',
      legalLinks: ['link-legal-privacy', 'link-legal-terms', 'link-legal-cookies'],
      homePage: 'page-home',
    },
  },
];

export const SITE_GROUP = { name: 'site', assets: [], entries };
