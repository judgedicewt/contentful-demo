/**
 * Converts generated photos into the committed WebP set under assets/photos/.
 *
 * Usage:
 *   node scripts/generate-photos.js --input=<dir> [--force=id,id] [--prompts]
 *
 * For each shot whose WebP is missing (or listed in --force), looks in the
 * input dir for `<shot.id>.png|jpg|jpeg|webp`, crops it to the shot's aspect
 * ratio (never upscaling) and writes assets/photos/<shot.id>.webp. Prints a
 * status table and the total size of assets/photos/. Exits 0 even when shots
 * are missing, since partial runs are expected. `--prompts` prints
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
      '-strip', '-quality', String(quality), output,
    ]);
  run(82);
  if (statSize(output) > MAX_BYTES) run(75);
  return { width: outW, height: outH };
}

function parseArgs(argv) {
  const opts = { input: null, force: [], prompts: false };
  for (const arg of argv) {
    if (arg.startsWith('--input=')) opts.input = arg.slice('--input='.length);
    else if (arg.startsWith('--force=')) opts.force = arg.slice('--force='.length).split(',').filter(Boolean);
    else if (arg === '--prompts') opts.prompts = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return opts;
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
  mkdirSync(PHOTO_DIR, { recursive: true });
  const rows = [];
  const stillMissing = [];

  for (const { shot, status } of planPhotos({ shots: PHOTO_SHOTS, fileExists, force: opts.force })) {
    const output = join(ROOT, shot.file);
    if (status === 'kept') {
      rows.push([shot.id, 'kept', formatSize(statSync(output).size)]);
      continue;
    }
    const input = findInput(opts.input, shot.id);
    if (!input) {
      rows.push([shot.id, 'missing', `expected ${shot.id}.png|jpg|jpeg|webp`]);
      stillMissing.push(shot);
      continue;
    }
    const { width, height } = identify(input);
    convertPhoto({
      shot,
      input,
      output,
      inputWidth: width,
      inputHeight: height,
      convert: (args) => execFileSync('convert', args),
      statSize: (path) => statSync(path).size,
    });
    rows.push([shot.id, 'new', formatSize(statSync(output).size)]);
  }

  const idWidth = Math.max(...rows.map((r) => r[0].length), 'id'.length);
  console.log(`${'id'.padEnd(idWidth)}  ${'status'.padEnd(7)}  size`);
  for (const [id, status, size] of rows) console.log(`${id.padEnd(idWidth)}  ${status.padEnd(7)}  ${size}`);
  const kept = rows.filter((r) => r[1] !== 'missing').length;
  console.log(`\n${kept}/${rows.length} photos present, assets/photos/ total ${formatSize(totalPhotoBytes())}`);

  if (opts.prompts) {
    for (const shot of stillMissing) console.log(`${shot.id}\t${shot.width}x${shot.height}\t${shot.prompt}`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
