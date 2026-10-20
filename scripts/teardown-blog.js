/**
 * Removes the original blog demo: unpublishes and deletes every `blogPost`
 * and `author` entry, then unpublishes and deletes the two content types.
 * Idempotent: anything already gone is reported as `absent`.
 */
import { createManagementClient } from '../src/clients.js';
import { loadConfig } from '../src/config.js';
import { describeError, isNotFound } from '../src/provision/errors.js';
import { createRequester, isArchived, isPublished } from '../src/provision/requests.js';

const CONTENT_TYPE_IDS = ['blogPost', 'author'];

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
  console.log(`Space "${space.name}" (${space.sys.id}), environment "${environment.sys.id}"\n`);

  const request = createRequester({ log: console.log });

  for (const contentTypeId of CONTENT_TYPE_IDS) {
    console.log(`Content type ${contentTypeId}`);
    let contentType = null;
    try {
      contentType = await request(`get content type ${contentTypeId}`, () => environment.getContentType(contentTypeId));
    } catch (error) {
      if (!isNotFound(error)) throw error;
    }
    if (!contentType) {
      console.log('  absent');
      continue;
    }

    const removed = await deleteEntriesOf(environment, contentTypeId, request);
    console.log(`  ${removed} entr${removed === 1 ? 'y' : 'ies'} deleted`);

    if (isPublished(contentType) || contentType.sys.publishedVersion) {
      contentType = await request(`unpublish content type ${contentTypeId}`, () => contentType.unpublish());
      console.log('  unpublished');
    }
    await request(`delete content type ${contentTypeId}`, () => contentType.delete());
    console.log('  deleted');
  }

  console.log('\nTeardown complete.');
} catch (error) {
  console.error(`\nTeardown failed: ${describeError(error)}`);
  process.exit(1);
}

async function deleteEntriesOf(environment, contentTypeId, request) {
  let removed = 0;
  for (;;) {
    const page = await request(`list ${contentTypeId} entries`, () =>
      environment.getEntries({ content_type: contentTypeId, limit: 100 }),
    );
    if (page.items.length === 0) return removed;
    for (let entry of page.items) {
      const id = entry.sys.id;
      if (isArchived(entry)) entry = await request(`unarchive entry ${id}`, () => entry.unarchive());
      if (entry.sys.publishedVersion) entry = await request(`unpublish entry ${id}`, () => entry.unpublish());
      await request(`delete entry ${id}`, () => entry.delete());
      removed += 1;
      console.log(`  deleted   ${contentTypeId}/${id}`);
    }
  }
}
