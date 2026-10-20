/**
 * Verifies that the required Contentful environment variables are set and
 * that both the Management API and the Delivery API accept the tokens for
 * the configured space and environment. Exits non-zero on any failure.
 */
import { createManagementClient, createDeliveryClient } from '../src/clients.js';
import { loadConfig, mask } from '../src/config.js';

const config = loadConfig();
let failed = false;

console.log('Environment variables');
for (const name of config.required) {
  const value = process.env[name];
  const status = value ? 'ok     ' : 'MISSING';
  const shown = name.endsWith('_TOKEN') ? mask(value) : value ?? '(unset)';
  console.log(`  ${status} ${name} = ${shown}`);
}
for (const name of config.optional) {
  console.log(`  opt    ${name} = ${mask(process.env[name])}`);
}

if (config.missing.length > 0) {
  console.error(`\nMissing required variables: ${config.missing.join(', ')}`);
  process.exit(1);
}

console.log('\nManagement API');
try {
  const cma = createManagementClient(config);
  const space = await cma.getSpace(config.spaceId);
  const environment = await space.getEnvironment(config.environmentId);
  const contentTypes = await environment.getContentTypes({ limit: 100 });
  console.log(`  ok      space "${space.name}" (${space.sys.id})`);
  console.log(`  ok      environment "${environment.sys.id}"`);
  console.log(
    `  info    ${contentTypes.total} content type(s): ${
      contentTypes.items.map((ct) => ct.sys.id).join(', ') || '(none)'
    }`,
  );
} catch (error) {
  failed = true;
  console.error(`  FAILED  ${describe(error)}`);
}

console.log('\nDelivery API');
try {
  const cda = createDeliveryClient(config);
  const result = await cda.getEntries({ limit: 1 });
  console.log(`  ok      ${result.total} published entr${result.total === 1 ? 'y' : 'ies'} visible`);
} catch (error) {
  failed = true;
  console.error(`  FAILED  ${describe(error)}`);
}

if (failed) {
  console.error('\nCheck failed.');
  process.exit(1);
}
console.log('\nAll checks passed.');

function describe(error) {
  try {
    const parsed = JSON.parse(error.message);
    return `${parsed.status ?? ''} ${parsed.statusText ?? ''} ${parsed.message ?? ''}`.trim();
  } catch {
    return error.message;
  }
}
