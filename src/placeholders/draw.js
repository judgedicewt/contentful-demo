/**
 * Pure SVG rendering for placeholder images. `renderSvg(entry)` takes a
 * manifest entry and returns a self-contained SVG string: no external
 * fonts, images, or scripts, and comfortably under 20 KB.
 */
import { SIZES } from './manifest.js';

export const PALETTES = {
  carbon: { bg: '#141414', bg2: '#222222', car: '#d9d9d9', text: '#f4f4f4', muted: '#9c9c9c', line: '#ffffff', accent: '#ff8000', shade: '#000000' },
  midnight: { bg: '#0d1626', bg2: '#17243a', car: '#cfd8e4', text: '#f1f4f8', muted: '#8d9db3', line: '#ffffff', accent: '#ff8000', shade: '#000000' },
  mist: { bg: '#d6dadd', bg2: '#e7eaec', car: '#1a1a1a', text: '#141414', muted: '#5c636a', line: '#000000', accent: '#ff8000', shade: '#000000' },
  white: { bg: '#ffffff', bg2: '#f1f1f1', car: '#151515', text: '#141414', muted: '#6d6d6d', line: '#000000', accent: '#ff8000', shade: '#000000' },
  papaya: { bg: '#ff8000', bg2: '#ff962b', car: '#161616', text: '#161616', muted: '#5f2e00', line: '#000000', accent: '#161616', shade: '#3a1a00' },
};

// The car is drawn in a 1000 x 330 design box, nose to the left, ground at
// y = 300, and then scaled and translated to fit each canvas.
const BOX = { width: 1000, height: 330 };

const BODY = {
  // Cab-forward wedge: long low nose, screen base over the front axle, roof
  // peak above the driver, long fastback to a tall tail. Underside has a
  // front splitter and rear diffuser.
  coupe:
    'M22 244C22 226 40 216 84 211L236 200C280 170 340 140 410 132' +
    'C440 128 480 128 508 134C570 148 630 170 690 182L930 196' +
    'C956 200 966 226 950 246L942 258L880 264L130 264L50 260Z',
  spider:
    'M22 244C22 226 40 216 84 211L236 200C280 170 330 146 396 136L414 136' +
    'L426 176L500 178C522 178 536 160 560 160L590 160C640 162 680 176 710 184' +
    'L930 196C956 200 966 226 950 246L942 258L880 264L130 264L50 260Z',
};

const WING = 'M750 158L948 172L948 182L750 170Z M898 180L910 180L918 198L906 198Z';
const INTAKE = 'M600 214L648 204L648 248L620 248Z';
const HEADLAMP = 'M56 222L114 214L124 226L70 232Z';
const WHEELS = [
  { cx: 200, cy: 270 },
  { cx: 800, cy: 270 },
];
const WHEEL = { arch: 62, tyre: 50, rim: 29, hub: 12 };

const num = (value) => String(Math.round(value * 10) / 10);

export function escapeXml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function carGroup(silhouette, colours) {
  const body = BODY[silhouette];
  if (!body) return '';
  const parts = [`<path d="${body}" fill="${colours.car}"/>`];
  parts.push(`<path d="${WING}" fill="${colours.car}"/>`);
  parts.push(`<path d="${INTAKE}" fill="${colours.bg}"/>`);
  parts.push(`<path d="${HEADLAMP}" fill="${colours.bg}"/>`);
  for (const { cx, cy } of WHEELS) {
    parts.push(
      `<circle cx="${cx}" cy="${cy}" r="${WHEEL.arch}" fill="${colours.bg}"/>`,
      `<circle cx="${cx}" cy="${cy}" r="${WHEEL.tyre}" fill="${colours.car}"/>`,
      `<circle cx="${cx}" cy="${cy}" r="${WHEEL.rim}" fill="${colours.bg}"/>`,
      `<circle cx="${cx}" cy="${cy}" r="${WHEEL.hub}" fill="${colours.car}"/>`,
    );
  }
  return parts.join('');
}

function abstractGroup(colours) {
  // Non-car imagery (experiences): three offset rings read as a track or
  // a horizon without pretending to be a photograph.
  const rings = [
    { cx: 500, cy: 165, r: 150, opacity: 0.55 },
    { cx: 540, cy: 165, r: 110, opacity: 0.35 },
    { cx: 580, cy: 165, r: 70, opacity: 0.2 },
  ];
  return rings
    .map(
      (ring) =>
        `<circle cx="${ring.cx}" cy="${ring.cy}" r="${ring.r}" fill="none" stroke="${colours.car}" stroke-width="3" opacity="${ring.opacity}"/>`,
    )
    .join('');
}

/**
 * Renders a manifest entry to an SVG document string.
 */
export function renderSvg(entry) {
  const size = SIZES[entry.kind];
  if (!size) throw new Error(`Unknown placeholder kind "${entry.kind}" for ${entry.id}`);
  const colours = PALETTES[entry.palette];
  if (!colours) throw new Error(`Unknown palette "${entry.palette}" for ${entry.id}`);

  const { width: W, height: H } = size;
  const margin = Math.round(W * 0.09);
  const light = entry.palette === 'mist' || entry.palette === 'white';
  const textureOpacity = light ? 0.07 : 0.05;

  // Subject placement.
  const scale = Math.min((W - margin * 2) / BOX.width, (H * 0.42) / BOX.height);
  const tx = (W - BOX.width * scale) / 2;
  const ty = H * 0.47 - (BOX.height / 2) * scale;
  const groundY = ty + 320 * scale;

  // Typography.
  const labelSize = Math.round(Math.min(W, H) * 0.052);
  const smallSize = Math.round(labelSize * 0.38);
  const labelY = H - Math.round(margin * 0.7);
  const eyebrowY = labelY - labelSize - Math.round(smallSize * 0.9);
  const barY = eyebrowY - smallSize - Math.round(smallSize * 0.9);

  const tagText = 'PLACEHOLDER';
  const tagSize = smallSize;
  const tagPad = Math.round(tagSize * 0.9);
  const tagWidth = Math.round(tagSize * 0.78 * tagText.length + tagPad * 2);
  const tagHeight = Math.round(tagSize * 2.2);
  const tagX = W - margin - tagWidth;
  const tagY = Math.round(margin * 0.7);

  const idSafe = entry.id.replace(/[^a-z0-9-]/gi, '');
  const gradId = `g-${idSafe}`;
  const texId = `t-${idSafe}`;
  const label = escapeXml(entry.label).toUpperCase();
  const eyebrow = `${entry.kind.toUpperCase()} · ${W} × ${H}`;

  const subject =
    entry.silhouette === 'none' ? abstractGroup(colours) : carGroup(entry.silhouette, colours);

  const shadow =
    entry.silhouette === 'none'
      ? ''
      : `<ellipse cx="500" cy="322" rx="470" ry="9" fill="${colours.shade}" opacity="0.28"/>`;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${escapeXml(entry.label)} placeholder">`,
    `<title>${escapeXml(entry.label)} (placeholder)</title>`,
    '<defs>',
    `<linearGradient id="${gradId}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${colours.bg}"/><stop offset="1" stop-color="${colours.bg2}"/></linearGradient>`,
    `<pattern id="${texId}" width="28" height="28" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="28" stroke="${colours.line}" stroke-width="1" stroke-opacity="${textureOpacity}"/></pattern>`,
    '</defs>',
    `<rect width="${W}" height="${H}" fill="url(#${gradId})"/>`,
    `<rect width="${W}" height="${H}" fill="url(#${texId})"/>`,
    `<line x1="0" y1="${num(groundY)}" x2="${W}" y2="${num(groundY)}" stroke="${colours.line}" stroke-opacity="0.12" stroke-width="1"/>`,
    `<g transform="translate(${num(tx)} ${num(ty)}) scale(${num(scale * 1000) / 1000})">${shadow}${subject}</g>`,
    `<g font-family="system-ui, sans-serif" fill="${colours.text}">`,
    `<rect x="${margin}" y="${barY}" width="${Math.round(labelSize * 0.9)}" height="${Math.max(3, Math.round(labelSize * 0.07))}" fill="${colours.accent}"/>`,
    `<text x="${margin}" y="${eyebrowY}" font-size="${smallSize}" letter-spacing="${num(smallSize * 0.22)}" fill="${colours.muted}">${eyebrow}</text>`,
    `<text x="${margin}" y="${labelY}" font-size="${labelSize}" font-weight="600" letter-spacing="${num(labelSize * 0.1)}">${label}</text>`,
    `<rect x="${tagX}" y="${tagY}" width="${tagWidth}" height="${tagHeight}" rx="${Math.round(tagHeight / 2)}" fill="none" stroke="${colours.muted}" stroke-width="1.5"/>`,
    `<text x="${tagX + Math.round(tagWidth / 2)}" y="${tagY + Math.round(tagHeight * 0.66)}" font-size="${tagSize}" letter-spacing="${num(tagSize * 0.18)}" text-anchor="middle" fill="${colours.muted}">${tagText}</text>`,
    '</g>',
    '</svg>',
    '',
  ].join('\n');
}
