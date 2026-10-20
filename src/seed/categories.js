/**
 * Vehicle category seeds. IDs are `cat-<slug>`; the supercars and
 * grand-tourer categories feature the McL 6GT banner declared by B2.
 */

export const CATEGORY_SEEDS = [
  {
    id: 'cat-supercars',
    contentType: 'vehicleCategory',
    fields: {
      name: 'Supercars',
      slug: 'supercars',
      intro: 'Carbon structure. Twin-turbo power. Models built to be driven, on road and on track. The Supercar range covers the hybrid Artura and the V8 750S, each as a coupé or a Spider.',
      order: 1,
    },
    links: { featuredBanner: 'banner-mcl-6gt' },
    assets: { heroImage: 'img-cat-supercars' },
  },
  {
    id: 'cat-grand-tourer',
    contentType: 'vehicleCategory',
    fields: {
      name: 'Grand Tourers',
      slug: 'grand-tourer',
      intro: 'Pace over distance. The Grand Tourer range pairs supercar power with a tuned chassis, a quiet cabin and room for luggage.',
      order: 2,
    },
    links: { featuredBanner: 'banner-mcl-6gt' },
    assets: { heroImage: 'img-cat-grand-tourer' },
  },
  {
    id: 'cat-ultimate',
    contentType: 'vehicleCategory',
    fields: {
      name: 'Hypercars',
      slug: 'ultimate',
      intro: 'The most advanced road cars McLaren builds. Production is limited, the engineering is uncompromised and each model sets the direction for those that follow.',
      order: 3,
    },
    assets: { heroImage: 'img-cat-ultimate' },
  },
  {
    id: 'cat-motorsport',
    contentType: 'vehicleCategory',
    fields: {
      name: 'Motorsport',
      slug: 'motorsport',
      intro: 'Customer racing cars developed from the road range. Built for reliability across a full season and supported by the engineers who made them.',
      order: 4,
    },
    assets: { heroImage: 'img-cat-motorsport' },
  },
];

export const CATEGORY_GROUP = { name: 'categories', assets: [], entries: CATEGORY_SEEDS };
