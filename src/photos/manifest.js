/**
 * Manifest of the 30 generated studio photos.
 *
 * Each shot is `{ id, file, width, height, aspect, prompt, vehicleSlug?, pageSlug?, legacy? }`.
 * `file` is where the converted WebP is committed; `slots.js` maps the 86
 * placeholder asset ids onto these shots.
 */
import { VEHICLE_SEED_GROUPS } from '../seed/vehicles.js';

export const BASE_PROMPT =
  'Photoreal studio photograph of a generic unbranded mid-engine supercar on a dark studio set, low camera, dramatic rim lighting, a single orange accent light, polished dark floor, no badges, no logos, no text, no people.';

const HERO = { width: 1920, height: 1080, aspect: '16:9' };
const CARD = { width: 1200, height: 900, aspect: '4:3' };

const BODY_STYLE_PHRASES = {
  coupe: 'two-door coupe with a low roofline',
  spider: 'open-top spider with the roof down',
  gt: 'long-nosed grand tourer with a fastback roof',
  race: 'race car with a large rear wing and plain unliveried bodywork',
};

const PAINT = {
  artura: 'papaya orange',
  'artura-spider': 'silver',
  '750s': 'volcano red',
  '750s-spider': 'pearl white',
  gts: 'deep green',
  w1: 'matte black with orange highlights',
  'artura-gt4': 'plain white',
  '720s': 'azure blue',
  '765lt': 'gloss black',
  p1: 'volcanic yellow',
  f1: 'dark silver',
};

const LEGACY_GRADE = 'Warm archival colour grade with subtle film grain';

// Shots follow the stable key in the entry ID (`vehicle-750s` -> `750s`), not the
// public URL slug, so renaming a model does not orphan its photos.
const vehicles = VEHICLE_SEED_GROUPS.find((group) => group.name === 'vehicles').entries.map(
  (entry) => ({ ...entry.fields, slug: entry.id.replace(/^vehicle-/, '') }),
);

function vehiclePrompt(vehicle, angle) {
  const parts = [
    BASE_PROMPT,
    `The car is a ${BODY_STYLE_PHRASES[vehicle.bodyStyle]}, painted ${PAINT[vehicle.slug]}, ${angle}.`,
  ];
  if (vehicle.status === 'legacy') parts.push(`${LEGACY_GRADE}.`);
  return parts.join(' ');
}

const HERO_ANGLE = 'front three-quarter view';
const CARD_ANGLE = 'side profile';
const STORY_ANGLE = 'rear three-quarter view';

const vehicleShots = vehicles.flatMap((vehicle) => {
  const common = { vehicleSlug: vehicle.slug, ...(vehicle.status === 'legacy' ? { legacy: true } : {}) };
  return [
    {
      id: `shot-${vehicle.slug}-hero`,
      ...HERO,
      prompt: vehiclePrompt(vehicle, HERO_ANGLE),
      ...common,
    },
    {
      id: `shot-${vehicle.slug}-card`,
      ...CARD,
      prompt: vehiclePrompt(vehicle, CARD_ANGLE),
      ...common,
    },
  ];
});

const PAGE_SCENES = {
  home: 'a covered car under a sheet in an empty dark studio, one spotlight',
  legacy: 'three generic classic supercars in a dark museum hall',
  experiences: 'a generic supercar at night on a floodlit race track pit lane',
  mso: 'a generic supercar body in a bespoke paint booth, orange paint being applied',
};

const pagePrompt = (scene) => `${BASE_PROMPT} Scene: ${scene}.`;

const pageShots = Object.entries(PAGE_SCENES).map(([pageSlug, scene]) => ({
  id: `shot-${pageSlug}-hero`,
  ...HERO,
  prompt: pagePrompt(scene),
  pageSlug,
}));

// The home hero with a national flag as the sheet, one per region audience.
export const FLAG_DRAPES = [
  { region: 'gb', flag: 'Union Jack flag of the United Kingdom' },
  { region: 'us', flag: 'Stars and Stripes flag of the United States' },
  { region: 'jp', flag: 'flag of Japan, a single crimson circle on white' },
  { region: 'fr', flag: 'French tricolour flag' },
  { region: 'it', flag: 'Italian tricolore flag' },
];

const flagShots = FLAG_DRAPES.map(({ region, flag }) => ({
  id: `shot-home-hero-${region}`,
  ...HERO,
  prompt: pagePrompt(
    `${PAGE_SCENES.home}, seen from the front three-quarter angle; the sheet is the ${flag}, muted and dimmed by the low light so it is subtle but recognizable`,
  ),
  pageSlug: 'home',
}));

const vehicleBySlug = new Map(vehicles.map((v) => [v.slug, v]));

// Story key -> related vehicle slug; the mso story reuses the mso page scene.
const STORIES = [
  { key: '750s-facts', vehicle: '750s' },
  { key: 'artura-spider', vehicle: 'artura-spider' },
  { key: 'w1', vehicle: 'w1' },
  { key: 'mso', scene: PAGE_SCENES.mso },
];

const storyShots = STORIES.map(({ key, vehicle, scene }) => ({
  id: `shot-story-${key}-hero`,
  ...HERO,
  prompt: vehicle ? vehiclePrompt(vehicleBySlug.get(vehicle), STORY_ANGLE) : pagePrompt(scene),
  pageSlug: `story-${key}`,
}));

export const PHOTO_SHOTS = [...vehicleShots, ...pageShots, ...flagShots, ...storyShots].map((shot) => ({
  ...shot,
  file: `assets/photos/${shot.id}.webp`,
}));

export const SHOT_BY_ID = new Map(PHOTO_SHOTS.map((shot) => [shot.id, shot]));
