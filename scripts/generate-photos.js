/**
 * Converts generated photos into the committed WebP set under assets/photos/.
 *
 * Usage:
 *   node scripts/generate-photos.js --input=<dir> [--force=id,id] [--prompts]
 *   npm run photos -- --input=<dir>
 *
 * `--input <dir>` and `--force <ids>` (a space instead of `=`) work too.
 *
 * For each shot whose WebP is missing (or listed in --force), looks in the
 * input dir for `<shot.id>.png|jpg|jpeg|webp`, crops it to the shot's aspect
 * ratio (never upscaling) and writes assets/photos/<shot.id>.webp. Prints a
 * status table and the total size of assets/photos/. Exits 0 even when shots
 * are missing or fail to convert, since partial runs are expected. A forced id
 * with no input keeps its existing file (`kept`). `--prompts` prints
 * `id<TAB>WxH<TAB>prompt` for each shot still missing afterwards.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PHOTO_SHOTS } from '../src/photos/manifest.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PHOTO_DIR = join(ROOT, 'assets', 'photos');
const EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'];
const MAX_BYTES = 600000;

/** Marks each shot `kept` (file exists, not forced) or `missing`. */
export function planPhotos({ shots, fileExists, force = [] }) {
  const forced = new Set(force);
  return shots.map((shot) => ({
    shot,
    status: fileExists(shot.file) && !forced.has(shot.id) ? 'kept' : 'missing',
  }));
}

/**
 * Crops and converts one image to WebP. The output never exceeds the input's
 * dimensions: generators often return slightly smaller images than the
 * manifest size, and upscaling would only add blur.
 */
export function convertPhoto({ shot, input, output, inputWidth, inputHeight, convert, statSize }) {
  let outW = Math.min(shot.width, inputWidth);
  let outH = Math.round((outW * shot.height) / shot.width);
  if (outH > inputHeight) {
    outH = inputHeight;
    outW = Math.round((outH * shot.width) / shot.height);
  }
  const size = `${outW}x${outH}`;
  const run = (quality) =>
    convert([
      input, '-resize', `${size}^`, '-gravity', 'center', '-extent', size,
      '-auto-orient', '-strip', '-quality', String(quality), output,
    ]);
  run(82);
  if (statSize(output) > MAX_BYTES) run(75);
  return { width: outW, height: outH };
}

/** Parses `--input`, `--force` (each as `--flag=value` or `--flag value`) and `--prompts`. */
export function parseArgs(argv) {
  const opts = { input: null, force: [], prompts: false };
  const splitIds = (value) => value.split(',').filter(Boolean);
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const [flag, ...inline] = arg.split('=');
    if (flag === '--input' || flag === '--force') {
      let value;
      if (inline.length) value = inline.join('=');
      else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) value = argv[(i += 1)];
      else throw new Error(`${flag} needs a value`);
      if (flag === '--input') opts.input = value;
      else opts.force.push(...splitIds(value));
    } else if (arg === '--prompts') opts.prompts = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return opts;
}

/** `--force` ids that match no shot in the manifest. */
export function unknownForceIds({ shots, force = [] }) {
  const known = new Set(shots.map((shot) => shot.id));
  return force.filter((id) => !known.has(id));
}

/**
 * Runs the plan and returns `{ rows, stillMissing }`, rows being `[id, status, detail]`
 * with status `kept`, `new`, `missing` or `error`. Never throws for one bad shot.
 * A forced shot with no input keeps its existing file, so it is `kept`.
 */
export function processShots({ plan, findInput, identify, convert, statSize, fileExists, formatSize }) {
  const rows = [];
  const stillMissing = [];
  for (const { shot, status } of plan) {
    if (status === 'kept') {
      rows.push([shot.id, 'kept', formatSize(statSize(shot.file))]);
      continue;
    }
    const input = findInput(shot.id);
    if (!input) {
      if (fileExists(shot.file)) {
        rows.push([shot.id, 'kept', `${formatSize(statSize(shot.file))} (forced, no input found)`]);
      } else {
        rows.push([shot.id, 'missing', `expected ${shot.id}.png|jpg|jpeg|webp`]);
        stillMissing.push(shot);
      }
      continue;
    }
    let dims;
    try {
      dims = identify(input);
    } catch (error) {
      const message = String(error?.stderr || error?.message || error).trim().split('\n')[0];
      rows.push([shot.id, 'error', `identify failed for ${input}: ${message}`]);
      if (!fileExists(shot.file)) stillMissing.push(shot);
      continue;
    }
    convertPhoto({
      shot,
      input,
      output: shot.file,
      inputWidth: dims.width,
      inputHeight: dims.height,
      convert,
      statSize,
    });
    rows.push([shot.id, 'new', formatSize(statSize(shot.file))]);
  }
  return { rows, stillMissing };
}

function findInput(dir, id) {
  if (!dir) return null;
  for (const ext of EXTENSIONS) {
    const candidate = join(dir, `${id}.${ext}`);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function identify(path) {
  const [w, h] = execFileSync('identify', ['-format', '%w %h', `${path}[0]`], { encoding: 'utf8' })
    .trim()
    .split(/\s+/)
    .map(Number);
  return { width: w, height: h };
}

function formatSize(bytes) {
  return `${(bytes / 1024).toFixed(0)} KB`;
}

function totalPhotoBytes() {
  if (!existsSync(PHOTO_DIR)) return 0;
  return readdirSync(PHOTO_DIR)
    .filter((name) => name.endsWith('.webp'))
    .reduce((sum, name) => sum + statSync(join(PHOTO_DIR, name)).size, 0);
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const fileExists = (rel) => existsSync(join(ROOT, rel));
  for (const id of unknownForceIds({ shots: PHOTO_SHOTS, force: opts.force })) {
    console.warn(`warning: --force id "${id}" is not in the manifest; ignoring`);
  }
  mkdirSync(PHOTO_DIR, { recursive: true });
  const abs = (rel) => join(ROOT, rel);
  const plan = planPhotos({ shots: PHOTO_SHOTS, fileExists, force: opts.force });
  const { rows, stillMissing } = processShots({
    plan: plan.map(({ shot, status }) => ({ shot: { ...shot, file: abs(shot.file) }, status })),
    findInput: (id) => findInput(opts.input, id),
    identify,
    convert: (args) => execFileSync('convert', args),
    statSize: (path) => statSync(path).size,
    fileExists: existsSync,
    formatSize,
  });

  const idWidth = Math.max(...rows.map((r) => r[0].length), 'id'.length);
  console.log(`${'id'.padEnd(idWidth)}  ${'status'.padEnd(7)}  size`);
  for (const [id, status, size] of rows) console.log(`${id.padEnd(idWidth)}  ${status.padEnd(7)}  ${size}`);
  const kept = rows.filter((r) => r[1] === 'kept' || r[1] === 'new').length;
  console.log(`\n${kept}/${rows.length} photos present, assets/photos/ total ${formatSize(totalPhotoBytes())}`);

  if (opts.prompts) {
    for (const shot of stillMissing) console.log(`${shot.id}\t${shot.width}x${shot.height}\t${shot.prompt}`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
