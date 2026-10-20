/**
 * Media slide seeds (c060-full-bleed-carousel). IDs follow `slide-<slug>-<n>`.
 * Two overview slides per current vehicle, using overview-1 and overview-2.
 */
import { assetId } from './assets.js';

// Rows: [heading, body]
const SLIDES = {
  artura: [
    ['Hybrid, defined', 'A twin-turbo V6 and an electric motor share the drive. Together they deliver 680 PS with no pause between pedal and response.'],
    ['Electric in town', 'Drive on electric power alone for short distances. The V6 stays silent until you call on it.'],
  ],
  'artura-spider': [
    ['Open the roof, keep the structure', 'The folding hard top disappears behind the cabin. The carbon architecture underneath does not change.'],
    ['Response with the sky above', 'The same hybrid output as the coupé. The same immediate response, now with the sound of the V6 in the open.'],
  ],
  '750s': [
    ['Power, delivered cleanly', 'A 4.0L twin-turbo V8 produces 750 PS. Lighter internals and revised turbochargers sharpen the response.'],
    ['Weight is the enemy', 'Every component is reviewed for mass. The result is a dry weight of 1,277 kg and steering that reports what the front tyres are doing.'],
  ],
  '750s-spider': [
    ['The 750S without a roof', 'The coupé engine, the coupé chassis and a folding hard top. Nothing is traded for the open cabin.'],
    ['Feel the engine', 'Lower the rear window and the V8 is directly behind your head. Raise it and the cabin is calm.'],
  ],
  gts: [
    ['Distance, covered', 'A 635 PS V8 and a supple chassis make long journeys short. The GTS is tuned for pace and for comfort.'],
    ['Packed for two', 'Stowage in the nose and over the engine carries real luggage. The car is built to leave for the weekend.'],
  ],
  w1: [
    ['Begin with the air', 'The W1 is shaped from the airflow outward. Body, floor and wings are one aerodynamic system.'],
    ['Hybrid V8, 1,275 PS', 'A twin-turbo V8 and an electric motor deliver a combined 1,275 PS.'],
  ],
};

/** Slide entry IDs per vehicle slug, in display order. */
export const SLIDES_BY_VEHICLE = {};

export const SLIDE_SEEDS = Object.entries(SLIDES).flatMap(([slug, rows]) =>
  rows.map(([heading, body], index) => {
    const id = `slide-${slug}-${index + 1}`;
    (SLIDES_BY_VEHICLE[slug] ??= []).push(id);
    return {
      id,
      contentType: 'mediaSlide',
      fields: { heading, body },
      assets: { media: assetId(slug, `overview-${index + 1}`) },
    };
  }),
);

export const SLIDE_GROUP = { name: 'slides', assets: [], entries: SLIDE_SEEDS };
