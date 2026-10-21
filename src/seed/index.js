/**
 * Seed groups provisioned by `npm run setup`. Order is for readability only:
 * publishing is two-pass, so links may point at entries in any group.
 * Each group is `{ name, assets: [], entries: [] }`; see src/provision/fields.js
 * and src/provision/assets.js for the seed shapes.
 */
import { ASSET_GROUP } from './assets.js';
import { AUDIENCES_GROUP } from './audiences.js';
import { ENQUIRY_GROUP } from './enquiry.js';
import { LINKS_GROUP } from './links.js';
import { PAGES_GROUP } from './pages.js';
import { RETAILERS_GROUP } from './retailers.js';
import { SECTIONS_GROUP } from './sections.js';
import { SITE_GROUP } from './site.js';
import { STORIES_GROUP } from './stories.js';
import { VEHICLE_SEED_GROUPS } from './vehicles.js';

export const SEED_GROUPS = [ASSET_GROUP, ...VEHICLE_SEED_GROUPS, LINKS_GROUP, SECTIONS_GROUP, AUDIENCES_GROUP, STORIES_GROUP, PAGES_GROUP, RETAILERS_GROUP, SITE_GROUP, ENQUIRY_GROUP];
