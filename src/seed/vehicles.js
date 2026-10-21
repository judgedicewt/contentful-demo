/**
 * Vehicle seeds: one entry per model variant (vehicle landing page).
 * Combines the child groups (specifications, highlights, slides, lineage,
 * faqs) and the categories into VEHICLE_SEED_GROUPS in dependency order.
 *
 * Copy is original placeholder text. Figures are publicly known headline
 * numbers or plausible placeholders and are not presented as official.
 */
import { assetId } from './asset-id.js';
import { SPECIFICATION_GROUP, SPECIFICATIONS_BY_VEHICLE } from './specifications.js';
import { HIGHLIGHT_GROUP, HIGHLIGHTS_BY_VEHICLE } from './highlights.js';
import { SLIDE_GROUP, SLIDES_BY_VEHICLE } from './slides.js';
import { LINEAGE_GROUP, LINEAGE_BY_VEHICLE } from './lineage.js';
import { FAQ_GROUP, FAQS_BY_VEHICLE } from './faqs.js';
import { CATEGORY_GROUP } from './categories.js';

const vehicleId = (slug) => `vehicle-${slug}`;

// ---------------------------------------------------------------------------
// Current vehicles: every field populated.
// ---------------------------------------------------------------------------
const CURRENT = [
  {
    slug: 'artura',
    name: 'Artura',
    category: 'cat-supercars',
    bodyStyle: 'coupe',
    order: 1,
    year: 2021,
    tagline: 'Hybrid by design',
    statement:
      'The Artura is the first McLaren built around a high-performance hybrid powertrain. A new carbon architecture, a lighter V6 and an electric motor produce 680 PS and answer every input at once.',
    shortDescription:
      'A high-performance hybrid supercar. A twin-turbo V6, an electric motor and a new carbon architecture combine for 680 PS.',
    performanceHeading: 'One system, instant response',
    performanceBody:
      'The V6 and the electric motor work as a single unit. The motor fills the gap before the turbochargers build boost, so the response is immediate at any speed.',
    lineageIntro: 'The Artura applies the lightweight principles of the cars before it to a hybrid drivetrain.',
    stories: ['story-artura-spider-performance'],
  },
  {
    slug: 'artura-spider',
    name: 'Artura Spider',
    category: 'cat-supercars',
    bodyStyle: 'spider',
    order: 2,
    year: 2024,
    parent: 'artura',
    tagline: 'Open air, same structure',
    statement:
      'The Artura Spider removes the roof, not the stiffness. A folding hard top stows in seconds and the carbon architecture underneath is as rigid as the coupé.',
    shortDescription:
      'The Artura with a folding hard top. The same 680 PS hybrid powertrain and the same carbon architecture, open to the air.',
    performanceHeading: 'Coupé output, open cabin',
    performanceBody:
      'The Spider keeps the coupé powertrain and the coupé chassis. The roof mechanism adds a little mass, and the engineering team offsets it elsewhere.',
    lineageIntro: 'Open-top McLarens have always shared the structure of their coupé siblings.',
    stories: ['story-artura-spider-performance'],
  },
  {
    slug: '750s',
    name: '750S',
    category: 'cat-supercars',
    bodyStyle: 'coupe',
    order: 3,
    year: 2023,
    tagline: 'Less mass, more intent',
    statement:
      'The 750S is built around one idea: remove everything the car does not need. Lower weight, sharper steering and 750 PS from a 4.0L twin-turbo V8 turn that idea into speed.',
    shortDescription:
      'A lightweight V8 supercar. 750 PS from a 4.0L twin-turbo engine, a carbon tub and steering that reports every detail of the road.',
    filmUrl: 'https://example.com/films/750s',
    performanceHeading: '750 PS, 332 km/h',
    performanceBody:
      'Revised turbochargers and lighter internals sharpen the V8 response. A dry weight of 1,277 kg gives the car one of the best power-to-weight ratios in its class.',
    lineageIntro: 'The 750S continues a line of Super Series cars that started with the F1.',
    stories: ['story-750s-five-key-facts'],
  },
  {
    slug: '750s-spider',
    name: '750S Spider',
    category: 'cat-supercars',
    bodyStyle: 'spider',
    order: 4,
    year: 2023,
    parent: '750s',
    tagline: 'The 750S, open',
    statement:
      'The 750S Spider keeps the coupé engine, the coupé chassis and the coupé output. A folding hard top and a reinforced upper structure open the cabin without a penalty in response.',
    shortDescription:
      'The 750S with a folding hard top. The same 750 PS V8 and carbon tub, with the cabin open to the air at the touch of a button.',
    performanceHeading: 'Same V8, same numbers',
    performanceBody:
      'The Spider matches the coupé for output and top speed. The roof adds 45 kg, and the structure around it is reinforced to keep the chassis response unchanged.',
    lineageIntro: 'The 750S Spider carries the same lineage as the coupé, with the roof folded away.',
    stories: ['story-750s-five-key-facts'],
  },
  {
    slug: 'gts',
    name: 'GTS',
    category: 'cat-grand-tourer',
    bodyStyle: 'gt',
    order: 1,
    year: 2024,
    tagline: 'Grand touring, rethought',
    statement:
      'The GTS is a grand tourer with a supercar engine. 635 PS, a tuned chassis and room for luggage make long distances short.',
    shortDescription:
      'A grand tourer with a 4.0L twin-turbo V8, 635 PS and a supple chassis. Room for luggage, a quiet cabin and pace over distance.',
    performanceHeading: 'Pace that lasts',
    performanceBody:
      'The V8 delivers 635 PS and 630 Nm across a wide band. The chassis settles at motorway speed and sharpens as the road tightens.',
    lineageIntro: 'The GTS is the latest car in a line of McLaren grand tourers.',
    stories: ['story-mso-project-placeholder'],
  },
  {
    slug: 'w1',
    name: 'W1',
    category: 'cat-ultimate',
    bodyStyle: 'coupe',
    order: 1,
    year: 2024,
    tagline: 'Designed by air',
    statement:
      'The W1 begins with airflow. Its shape, its active aerodynamics and its hybrid V8 are designed together, and they produce 1,275 PS in a one-piece carbon structure.',
    shortDescription:
      'A limited-production hybrid hypercar. A twin-turbo V8 and an electric motor, active aerodynamics and a one-piece carbon structure.',
    filmUrl: 'https://example.com/films/w1',
    performanceHeading: '1,275 PS, 350 km/h',
    performanceBody:
      'The hybrid V8 and the electric motor produce a combined 1,275 PS. Active aerodynamics adjust continuously to hold the car on the road at speed.',
    lineageIntro: 'The W1 is the third McLaren to carry the ultimate badge, after the F1 and the P1.',
    stories: ['story-w1-designed-by-air', 'story-mso-project-placeholder'],
  },
].map((vehicle) => ({ ...vehicle, status: 'current' }));

// ---------------------------------------------------------------------------
// Legacy and motorsport vehicles: lighter content.
// ---------------------------------------------------------------------------
const LIGHT = [
  {
    slug: '720s',
    name: '720S',
    category: 'cat-supercars',
    status: 'legacy',
    bodyStyle: 'coupe',
    order: 92,
    year: 2017,
    statement:
      'The 720S introduced the monocage II carbon tub and a 4.0L twin-turbo V8 to the Super Series. It set new targets for response, visibility and aerodynamic efficiency.',
    shortDescription:
      'The 2017 Super Series coupé. A 4.0L twin-turbo V8 producing 720 PS in a carbon monocage structure.',
  },
  {
    slug: '765lt',
    name: '765LT',
    category: 'cat-supercars',
    status: 'legacy',
    bodyStyle: 'coupe',
    order: 91,
    year: 2020,
    statement:
      'The 765LT is a Longtail built to shed weight and add downforce. It took the 720S as a starting point and removed 80 kg, with more power and a longer rear section.',
    shortDescription:
      'The 2020 Longtail coupé. 765 PS, reduced mass, extended aerodynamics and a limited production run.',
  },
  {
    slug: 'p1',
    name: 'P1',
    category: 'cat-ultimate',
    status: 'legacy',
    bodyStyle: 'coupe',
    order: 91,
    year: 2013,
    statement:
      'The P1 paired a twin-turbo V8 with an electric motor to deliver 916 PS. Its active aerodynamics and carbon monocage were developed using the lessons of Formula 1.',
    shortDescription:
      'The 2013 hybrid hypercar. A twin-turbo V8 and an electric motor, active aerodynamics and a limited run of 375 cars.',
  },
  {
    slug: 'f1',
    name: 'F1',
    category: 'cat-ultimate',
    status: 'legacy',
    bodyStyle: 'coupe',
    order: 92,
    year: 1992,
    statement:
      'The F1 placed the driver at the centre of a carbon monocoque and a naturally aspirated V12 behind. It held the production car speed record for more than a decade.',
    shortDescription:
      'The 1992 road car with a central driving position, a carbon monocoque and a 6.1L naturally aspirated V12.',
  },
  {
    slug: 'artura-gt4',
    name: 'Artura GT4',
    category: 'cat-motorsport',
    status: 'motorsport',
    bodyStyle: 'race',
    order: 1,
    year: 2023,
    tagline: 'Built to race',
    statement:
      'The Artura GT4 is a customer racing car developed from the road car carbon architecture. It is engineered for reliability across a full season, and for the driver who wants to move up from club racing.',
    shortDescription:
      'A customer racing car for the GT4 class. A twin-turbo V6, a carbon structure and a race aero package, supplied with technical support.',
  },
];

const withCommon = (vehicle, parts) => ({
  id: vehicleId(vehicle.slug),
  contentType: 'vehicle',
  ...parts,
});

const currentSeeds = CURRENT.map((v) =>
  withCommon(v, {
    fields: {
      name: v.name,
      slug: v.slug,
      status: v.status,
      bodyStyle: v.bodyStyle,
      order: v.order,
      shortDescription: v.shortDescription,
      tagline: v.tagline,
      statement: v.statement,
      ...(v.filmUrl ? { filmUrl: v.filmUrl } : {}),
      configureUrl: `#/configure/${v.slug}`,
      enquiryUrl: `#/enquire/${v.slug}`,
      performanceHeading: v.performanceHeading,
      performanceBody: v.performanceBody,
      lineageIntro: v.lineageIntro,
      yearIntroduced: v.year,
    },
    links: {
      category: v.category,
      ...(v.parent ? { parentModel: vehicleId(v.parent) } : {}),
      overviewSlides: SLIDES_BY_VEHICLE[v.slug],
      highlights: HIGHLIGHTS_BY_VEHICLE[v.slug],
      specifications: SPECIFICATIONS_BY_VEHICLE[v.slug],
      lineage: LINEAGE_BY_VEHICLE[v.slug],
      msoBanner: 'banner-mso-generic',
      ...(v.slug === '750s' ? { msoBanner: 'pc-750s-mso-banner', enquiryCta: 'pc-750s-enquiry-cta' } : {}),
      relatedStories: v.stories,
      faqs: FAQS_BY_VEHICLE[v.slug],
    },
    assets: {
      heroImage: assetId(v.slug, 'hero'),
      cardImage: assetId(v.slug, 'card'),
      // The card image stands in for the brochure PDF.
      downloads: [assetId(v.slug, 'card')],
    },
  }),
);

const lightSeeds = LIGHT.map((v) =>
  withCommon(v, {
    fields: {
      name: v.name,
      slug: v.slug,
      status: v.status,
      bodyStyle: v.bodyStyle,
      order: v.order,
      shortDescription: v.shortDescription,
      ...(v.tagline ? { tagline: v.tagline } : {}),
      statement: v.statement,
      ...(v.status === 'motorsport' ? { enquiryUrl: `#/enquire/${v.slug}` } : {}),
      yearIntroduced: v.year,
    },
    links: {
      category: v.category,
      specifications: SPECIFICATIONS_BY_VEHICLE[v.slug],
      ...(HIGHLIGHTS_BY_VEHICLE[v.slug] ? { highlights: HIGHLIGHTS_BY_VEHICLE[v.slug] } : {}),
    },
    assets: {
      heroImage: assetId(v.slug, 'hero'),
      cardImage: assetId(v.slug, 'card'),
    },
  }),
);

// Links may point forward (parentModel, lineage -> vehicle): setup writes all
// entries as drafts before publishing any of them.
export const VEHICLE_SEEDS = [...currentSeeds, ...lightSeeds];

export const VEHICLE_GROUP = { name: 'vehicles', assets: [], entries: VEHICLE_SEEDS };

export const VEHICLE_SEED_GROUPS = [
  SPECIFICATION_GROUP,
  HIGHLIGHT_GROUP,
  SLIDE_GROUP,
  LINEAGE_GROUP,
  FAQ_GROUP,
  CATEGORY_GROUP,
  VEHICLE_GROUP,
];
