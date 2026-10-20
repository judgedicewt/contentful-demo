/**
 * Specification seeds (x003-specs). IDs follow `spec-<vehicle-slug>-<label-slug>`.
 * Figures are publicly known headline numbers or plausible placeholders and
 * are not presented as official.
 */

// Template rows: [slug, label, unit, group, featured]. Featured rows come
// first, in McLaren's tile order: top speed, torque, power.
const FULL_TEMPLATE = [
  ['top-speed', 'Top speed', 'km/h', 'performance', true],
  ['torque', 'Torque', 'Nm', 'powertrain', true],
  ['power', 'Power', 'PS', 'powertrain', true],
  ['0-100', '0-100 km/h', 's', 'performance', false],
  ['0-200', '0-200 km/h', 's', 'performance', false],
  ['engine', 'Engine', '', 'powertrain', false],
  ['transmission', 'Transmission', '', 'powertrain', false],
  ['dry-weight', 'Dry weight', 'kg', 'weight', false],
  ['length', 'Length', 'mm', 'dimensions', false],
  ['width', 'Width', 'mm', 'dimensions', false],
];

// Values in FULL_TEMPLATE order.
const FULL_VALUES = {
  artura: ['330', '720', '680', '3.0', '8.3', '3.0L twin-turbo V6 hybrid', '8-speed SSG', '1395', '4539', '1913'],
  'artura-spider': ['330', '720', '680', '3.0', '8.4', '3.0L twin-turbo V6 hybrid', '8-speed SSG', '1457', '4539', '1913'],
  '750s': ['332', '800', '750', '2.8', '7.2', '4.0L twin-turbo V8', '7-speed SSG', '1277', '4569', '2161'],
  '750s-spider': ['332', '800', '750', '2.8', '7.2', '4.0L twin-turbo V8', '7-speed SSG', '1322', '4569', '2161'],
  gts: ['326', '630', '635', '3.2', '9.0', '4.0L twin-turbo V8', '7-speed SSG', '1495', '4683', '2045'],
  w1: ['350', '1000', '1275', '2.7', '5.8', '4.0L twin-turbo V8 hybrid', '8-speed SSG', '1399', '4635', '2041'],
};

// Legacy and motorsport vehicles: three rows, all featured.
const SHORT_ROWS = {
  '720s': [
    ['top-speed', 'Top speed', '341', 'km/h', 'performance'],
    ['torque', 'Torque', '770', 'Nm', 'powertrain'],
    ['power', 'Power', '720', 'PS', 'powertrain'],
  ],
  '765lt': [
    ['top-speed', 'Top speed', '330', 'km/h', 'performance'],
    ['torque', 'Torque', '800', 'Nm', 'powertrain'],
    ['power', 'Power', '765', 'PS', 'powertrain'],
  ],
  p1: [
    ['top-speed', 'Top speed', '350', 'km/h', 'performance'],
    ['torque', 'Torque', '900', 'Nm', 'powertrain'],
    ['power', 'Power', '916', 'PS', 'powertrain'],
  ],
  f1: [
    ['top-speed', 'Top speed', '386', 'km/h', 'performance'],
    ['torque', 'Torque', '651', 'Nm', 'powertrain'],
    ['power', 'Power', '627', 'PS', 'powertrain'],
  ],
  'artura-gt4': [
    ['power', 'Power', '585', 'PS', 'powertrain'],
    ['torque', 'Torque', '600', 'Nm', 'powertrain'],
    ['weight', 'Weight', '1365', 'kg', 'weight'],
  ],
};

const specSeed = (vehicleSlug, order, { slug, label, value, unit, group, featured }) => ({
  id: `spec-${vehicleSlug}-${slug}`,
  contentType: 'specification',
  fields: {
    label,
    value,
    ...(unit ? { unit } : {}),
    group,
    featured,
    order,
  },
});

/** Specification entry IDs per vehicle slug, in display order. */
export const SPECIFICATIONS_BY_VEHICLE = {};

export const SPECIFICATION_SEEDS = [];

for (const [vehicleSlug, values] of Object.entries(FULL_VALUES)) {
  FULL_TEMPLATE.forEach(([slug, label, unit, group, featured], index) => {
    SPECIFICATION_SEEDS.push(specSeed(vehicleSlug, index + 1, { slug, label, value: values[index], unit, group, featured }));
  });
}

for (const [vehicleSlug, rows] of Object.entries(SHORT_ROWS)) {
  rows.forEach(([slug, label, value, unit, group], index) => {
    SPECIFICATION_SEEDS.push(specSeed(vehicleSlug, index + 1, { slug, label, value, unit, group, featured: true }));
  });
}

for (const seed of SPECIFICATION_SEEDS) {
  const vehicleSlug = [...Object.keys(FULL_VALUES), ...Object.keys(SHORT_ROWS)]
    .filter((slug) => seed.id.startsWith(`spec-${slug}-`))
    .sort((a, b) => b.length - a.length)[0];
  (SPECIFICATIONS_BY_VEHICLE[vehicleSlug] ??= []).push(seed.id);
}

export const SPECIFICATION_GROUP = { name: 'specifications', assets: [], entries: SPECIFICATION_SEEDS };
