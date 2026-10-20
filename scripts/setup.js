/**
 * Provisions the demo content model and sample entries in the configured
 * space. Idempotent: existing content types and entries are updated in
 * place and republished rather than duplicated.
 */
import { createManagementClient } from '../src/clients.js';
import { loadConfig } from '../src/config.js';
import { CONTENT_TYPES, ENTRIES } from '../src/content-model.js';

const config = loadConfig();
if (config.missing.length > 0) {
  console.error(`Missing required variables: ${config.missing.join(', ')}`);
  console.error('Run `npm run check` for details.');
  process.exit(1);
}

const cma = createManagementClient(config);
const space = await cma.getSpace(config.spaceId);
const environment = await space.getEnvironment(config.environmentId);
console.log(`Space "${space.name}" (${space.sys.id}), environment "${environment.sys.id}"\n`);

console.log('Content types');
for (const definition of CONTENT_TYPES) {
  const { id, ...body } = definition;
  let contentType;
  let action;
  try {
    contentType = await environment.getContentType(id);
    contentType.name = body.name;
    contentType.displayField = body.displayField;
    contentType.fields = body.fields;
    contentType = await contentType.update();
    action = 'updated';
  } catch (error) {
    if (!isNotFound(error)) throw error;
    contentType = await environment.createContentTypeWithId(id, body);
    action = 'created';
  }
  contentType = await contentType.publish();
  console.log(`  ${action.padEnd(8)} ${id} (v${contentType.sys.publishedVersion})`);
}

console.log('\nEntries');
for (const definition of ENTRIES) {
  const fields = localize(definition.fields);
  for (const [fieldId, targetId] of Object.entries(definition.links ?? {})) {
    fields[fieldId] = {
      'en-US': { sys: { type: 'Link', linkType: 'Entry', id: targetId } },
    };
  }

  let entry;
  let action;
  try {
    entry = await environment.getEntry(definition.id);
    entry.fields = fields;
    entry = await entry.update();
    action = 'updated';
  } catch (error) {
    if (!isNotFound(error)) throw error;
    entry = await environment.createEntryWithId(definition.contentType, definition.id, { fields });
    action = 'created';
  }
  entry = await entry.publish();
  console.log(`  ${action.padEnd(8)} ${definition.contentType}/${definition.id} (v${entry.sys.publishedVersion})`);
}

console.log('\nSetup complete. Run `npm run fetch` to read the entries back through the Delivery API.');

function localize(fields) {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, { 'en-US': value }]));
}

function isNotFound(error) {
  try {
    return JSON.parse(error.message).status === 404;
  } catch {
    return false;
  }
}
