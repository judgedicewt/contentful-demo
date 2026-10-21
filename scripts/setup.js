/**
 * Provisions the locales, content model and seed content in the configured space.
 * Idempotent: locales are matched by code, and content types, assets and
 * entries use fixed IDs, so re-running updates and republishes instead of
 * duplicating.
 *
 * Usage:
 *   node scripts/setup.js                 locales, content types, then every seed group
 *   node scripts/setup.js --types-only    locales and content types only
 *   node scripts/setup.js --only=<group>  one seed group (comma-separate for several); skips locales and content types
 *   node scripts/setup.js --dry-run       validate the model and seeds, no API calls; exit 1 on problems
 *
 * Seeds come from src/seed/index.js (`SEED_GROUPS`). Before writing anything,
 * the run validates the model and seeds the same way --dry-run does and
 * aborts on problems.
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createManagementClient } from '../src/clients.js';
import { loadConfig } from '../src/config.js';
import { CONTENT_TYPES, LOCALES } from '../src/content-model.js';
import { PROJECT_ROOT } from '../src/provision/assets.js';
import { provisionContentTypes } from '../src/provision/content-types.js';
import { provisionEntries } from '../src/provision/entries.js';
import { describeError } from '../src/provision/errors.js';
import { ensureLocales } from '../src/provision/locales.js';
import { createRequester } from '../src/provision/requests.js';
import { formatProblem, selectGroups, validateContentModel, validateSeeds } from '../src/provision/validate.js';

const flags = parseFlags(process.argv.slice(2));
if (flags.help) {
  console.log('Usage: node scripts/setup.js [--dry-run] [--types-only] [--only=<group>[,<group>]]');
  process.exit(0);
}

const { SEED_GROUPS } = await import('../src/seed/index.js');
const fileExists = (file) => existsSync(resolve(PROJECT_ROOT, file));

// Validation runs for both dry and real runs.
const problems = validateContentModel(CONTENT_TYPES);
if (!flags.typesOnly) {
  problems.push(...validateSeeds(SEED_GROUPS, CONTENT_TYPES, { only: flags.only, fileExists }));
}

console.log(`${flags.dryRun ? 'Dry run: ' : ''}${CONTENT_TYPES.length} content types${flags.typesOnly ? '' : describeGroups(SEED_GROUPS, flags.only)}`);
if (!flags.typesOnly) {
  for (const group of selectGroups(SEED_GROUPS, flags.only)) {
    console.log(`  group ${group.name.padEnd(16)} ${String(group.assets?.length ?? 0).padStart(3)} assets ${String(group.entries?.length ?? 0).padStart(4)} entries`);
  }
}

if (problems.length > 0) {
  console.error(`\n${problems.length} problem${problems.length === 1 ? '' : 's'}:`);
  for (const problem of problems) console.error(`  ${formatProblem(problem)}`);
  console.error(flags.dryRun ? '\nDry run failed.' : '\nNothing was written. Fix the problems above and re-run.');
  process.exit(1);
}

if (flags.dryRun) {
  console.log('\nDry run passed: no problems found.');
  process.exit(0);
}

const config = loadConfig();
if (config.missing.length > 0) {
  console.error(`Missing required variables: ${config.missing.join(', ')}`);
  console.error('Run `npm run check` for details.');
  process.exit(1);
}

try {
  const cma = createManagementClient(config);
  const space = await cma.getSpace(config.spaceId);
  const environment = await space.getEnvironment(config.environmentId);
  console.log(`\nSpace "${space.name}" (${space.sys.id}), environment "${environment.sys.id}"\n`);

  const request = createRequester({ log: console.log });

  if (!flags.only) {
    const locales = await ensureLocales(environment, LOCALES, { log: console.log, request });
    console.log(`  ${summarise(locales)}`);

    const types = await provisionContentTypes(environment, CONTENT_TYPES, { log: console.log, request });
    console.log(`  ${summarise(types)}`);
  }

  if (!flags.typesOnly) {
    const result = await provisionEntries(environment, SEED_GROUPS, { only: flags.only, log: console.log, request });
    console.log(`\nAssets:  ${summarise(result.assets)}`);
    console.log(`Entries: ${summarise(result.entries)}`);
    if (result.failures.length > 0) {
      console.error(`\n${result.failures.length} entr${result.failures.length === 1 ? 'y' : 'ies'} failed to publish:`);
      for (const failure of result.failures) console.error(`  ${failure.contentType}/${failure.id}: ${failure.error}`);
      process.exit(1);
    }
  }

  console.log('\nSetup complete.');
} catch (error) {
  console.error(`\nSetup failed: ${describeError(error)}`);
  process.exit(1);
}

function parseFlags(argv) {
  const flags = { only: null, typesOnly: false, dryRun: false, help: false };
  for (const arg of argv) {
    if (arg === '--dry-run') flags.dryRun = true;
    else if (arg === '--types-only') flags.typesOnly = true;
    else if (arg === '--help' || arg === '-h') flags.help = true;
    else if (arg.startsWith('--only=')) flags.only = arg.slice('--only='.length);
    else if (arg === '--only') {
      console.error('Use --only=<group>');
      process.exit(2);
    } else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(2);
    }
  }
  if (flags.only && flags.typesOnly) {
    console.error('--only and --types-only cannot be combined.');
    process.exit(2);
  }
  return flags;
}

function describeGroups(groups, only) {
  const selected = selectGroups(groups, only);
  const scope = only ? ` (--only=${only})` : '';
  return `, ${selected.length} of ${groups.length} seed group${groups.length === 1 ? '' : 's'}${scope}`;
}

function summarise(counts) {
  return Object.entries(counts)
    .map(([key, value]) => `${value} ${key}`)
    .join(', ');
}
