/** The eight pages in the inventory, with one seoMetadata entry each. */

const PAGES = [
  {
    id: 'page-home',
    title: 'Home',
    slug: 'home',
    heroStyle: 'full',
    hero: 'img-home-hero',
    sections: ['text-home-intro', 'banner-mcl-6gt', 'stories-latest', 'cta-home'],
    description: 'Supercars, Grand Tourers and Hypercars engineered around the driver.',
  },
  {
    id: 'page-legacy',
    title: 'Legacy',
    slug: 'legacy',
    kicker: 'Past models',
    hero: 'img-legacy-hero',
    sections: ['text-legacy-intro', 'grid-legacy-all', 'cta-legacy'],
    description: 'The McLaren road cars that came before.',
  },
  {
    id: 'page-legacy-2010s',
    title: 'Legacy: the 2010s',
    slug: 'legacy/2010s',
    kicker: 'Past models',
    parent: 'page-legacy',
    order: 1,
    hero: 'img-legacy-2010s-hero',
    sections: ['text-legacy-2010s-intro', 'grid-legacy-2010s'],
    description: 'McLaren models of the 2010s: 720S, 765LT and P1.',
  },
  {
    id: 'page-legacy-1990s',
    title: 'Legacy: the 1990s',
    slug: 'legacy/1990s',
    kicker: 'Past models',
    parent: 'page-legacy',
    order: 2,
    hero: 'img-legacy-1990s-hero',
    sections: ['text-legacy-1990s-intro', 'grid-legacy-1990s'],
    description: 'McLaren models of the 1990s: the F1.',
  },
  {
    id: 'page-ownership',
    title: 'Ownership',
    slug: 'ownership',
    kicker: 'McLaren ownership',
    hero: 'img-ownership-hero',
    sections: ['text-ownership-intro', 'cta-ownership'],
    description: 'Service, support and ownership of your McLaren.',
  },
  {
    id: 'page-ownership-roadside-assistance',
    title: 'Roadside assistance',
    slug: 'ownership/roadside-assistance',
    kicker: 'McLaren ownership',
    parent: 'page-ownership',
    order: 1,
    hero: 'img-ownership-hero',
    sections: ['text-roadside-intro', 'text-roadside-contacts', 'cta-roadside'],
    description: 'Roadside assistance contacts for McLaren owners.',
  },
  {
    id: 'page-experiences',
    title: 'Experiences',
    slug: 'experiences',
    kicker: 'McLaren experiences',
    hero: 'img-experiences-hero',
    sections: ['text-experiences-intro', 'grid-experiences', 'imgblock-experiences', 'cta-experiences'],
    description: 'Drive on ice, on track and with the people who build the cars.',
  },
  {
    id: 'page-mso',
    title: 'MSO',
    slug: 'mso',
    kicker: 'McLaren Special Operations',
    hero: 'img-mso-hero',
    sections: ['text-mso-intro', 'banner-mso-generic', 'stories-mso', 'cta-mso'],
    description: 'McLaren Special Operations: bespoke colour, materials and detail.',
  },
];

const pages = [];
const seos = [];

for (const page of PAGES) {
  const seoId = `seo-${page.id}`;
  seos.push({
    id: seoId,
    contentType: 'seoMetadata',
    fields: { title: `${page.title} | McLaren Automotive demo`, description: page.description, noIndex: false },
    assets: { ogImage: 'img-og-default' },
  });
  pages.push({
    id: page.id,
    contentType: 'page',
    fields: {
      title: page.title,
      slug: page.slug,
      ...(page.kicker ? { kicker: page.kicker } : {}),
      heroStyle: page.heroStyle ?? 'compact',
      ...(page.order ? { order: page.order } : {}),
    },
    links: { ...(page.parent ? { parent: page.parent } : {}), sections: page.sections, seo: seoId },
    assets: { heroImage: page.hero },
  });
}

export const PAGES_GROUP = { name: 'pages', assets: [], entries: [...pages, ...seos] };
