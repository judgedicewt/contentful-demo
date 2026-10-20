/**
 * Feature highlight seeds (in-detail). IDs follow `hl-<vehicle-slug>-<n>`.
 * Each current vehicle has two exterior and two interior highlights; the
 * motorsport car has one of each.
 */
import { assetId } from './assets.js';

// Rows: [area, title, tag, body]
const HIGHLIGHTS = {
  artura: [
    ['exterior', 'Architecture first', 'Carbon tub', 'A new carbon structure holds the hybrid hardware inside the chassis. It keeps the mass low and the stiffness high.'],
    ['exterior', 'Air as a component', 'Aerodynamics', 'Ducts feed the radiators and the intake. The rear deck manages the wake. Every surface has a job.'],
    ['interior', 'Driver at the centre', 'Cockpit', 'The instrument binnacle moves with the steering column. The controls sit within reach of the wheel.'],
    ['interior', 'Quiet when you ask', 'EV mode', 'Electric drive moves the car silently at low speed. The V6 joins when you press on.'],
  ],
  'artura-spider': [
    ['exterior', 'Roof away in seconds', 'Hard top', 'A folding hard top stows behind the cabin. It operates at low speed and leaves the rear lines clean.'],
    ['exterior', 'Stiff without a roof', 'Carbon tub', 'The structural carbon stays in place when the roof is open. Rigidity is designed in, not added back.'],
    ['interior', 'Open air, calm cabin', 'Wind deflector', 'A glass panel behind the seats reduces turbulence. You can talk at speed with the roof down.'],
    ['interior', 'Seats that hold', 'Lightweight seats', 'Shaped seats keep mass low and keep you in position through fast corners.'],
  ],
  '750s': [
    ['exterior', 'Carved by air', 'Dihedral doors', 'Air passes through the body as well as over it. The doors open up and forward, and their shape guides flow to the rear radiators.'],
    ['exterior', 'Active rear wing', 'Aerodynamics', 'The wing changes angle with speed and braking load. It adds downforce when needed and trims drag when not.'],
    ['interior', 'Focus on the drive', 'Driver display', 'The driver display folds away at the touch of a button. Only speed and gear remain.'],
    ['interior', 'Carbon throughout', 'Cabin', 'Exposed carbon fibre and light trim reduce mass. The seats are shaped to hold the driver in place.'],
  ],
  '750s-spider': [
    ['exterior', 'Roof in eleven seconds', 'Hard top', 'The folding hard top stows behind the cabin in about eleven seconds. It works at low speed and leaves the rear deck clean.'],
    ['exterior', 'Doors that rise', 'Dihedral doors', 'Dihedral doors open up and forward. Entry stays easy, and the door shape still guides air to the radiators.'],
    ['interior', 'Quiet at speed', 'Cabin acoustics', 'Glass and sealing keep wind noise low with the roof raised. Lower the roof and the engine takes over.'],
    ['interior', 'Controls within reach', 'Driver controls', 'The wheel carries the controls the driver needs. Everything else stays out of the way.'],
  ],
  gts: [
    ['exterior', 'Long-range proportions', 'Aerodynamics', 'A longer tail and a low nose set the line. Aerodynamic work reduces drag for long drives.'],
    ['exterior', 'Room for the journey', 'Luggage', 'Stowage over the engine and in the nose carries bags for two. The packaging is part of the design.'],
    ['interior', 'Comfort without the weight', 'Seats', 'Wide, supportive seats suit long days. Trim is chosen to keep mass low.'],
    ['interior', 'Light overhead', 'Glass roof', 'A large glass roof brightens the cabin. The tint changes at the touch of a button.'],
  ],
  w1: [
    ['exterior', 'Designed by air', 'Active aerodynamics', 'Every surface manages airflow. Front and rear elements adjust to keep the car planted at speed.'],
    ['exterior', 'One-piece carbon structure', 'Monocoque', 'A single carbon structure carries the hybrid powertrain and the suspension loads.'],
    ['interior', 'The seat is the structure', 'Fixed seat', 'The seat is part of the chassis. Pedals and steering adjust to the driver, not the other way round.'],
    ['interior', 'Information, edited', 'Driver display', 'The display shows the data the driver needs and nothing else.'],
  ],
  'artura-gt4': [
    ['exterior', 'Race aero package', 'Aerodynamics', 'A front splitter, a fixed rear wing and a flat floor generate downforce within the series rules.'],
    ['interior', 'Cockpit built for racing', 'Roll cage', 'An integrated roll cage, a fixed bucket seat and a quick-release wheel prepare the driver for a full race stint.'],
  ],
};

/** Highlight entry IDs per vehicle slug, in display order. */
export const HIGHLIGHTS_BY_VEHICLE = {};

export const HIGHLIGHT_SEEDS = Object.entries(HIGHLIGHTS).flatMap(([slug, rows]) =>
  rows.map(([area, title, tag, body], index) => {
    const id = `hl-${slug}-${index + 1}`;
    (HIGHLIGHTS_BY_VEHICLE[slug] ??= []).push(id);
    return {
      id,
      contentType: 'featureHighlight',
      fields: { title, body, area, tag },
      assets: { image: assetId(slug, area) },
    };
  }),
);

export const HIGHLIGHT_GROUP = { name: 'highlights', assets: [], entries: HIGHLIGHT_SEEDS };
