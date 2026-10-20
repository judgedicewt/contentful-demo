/**
 * Reads published vehicles back through the Delivery API and prints them
 * grouped by category. Useful for confirming `npm run setup` worked.
 */
import { createDeliveryClient } from '../src/clients.js';
import { loadConfig } from '../src/config.js';

const config = loadConfig();
if (config.missing.length > 0) {
  console.error(`Missing required variables: ${config.missing.join(', ')}`);
  process.exit(1);
}

const client = createDeliveryClient(config);

const result = await client.getEntries({
  content_type: 'vehicle',
  order: 'fields.category.sys.id,fields.yearIntroduced',
  include: 1,
  limit: 100,
});
console.log(`${result.total} vehicle(s)\n`);

const byCategory = new Map();
for (const vehicle of result.items) {
  const category = vehicle.fields.category?.fields?.name ?? '(no category)';
  if (!byCategory.has(category)) byCategory.set(category, []);
  byCategory.get(category).push(vehicle);
}

for (const [category, vehicles] of byCategory) {
  console.log(category);
  for (const vehicle of vehicles) {
    const { name, slug, status, yearIntroduced } = vehicle.fields;
    console.log(`  ${name}  (#/${slug}, ${status ?? 'unknown'}, ${yearIntroduced ?? '?'})`);
  }
  console.log('');
}
