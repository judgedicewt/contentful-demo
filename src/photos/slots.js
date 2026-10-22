/**
 * Maps placeholder asset ids (src/placeholders/manifest.js) onto photo shots.
 * Several slots share one photo; `img-og-default` has no photo and stays SVG.
 */
import { PHOTO_SHOTS, SHOT_BY_ID } from './manifest.js';

// Longest slug first so `artura-spider` is tried before `artura`.
const VEHICLE_SLUGS = [
  ...new Set(PHOTO_SHOTS.filter((s) => s.vehicleSlug).map((s) => s.vehicleSlug)),
].sort((a, b) => b.length - a.length);

const alt = VEHICLE_SLUGS.map((slug) => slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
const LINEAGE = new RegExp(`^img-lineage-(${alt})$`);
// The second overview slide and the interior highlight use the card shot, so a
// vehicle page does not show the hero crop three times.
const CARD_SLOT = new RegExp(`^img-(${alt})-(?:card|overview-2|interior)$`);
const HERO_SLOT = new RegExp(`^img-(${alt})-(?:hero|overview-\\d+|exterior|mso)$`);
const STORY = /^img-story-(.+)-(?:hero|inline)$/;

const FIXED = {
  'img-cat-supercars': 'shot-750s-hero',
  'img-cat-grand-tourer': 'shot-gts-hero',
  'img-cat-ultimate': 'shot-w1-hero',
  'img-cat-motorsport': 'shot-artura-gt4-hero',
  'img-home-hero': 'shot-home-hero',
  'img-home-hero-gb': 'shot-home-hero-gb',
  'img-home-hero-us': 'shot-home-hero-us',
  'img-home-hero-jp': 'shot-home-hero-jp',
  'img-home-hero-fr': 'shot-home-hero-fr',
  'img-home-hero-it': 'shot-home-hero-it',
  'img-legacy-hero': 'shot-legacy-hero',
  'img-legacy-2010s-hero': 'shot-legacy-hero',
  'img-legacy-1990s-hero': 'shot-legacy-hero',
  'img-ownership-hero': 'shot-gts-hero',
  'img-experiences-hero': 'shot-experiences-hero',
  'img-mso-hero': 'shot-mso-hero',
  'img-mso-banner': 'shot-mso-hero',
  'img-mcl-6gt-banner': 'shot-gts-hero',
};

function shotIdFor(assetId) {
  // Lineage tiles are portrait crops: the hero's front three-quarter survives them best.
  let m = LINEAGE.exec(assetId);
  if (m) return `shot-${m[1]}-hero`;
  m = CARD_SLOT.exec(assetId);
  if (m) return `shot-${m[1]}-card`;
  m = HERO_SLOT.exec(assetId);
  if (m) return `shot-${m[1]}-hero`;
  m = STORY.exec(assetId);
  if (m) return `shot-story-${m[1]}-hero`;
  if (FIXED[assetId]) return FIXED[assetId];
  if (assetId.startsWith('img-experience-')) return 'shot-experiences-hero';
  return null;
}

/** The photo shot for a placeholder asset id, or `null` when it has none. */
export function photoForAsset(assetId) {
  const shotId = shotIdFor(assetId);
  return (shotId && SHOT_BY_ID.get(shotId)) || null;
}
