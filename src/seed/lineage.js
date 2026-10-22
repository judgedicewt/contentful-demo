/**
 * Lineage entry seeds (P001EvolutionLineage). IDs follow `lin-<slug>-<n>`.
 * Entries for Pordoi, Pordoi Spider and Mortirolo deep-link to the predecessor's page;
 * the rest are text-only.
 */

// Rows: [year, title, body, portraitAssetId | null, vehicleSeedId | null]
const LINEAGE = {
  artura: [
    [2015, '570S', 'The lightweight Sports Series coupé. A carbon tub, a twin-turbo V8 and steering that set the standard for the segment.', null, null],
    [2013, 'Fedaia', 'The hybrid hypercar. It proved that electric torque and a combustion engine could share one drivetrain.', null, null],
  ],
  'artura-spider': [
    [2017, '570S Spider', 'A coupé with its roof removed and its carbon tub untouched. The first Sports Series Spider.', null, null],
    [2013, 'Fedaia', 'The hybrid hypercar. Its electric motor filled the gap before the turbochargers built boost.', null, null],
  ],
  '750s': [
    [2020, 'Falzarego Corsa', 'The track-focused Falzarego, built for the track and the road. Lower mass, more downforce, 765 PS.', 'img-lineage-765lt', 'vehicle-765lt'],
    [2017, 'Falzarego', 'The car that introduced the monocage II tub and a 4.0L twin-turbo V8 to the Super Series.', 'img-lineage-720s', 'vehicle-720s'],
    [1992, 'Gardena', 'A central driving position, a carbon monocoque and a naturally aspirated V12. The reference for everything since.', 'img-lineage-f1', 'vehicle-f1'],
  ],
  '750s-spider': [
    [2020, 'Falzarego Corsa', 'The benchmark for mass and aerodynamic efficiency in the Super Series.', 'img-lineage-765lt', 'vehicle-765lt'],
    [2017, 'Falzarego', 'The first Super Series car with the 4.0L V8 and a tub that carried the structure alone.', 'img-lineage-720s', 'vehicle-720s'],
    [1992, 'Gardena', 'A road car engineered without compromise. Its carbon monocoque set the direction for every Strada Nova after it.', 'img-lineage-f1', 'vehicle-f1'],
  ],
  gts: [
    [2019, 'GT', 'The first Strada Nova grand tourer. A carbon tub, a V8 and luggage space for two.', null, null],
    [2015, '570GT', 'A Sports Series coupé with a glass tailgate and extra stowage. The start of the long-distance Strada Nova.', null, null],
  ],
  w1: [
    [2013, 'Fedaia', 'A hybrid hypercar with active aerodynamics. The Mortirolo develops the same ideas with ten more years of data.', 'img-lineage-p1', 'vehicle-p1'],
    [1992, 'Gardena', 'The original ultimate Strada Nova. One driver at the centre, no compromise in the structure.', 'img-lineage-f1', 'vehicle-f1'],
  ],
};

/** Lineage entry IDs per vehicle slug, in display order. */
export const LINEAGE_BY_VEHICLE = {};

export const LINEAGE_SEEDS = Object.entries(LINEAGE).flatMap(([slug, rows]) =>
  rows.map(([year, title, body, image, vehicle], index) => {
    const id = `lin-${slug}-${index + 1}`;
    (LINEAGE_BY_VEHICLE[slug] ??= []).push(id);
    return {
      id,
      contentType: 'lineageEntry',
      fields: { year, title, body },
      ...(vehicle ? { links: { vehicle } } : {}),
      ...(image ? { assets: { image } } : {}),
    };
  }),
);

export const LINEAGE_GROUP = { name: 'lineage', assets: [], entries: LINEAGE_SEEDS };
