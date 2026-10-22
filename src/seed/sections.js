/**
 * Page sections: textBlock, imageBlock, bannerButton, card, cardGrid,
 * vehicleGrid, storyGrid and ctaGroup entries.
 *
 * ID conventions:
 *   text-<page>-<n|intro>   text blocks (variant header for intros)
 *   imgblock-<name>         image blocks
 *   banner-*                banners (banner-mso-generic, banner-mcl-6gt, banner-hero-*)
 *   card-*, grid-*          cards, cardGrid and vehicleGrid
 *   stories-*               story grids
 *   cta-*                   "Continue your journey" groups
 * Story sections live in stories.js.
 */
import { doc, h2, p, ul } from './richtext-helpers.js';

const header = (id, heading, ...paragraphs) => ({
  id,
  contentType: 'textBlock',
  fields: { heading, body: doc(...paragraphs.map((text) => p(text))), variant: 'header', theme: 'white' },
});

const text = (id, heading, body, theme = 'white') => ({
  id,
  contentType: 'textBlock',
  fields: { heading, body, variant: 'text', theme },
});

const imageBlock = (id, image, caption, layout = 'contained') => ({
  id,
  contentType: 'imageBlock',
  fields: { caption, layout },
  assets: { image },
});

const banner = (id, { eyebrow, heading, body, image, cta, theme }) => ({
  id,
  contentType: 'bannerButton',
  fields: { eyebrow, heading, body, theme },
  links: { cta },
  assets: { image },
});

const card = (id, { title, body, image, cta }) => ({
  id,
  contentType: 'card',
  fields: { title, body },
  links: { cta },
  assets: { image },
});

const vehicleGrid = (id, heading, vehicles) => ({
  id,
  contentType: 'vehicleGrid',
  fields: { heading },
  links: { vehicles },
});

const storyGrid = (id, heading, stories = []) => ({
  id,
  contentType: 'storyGrid',
  fields: { heading },
  links: { stories },
});

const ctaGroup = (id, links, heading = 'Continue your journey') => ({
  id,
  contentType: 'ctaGroup',
  fields: { heading },
  links: { links },
});

const entries = [
  // Page intros
  header(
    'text-home-intro',
    'Engineered around the driver',
    'Every Strada Nova starts with a carbon fibre tub and a single question. What does the driver need? The answer is lighter, quicker and more direct.',
  ),
  header(
    'text-legacy-intro',
    'Past models',
    'Each Strada Nova road car is a step in one continuous line. Start with the cars that set the standard, then follow the decades.',
  ),
  header(
    'text-legacy-2010s-intro',
    'The 2010s',
    'Carbon fibre became standard. Hybrid power arrived. The 720S, 765LT and P1 defined the decade.',
  ),
  header(
    'text-legacy-1990s-intro',
    'The 1990s',
    'One car, one idea. The F1 put the driver in the centre and held the speed record for more than a decade.',
  ),
  header(
    'text-ownership-intro',
    'Ownership',
    'Your Strada Nova is built to be driven. Service, support and the road beyond are designed with the same care.',
  ),
  header(
    'text-roadside-intro',
    'Roadside assistance',
    'If something goes wrong, help is one call away. Cover is available in every market where Strada Nova is sold.',
  ),
  text(
    'text-roadside-contacts',
    'Regional contact numbers',
    doc(
      h2('Call the team'),
      p('Lines are staffed around the clock. Quote your registration and location. These numbers are placeholders.'),
      ul('United Kingdom: +44 (0)00 0000 0001', 'Europe: +00 00 0000 0002', 'North America: +1 (000) 000-0003', 'Middle East: +971 (0)0 000 0004'),
    ),
    'mist',
  ),
  header(
    'text-experiences-intro',
    'Experiences',
    'Drive on ice. Drive on a circuit. Drive in the company of people who build the cars.',
  ),
  header(
    'text-mso-intro',
    'Strada Nova Su Misura',
    'Su Misura builds the Strada Nova that only you will own. Choose the materials, the finish and the detail. The engineers do the rest.',
  ),

  // Images
  imageBlock('imgblock-experiences', 'img-experience-arctic', 'Arctic Experience, on frozen lake circuits.', 'full'),

  // Banners
  banner('banner-mso-generic', {
    eyebrow: 'Customise',
    heading: 'Make it yours',
    body: 'Strada Nova Su Misura turns a specification into a signature. Colour, carbon and craft, built to your brief.',
    image: 'img-mso-banner',
    cta: 'link-cta-customise',
    theme: 'colnbrook',
  }),
  banner('banner-mcl-6gt', {
    eyebrow: 'Legend-Inspired',
    heading: 'The Nova 6GT concept',
    body: 'A long-tail grand tourer that borrows the proportions of a Le Mans legend. One concept, drawn for the road.',
    image: 'img-mcl-6gt-banner',
    cta: 'link-cta-explore-mcl-6gt',
    theme: 'carbon',
  }),
  banner('banner-supercar-fans', {
    eyebrow: 'Supercars',
    heading: 'Your next supercar is waiting',
    body: 'The 750S is drawn for the driver. Explore the performance, the design and the detail that set it apart.',
    image: 'img-750s-hero',
    cta: 'link-cta-vehicle-750s',
    theme: 'carbon',
  }),
  banner('banner-trackday', {
    eyebrow: 'Experiences',
    heading: 'Take it to the circuit',
    body: 'Spend a day on a circuit with Strada Nova engineers and professional drivers. Places are limited, so register your interest early.',
    image: 'img-experience-track-day',
    cta: 'link-cta-register-track-day',
    theme: 'carbon',
  }),
  banner('banner-mso-returning', {
    eyebrow: 'Customise',
    heading: 'Welcome back to Su Misura',
    body: 'Pick up where you left off. Revisit your favourite materials and finishes, then build a new specification with our specialists.',
    image: 'img-mso-banner',
    cta: 'link-cta-customise',
    theme: 'colnbrook',
  }),

  // Home hero banners: the default and one per audience (see pc-home-hero)
  banner('banner-hero-home', {
    heading: 'Strada Nova',
    image: 'img-home-hero',
    theme: 'carbon',
  }),
  banner('banner-hero-vip', {
    eyebrow: 'Private preview',
    heading: 'The W1, reserved for you',
    body: 'As a VIP guest, you are invited to a private viewing of the W1 before it goes on public display.',
    image: 'img-w1-hero',
    cta: 'link-cta-vehicle-w1',
    theme: 'carbon',
  }),
  banner('banner-hero-trackday', {
    eyebrow: 'Track day',
    heading: 'Your day on the circuit starts here',
    body: 'Choose your date, pick your car and spend the day on track with Strada Nova instructors.',
    image: 'img-artura-gt4-hero',
    cta: 'link-cta-register-track-day',
    theme: 'carbon',
  }),
  banner('banner-hero-supercar-fans', {
    eyebrow: 'Picked for you',
    heading: 'More supercars to explore',
    body: 'You have been looking at our supercars. Compare the Artura, the 750S and their Spider versions.',
    image: 'img-750s-spider-hero',
    cta: 'link-cta-explore-supercars',
    theme: 'carbon',
  }),
  banner('banner-hero-uk', {
    eyebrow: 'United Kingdom',
    heading: 'Strada Nova, close to home',
    body: 'Book a test drive at a Strada Nova retailer near you.',
    image: 'img-gts-hero',
    cta: 'link-cta-uk-retailer',
    theme: 'carbon',
  }),
  banner('banner-hero-returning', {
    eyebrow: 'Welcome back',
    heading: 'Pick up where you left off',
    body: 'Good to see you again. Explore the latest models, or register your interest when you are ready.',
    image: 'img-artura-hero',
    cta: 'link-cta-register-interest',
    theme: 'carbon',
  }),

  // Experience cards and grid
  card('card-winter-ball', {
    title: 'Winter Ball',
    body: 'An evening of Strada Nova design and engineering, set in the depth of winter. Invitation only.',
    image: 'img-experience-winter-ball',
    cta: 'link-cta-discover-winter-ball',
  }),
  card('card-arctic', {
    title: 'Arctic Experience',
    body: 'Rear-wheel drive on a frozen lake. Instructors teach you where the limit is, then let you find it.',
    image: 'img-experience-arctic',
    cta: 'link-cta-discover-arctic',
  }),
  card('card-track-day', {
    title: 'Track Day',
    body: 'A full day on a circuit with Strada Nova engineers and professional drivers. Your car, or ours.',
    image: 'img-experience-track-day',
    cta: 'link-cta-register-track-day',
  }),
  {
    id: 'grid-experiences',
    contentType: 'cardGrid',
    fields: { heading: 'Choose your experience' },
    links: { cards: ['card-winter-ball', 'card-arctic', 'card-track-day'] },
  },

  // Vehicle grids
  vehicleGrid('grid-legacy-all', 'Legacy models', ['vehicle-765lt', 'vehicle-720s', 'vehicle-p1', 'vehicle-f1']),
  vehicleGrid('grid-legacy-2010s', 'Models of the 2010s', ['vehicle-765lt', 'vehicle-720s', 'vehicle-p1']),
  vehicleGrid('grid-legacy-1990s', 'Models of the 1990s', ['vehicle-f1']),

  // Story grids
  storyGrid('stories-latest', 'Latest stories'),
  storyGrid('stories-mso', 'Su Misura stories', ['story-mso-project-placeholder']),

  // "Continue your journey" groups
  ctaGroup('cta-home', ['link-cta-explore-supercars', 'link-cta-customise', 'link-cta-stories', 'link-cta-find-retailer']),
  ctaGroup('cta-models', ['link-cta-explore-supercars', 'link-cta-customise', 'link-cta-stories', 'link-cta-find-retailer']),
  ctaGroup('cta-ownership', ['link-cta-roadside', 'link-cta-experiences', 'link-cta-find-retailer', 'link-cta-contact']),
  ctaGroup('cta-roadside', ['link-cta-ownership', 'link-cta-find-retailer', 'link-cta-contact']),
  ctaGroup('cta-experiences', ['link-cta-register-interest', 'link-cta-ownership', 'link-cta-contact']),
  ctaGroup('cta-legacy', ['link-cta-explore-supercars', 'link-cta-customise', 'link-cta-find-retailer']),
  ctaGroup('cta-mso', ['link-cta-explore-supercars', 'link-cta-find-retailer', 'link-cta-contact']),
];

export const SECTIONS_GROUP = { name: 'sections', assets: [], entries };
