/**
 * Manifest of every placeholder image the seed data references.
 *
 * Each entry is `{ id, label, kind, palette, silhouette }`:
 * - `id` is `img-<slug>-<purpose>` and doubles as the Contentful asset ID
 * - `label` is printed on the image and used as the asset title
 * - `kind` picks the canvas size (see SIZES)
 * - `palette` picks the background theme (see PALETTES in draw.js)
 * - `silhouette` is `coupe`, `spider`, or `none` for non-car imagery
 */

export const SIZES = {
  hero: { width: 1920, height: 1080 },
  card: { width: 1200, height: 900 },
  portrait: { width: 900, height: 1200 },
  detail: { width: 1600, height: 1000 },
};

export const KINDS = Object.keys(SIZES);
export const PALETTE_NAMES = ['carbon', 'midnight', 'mist', 'white', 'papaya'];
export const SILHOUETTES = ['coupe', 'spider', 'none'];

const CURRENT_VEHICLES = [
  { slug: 'artura', name: 'Artura', silhouette: 'coupe' },
  { slug: 'artura-spider', name: 'Artura Spider', silhouette: 'spider' },
  { slug: '750s', name: '750S', silhouette: 'coupe' },
  { slug: '750s-spider', name: '750S Spider', silhouette: 'spider' },
  { slug: 'gts', name: 'GTS', silhouette: 'coupe' },
  { slug: 'w1', name: 'W1', silhouette: 'coupe' },
  { slug: 'artura-gt4', name: 'Artura GT4', silhouette: 'coupe' },
];

const LEGACY_VEHICLES = [
  { slug: '720s', name: '720S', silhouette: 'coupe' },
  { slug: '765lt', name: '765LT', silhouette: 'coupe' },
  { slug: 'p1', name: 'P1', silhouette: 'coupe' },
  { slug: 'f1', name: 'F1', silhouette: 'coupe' },
];

// Purpose → { suffix, kind, palette }. Palettes alternate so a vehicle page
// reads as a sequence of distinct images rather than one repeated tile.
const CURRENT_PURPOSES = [
  { purpose: 'hero', suffix: 'hero', kind: 'hero', palette: 'carbon' },
  { purpose: 'card', suffix: 'card', kind: 'card', palette: 'mist' },
  { purpose: 'overview-1', suffix: 'overview 1', kind: 'hero', palette: 'midnight' },
  { purpose: 'overview-2', suffix: 'overview 2', kind: 'hero', palette: 'white' },
  { purpose: 'exterior', suffix: 'exterior detail', kind: 'detail', palette: 'mist' },
  { purpose: 'interior', suffix: 'interior detail', kind: 'detail', palette: 'carbon' },
  { purpose: 'mso', suffix: 'MSO', kind: 'detail', palette: 'papaya' },
];

const LEGACY_PURPOSES = [
  { purpose: 'hero', suffix: 'hero', kind: 'hero', palette: 'midnight' },
  { purpose: 'card', suffix: 'card', kind: 'card', palette: 'carbon' },
];

function vehicleEntries(vehicles, purposes) {
  return vehicles.flatMap((vehicle) =>
    purposes.map(({ purpose, suffix, kind, palette }) => ({
      id: `img-${vehicle.slug}-${purpose}`,
      label: `${vehicle.name} ${suffix}`,
      kind,
      palette,
      silhouette: vehicle.silhouette,
    })),
  );
}

const LINEAGE = [
  { slug: '765lt', name: '765LT', palette: 'carbon' },
  { slug: '720s', name: '720S', palette: 'midnight' },
  { slug: 'f1', name: 'F1', palette: 'mist' },
  { slug: 'p1', name: 'P1', palette: 'white' },
].map(({ slug, name, palette }) => ({
  id: `img-lineage-${slug}`,
  label: `${name} lineage`,
  kind: 'portrait',
  palette,
  silhouette: 'coupe',
}));

const CATEGORIES = [
  { slug: 'supercars', name: 'Supercars', palette: 'carbon', silhouette: 'coupe' },
  { slug: 'grand-tourer', name: 'Grand Tourer', palette: 'mist', silhouette: 'coupe' },
  { slug: 'ultimate', name: 'Ultimate', palette: 'midnight', silhouette: 'coupe' },
  { slug: 'motorsport', name: 'Motorsport', palette: 'papaya', silhouette: 'coupe' },
].map(({ slug, name, palette, silhouette }) => ({
  id: `img-cat-${slug}`,
  label: `${name} hero`,
  kind: 'hero',
  palette,
  silhouette,
}));

const PAGES = [
  { id: 'img-home-hero', label: 'Home hero', kind: 'hero', palette: 'carbon', silhouette: 'spider' },
  { id: 'img-legacy-hero', label: 'Legacy hero', kind: 'hero', palette: 'midnight', silhouette: 'coupe' },
  { id: 'img-legacy-2010s-hero', label: 'Legacy 2010s hero', kind: 'hero', palette: 'carbon', silhouette: 'coupe' },
  { id: 'img-legacy-1990s-hero', label: 'Legacy 1990s hero', kind: 'hero', palette: 'mist', silhouette: 'coupe' },
  { id: 'img-ownership-hero', label: 'Ownership hero', kind: 'hero', palette: 'white', silhouette: 'coupe' },
  { id: 'img-experiences-hero', label: 'Experiences hero', kind: 'hero', palette: 'midnight', silhouette: 'none' },
  { id: 'img-mso-hero', label: 'MSO hero', kind: 'hero', palette: 'carbon', silhouette: 'spider' },
  { id: 'img-mso-banner', label: 'MSO banner', kind: 'detail', palette: 'papaya', silhouette: 'coupe' },
  { id: 'img-mcl-6gt-banner', label: 'MCL 6GT banner', kind: 'detail', palette: 'mist', silhouette: 'coupe' },
  { id: 'img-experience-winter-ball', label: 'Winter Ball experience', kind: 'card', palette: 'midnight', silhouette: 'none' },
  { id: 'img-experience-arctic', label: 'Arctic experience', kind: 'card', palette: 'white', silhouette: 'none' },
  { id: 'img-experience-track-day', label: 'Track Day experience', kind: 'card', palette: 'papaya', silhouette: 'none' },
];

const STORIES = [
  { slug: '750s-facts', name: '750S five key facts', silhouette: 'coupe', hero: 'carbon', inline: 'mist' },
  { slug: 'artura-spider', name: 'Artura Spider performance', silhouette: 'spider', hero: 'midnight', inline: 'white' },
  { slug: 'w1', name: 'W1 designed by air', silhouette: 'coupe', hero: 'mist', inline: 'carbon' },
  { slug: 'mso', name: 'MSO project', silhouette: 'coupe', hero: 'papaya', inline: 'midnight' },
].flatMap(({ slug, name, silhouette, hero, inline }) => [
  { id: `img-story-${slug}-hero`, label: `${name} story hero`, kind: 'hero', palette: hero, silhouette },
  { id: `img-story-${slug}-inline`, label: `${name} story image`, kind: 'detail', palette: inline, silhouette },
]);

const SOCIAL = [
  { id: 'img-og-default', label: 'Share image', kind: 'card', palette: 'carbon', silhouette: 'coupe' },
];

export const MANIFEST = [
  ...vehicleEntries(CURRENT_VEHICLES, CURRENT_PURPOSES),
  ...vehicleEntries(LEGACY_VEHICLES, LEGACY_PURPOSES),
  ...LINEAGE,
  ...CATEGORIES,
  ...PAGES,
  ...STORIES,
  ...SOCIAL,
];

export function findEntry(id) {
  return MANIFEST.find((entry) => entry.id === id);
}
