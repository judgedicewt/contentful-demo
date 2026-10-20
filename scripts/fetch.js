/**
 * Reads published blog posts back through the Delivery API and prints them,
 * resolving the linked author. Useful for confirming `npm run setup` worked.
 */
import { createDeliveryClient } from '../src/clients.js';
import { loadConfig } from '../src/config.js';

const config = loadConfig();
if (config.missing.length > 0) {
  console.error(`Missing required variables: ${config.missing.join(', ')}`);
  process.exit(1);
}

const client = createDeliveryClient(config);

const posts = await client.getEntries({ content_type: 'blogPost', order: 'fields.publishDate', include: 1 });
console.log(`${posts.total} blog post(s)\n`);
for (const post of posts.items) {
  const { title, slug, publishDate, author } = post.fields;
  console.log(`${title}`);
  console.log(`  slug:    ${slug}`);
  console.log(`  date:    ${publishDate ?? '(none)'}`);
  console.log(`  author:  ${author?.fields?.name ?? '(none)'}`);
  console.log('');
}
