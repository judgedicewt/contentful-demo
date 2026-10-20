/**
 * Pure validation of seed groups against the content model. No network and
 * no filesystem access (file existence is checked through an injected
 * `fileExists` callback), so `scripts/setup.js --dry-run` and the unit tests
 * share this code.
 *
 * Every problem is `{ group, kind, id, field, message }`; `formatProblem`
 * renders one for the console.
 */

const SYMBOL_MAX = 256;
const TEXT_MAX = 50000;
const SLUG_LIKE = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;

export function formatProblem(problem) {
  const where = [problem.group, problem.id, problem.field].filter(Boolean).join(' / ');
  return `${problem.kind.padEnd(16)} ${where ? `${where}: ` : ''}${problem.message}`;
}

/** Picks the groups named by `only` (string, comma-separated string, or array). */
export function selectGroups(seedGroups, only) {
  const wanted = normaliseOnly(only);
  if (!wanted) return seedGroups;
  return seedGroups.filter((group) => wanted.includes(group.name));
}

function normaliseOnly(only) {
  if (!only) return null;
  const list = Array.isArray(only) ? only : String(only).split(',');
  const names = list.map((name) => String(name).trim()).filter(Boolean);
  return names.length > 0 ? names : null;
}

/**
 * Checks the content model itself: duplicate IDs, display fields, link
 * validations pointing at unknown types, malformed field definitions.
 */
export function validateContentModel(contentTypes) {
  const problems = [];
  const ids = new Set();
  const add = (id, field, message, kind = 'model') => problems.push({ group: 'content-model', kind, id, field, message });

  for (const type of contentTypes) {
    if (!type.id || !type.name) add(type.id, undefined, 'content type needs id and name');
    if (ids.has(type.id)) add(type.id, undefined, 'duplicate content type id');
    ids.add(type.id);
    if (type.description && type.description.length > 500) add(type.id, undefined, 'description longer than 500 characters');
    if (!Array.isArray(type.fields) || type.fields.length === 0) {
      add(type.id, undefined, 'content type has no fields');
      continue;
    }
    const fieldIds = new Set();
    for (const field of type.fields) {
      if (!field.id || !field.name || !field.type) add(type.id, field.id, 'field needs id, name and type');
      if (fieldIds.has(field.id)) add(type.id, field.id, 'duplicate field id');
      fieldIds.add(field.id);
      if (field.name && field.name.length > 50) add(type.id, field.id, 'field name longer than 50 characters');
      if (field.type === 'Link' && !field.linkType) add(type.id, field.id, 'Link field needs linkType');
      if (field.type === 'Array' && !field.items?.type) add(type.id, field.id, 'Array field needs items.type');
      if (field.type === 'Array' && field.items?.type === 'Link' && !field.items.linkType) {
        add(type.id, field.id, 'Array of links needs items.linkType');
      }
      const inTarget = field.type === 'Array' ? field.items?.type : field.type;
      for (const validation of allValidations(field)) {
        if (validation.in && !['Symbol', 'Text', 'Integer', 'Number'].includes(inTarget)) {
          add(type.id, field.id, `"in" validation is not allowed on ${inTarget} values`);
        }
        if (validation.linkContentType) {
          for (const target of validation.linkContentType) {
            if (!contentTypes.some((candidate) => candidate.id === target)) {
              add(type.id, field.id, `linkContentType references unknown content type "${target}"`);
            }
          }
        }
        if (validation.regexp) {
          try {
            new RegExp(validation.regexp.pattern, validation.regexp.flags ?? '');
          } catch (error) {
            add(type.id, field.id, `invalid regexp: ${error.message}`);
          }
        }
      }
    }
    const display = type.fields.find((field) => field.id === type.displayField);
    if (!display) add(type.id, type.displayField, 'displayField is not a field of the type');
    else if (!['Symbol', 'Text'].includes(display.type)) add(type.id, type.displayField, 'displayField must be Symbol or Text');
  }
  return problems;
}

function allValidations(field) {
  return [...(field.validations ?? []), ...(field.items?.validations ?? [])];
}

/**
 * Validates seed groups against `contentTypes`.
 *
 * All groups contribute to the set of known entry and asset IDs, so a link
 * from one group to another is fine. Problems are reported for the groups
 * selected by `only` (default: all).
 */
export function validateSeeds(seedGroups, contentTypes, { only, fileExists } = {}) {
  const problems = [];
  const typesById = new Map(contentTypes.map((type) => [type.id, type]));

  if (!Array.isArray(seedGroups)) {
    return [{ group: undefined, kind: 'seed', message: 'SEED_GROUPS must be an array of { name, assets, entries }' }];
  }

  const wanted = normaliseOnly(only);
  if (wanted) {
    for (const name of wanted) {
      if (!seedGroups.some((group) => group.name === name)) {
        problems.push({ group: name, kind: 'unknown-group', message: `no seed group named "${name}"` });
      }
    }
  }

  // Pass 1: index every declared ID across all groups.
  const entriesById = new Map();
  const assetsById = new Map();
  seedGroups.forEach((group, index) => {
    const groupName = group?.name || `#${index}`;
    if (!group || typeof group.name !== 'string' || !group.name) {
      problems.push({ group: groupName, kind: 'seed', message: 'seed group needs a string name' });
    }
    for (const asset of group?.assets ?? []) {
      if (!asset?.id) continue;
      if (assetsById.has(asset.id)) {
        problems.push({ group: groupName, kind: 'duplicate-id', id: asset.id, message: `asset id already declared in group "${assetsById.get(asset.id).group}"` });
      } else {
        assetsById.set(asset.id, { group: groupName, seed: asset });
      }
    }
    for (const entry of group?.entries ?? []) {
      if (!entry?.id) continue;
      if (entriesById.has(entry.id)) {
        problems.push({ group: groupName, kind: 'duplicate-id', id: entry.id, message: `entry id already declared in group "${entriesById.get(entry.id).group}"` });
      } else {
        entriesById.set(entry.id, { group: groupName, seed: entry });
      }
    }
  });

  // Pass 2: validate each selected group.
  const uniqueValues = new Map(); // `${contentType}.${field}` -> Map(value -> entryId)
  const selected = wanted ? seedGroups.filter((group) => wanted.includes(group?.name)) : seedGroups;

  for (const group of selected) {
    const groupName = group?.name;
    const ctx = { problems, typesById, entriesById, assetsById, uniqueValues, groupName, fileExists };
    for (const asset of group?.assets ?? []) validateAssetSeed(asset, ctx);
    for (const entry of group?.entries ?? []) validateEntrySeed(entry, ctx);
  }

  return problems;
}

function validateAssetSeed(asset, { problems, groupName, fileExists }) {
  const add = (kind, field, message) => problems.push({ group: groupName, kind, id: asset?.id, field, message });
  if (!asset || typeof asset !== 'object') return add('seed', undefined, 'asset seed must be an object');
  if (typeof asset.id !== 'string' || !SLUG_LIKE.test(asset.id)) add('seed', 'id', 'asset id must be a string of letters, digits, "-", "_" or "."');
  if (typeof asset.title !== 'string' || !asset.title) add('seed', 'title', 'asset needs a title');
  if (asset.description !== undefined && typeof asset.description !== 'string') add('seed', 'description', 'description must be a string');
  if (typeof asset.file !== 'string' || !asset.file) add('seed', 'file', 'asset needs a file path');
  else if (fileExists && !fileExists(asset.file)) add('missing-file', 'file', `file not found: ${asset.file}`);
  if (typeof asset.contentType !== 'string' || !/^[\w.+-]+\/[\w.+-]+$/.test(asset.contentType)) {
    add('seed', 'contentType', 'asset needs a MIME contentType such as image/svg+xml');
  }
}

function validateEntrySeed(seed, ctx) {
  const { problems, typesById, groupName } = ctx;
  const add = (kind, field, message) => problems.push({ group: groupName, kind, id: seed?.id, field, message });
  if (!seed || typeof seed !== 'object') return add('seed', undefined, 'entry seed must be an object');
  if (typeof seed.id !== 'string' || !SLUG_LIKE.test(seed.id)) add('seed', 'id', 'entry id must be a string of letters, digits, "-", "_" or "."');
  const type = typesById.get(seed.contentType);
  if (!type) return add('unknown-type', 'contentType', `unknown content type "${seed.contentType}"`);

  const fieldsById = new Map(type.fields.map((field) => [field.id, field]));
  const provided = new Map(); // fieldId -> 'fields' | 'links' | 'assets'
  for (const source of ['fields', 'links', 'assets']) {
    const bag = seed[source];
    if (bag === undefined) continue;
    if (!bag || typeof bag !== 'object' || Array.isArray(bag)) {
      add('seed', source, `${source} must be an object keyed by field id`);
      continue;
    }
    for (const [fieldId, value] of Object.entries(bag)) {
      if (value === undefined) continue;
      if (!fieldsById.has(fieldId)) {
        add('unknown-field', fieldId, `no field "${fieldId}" on content type "${type.id}"`);
        continue;
      }
      if (provided.has(fieldId)) {
        add('seed', fieldId, `field given in both ${provided.get(fieldId)} and ${source}`);
        continue;
      }
      provided.set(fieldId, source);
      const field = fieldsById.get(fieldId);
      if (source === 'fields') validateFieldValue(field, value, seed, ctx);
      else validateLinkValue(field, value, source, seed, ctx);
    }
  }

  for (const field of type.fields) {
    if (!field.required) continue;
    if (!provided.has(field.id)) {
      add('missing-required', field.id, `required field "${field.id}" is missing`);
      continue;
    }
    const value = seed[provided.get(field.id)][field.id];
    if (Array.isArray(value) && value.length === 0) add('missing-required', field.id, `required field "${field.id}" is empty`);
    if (typeof value === 'string' && value.trim() === '') add('missing-required', field.id, `required field "${field.id}" is blank`);
  }
}

function validateFieldValue(field, value, seed, ctx) {
  const { problems, groupName } = ctx;
  const add = (kind, message) => problems.push({ group: groupName, kind, id: seed.id, field: field.id, message });

  switch (field.type) {
    case 'Symbol':
    case 'Text': {
      if (typeof value !== 'string') return add('type', `expected a string for ${field.type}, got ${describeType(value)}`);
      const max = field.type === 'Symbol' ? SYMBOL_MAX : TEXT_MAX;
      if (value.length > max) add('type', `${field.type} values may be at most ${max} characters (got ${value.length})`);
      break;
    }
    case 'Integer':
      if (!Number.isInteger(value)) return add('type', `expected an integer, got ${describeType(value)}`);
      break;
    case 'Number':
      if (typeof value !== 'number' || !Number.isFinite(value)) return add('type', `expected a number, got ${describeType(value)}`);
      break;
    case 'Boolean':
      if (typeof value !== 'boolean') return add('type', `expected a boolean, got ${describeType(value)}`);
      break;
    case 'Date':
      if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) return add('type', `expected an ISO 8601 date string, got ${describeType(value)}`);
      break;
    case 'Location':
      if (!value || typeof value !== 'object' || typeof value.lat !== 'number' || typeof value.lon !== 'number') {
        return add('type', 'expected a Location object { lat, lon } with numeric values');
      }
      if (value.lat < -90 || value.lat > 90 || value.lon < -180 || value.lon > 180) add('type', 'Location out of range');
      break;
    case 'RichText':
      if (!value || typeof value !== 'object' || value.nodeType !== 'document' || !Array.isArray(value.content)) {
        return add('type', 'expected a rich text document ({ nodeType: "document", content: [...] })');
      }
      break;
    case 'Link':
      if (!isLinkObject(value, field.linkType)) {
        return add('type', `expected ${field.linkType} link; put the id under "${field.linkType === 'Asset' ? 'assets' : 'links'}" instead`);
      }
      checkLinkTarget(field, value.sys.id, field.linkType, seed, ctx);
      break;
    case 'Array': {
      if (!Array.isArray(value)) return add('type', `expected an array, got ${describeType(value)}`);
      const itemType = field.items?.type;
      value.forEach((item, index) => {
        if (itemType === 'Symbol') {
          if (typeof item !== 'string') add('type', `item ${index}: expected a string`);
          else if (item.length > SYMBOL_MAX) add('type', `item ${index}: longer than ${SYMBOL_MAX} characters`);
        } else if (itemType === 'Link') {
          if (!isLinkObject(item, field.items.linkType)) {
            add('type', `item ${index}: expected ${field.items.linkType} link; put ids under "${field.items.linkType === 'Asset' ? 'assets' : 'links'}" instead`);
          } else {
            checkLinkTarget(field, item.sys.id, field.items.linkType, seed, ctx);
          }
        }
      });
      break;
    }
    case 'Object':
      if (value === null || typeof value !== 'object') add('type', 'expected an object');
      break;
    default:
      add('type', `unsupported field type "${field.type}" in validator`);
  }

  applyValidations(field, value, seed, ctx);
}

function validateLinkValue(field, value, source, seed, ctx) {
  const { problems, groupName } = ctx;
  const add = (kind, message) => problems.push({ group: groupName, kind, id: seed.id, field: field.id, message });
  const expectedLinkType = source === 'assets' ? 'Asset' : 'Entry';
  const isArrayField = field.type === 'Array' && field.items?.type === 'Link';
  const linkType = isArrayField ? field.items.linkType : field.type === 'Link' ? field.linkType : undefined;

  if (!linkType) return add('type', `field is ${field.type}; "${source}" can only target Link fields`);
  if (linkType !== expectedLinkType) {
    return add('type', `field links to ${linkType} entities; use "${linkType === 'Asset' ? 'assets' : 'links'}" instead of "${source}"`);
  }

  const ids = Array.isArray(value) ? value : [value];
  if (Array.isArray(value) && !isArrayField) return add('type', 'field takes a single link, got an array');
  for (const id of ids) {
    if (typeof id !== 'string' || !id) {
      add('type', `link targets must be id strings, got ${describeType(id)}`);
      continue;
    }
    checkLinkTarget(field, id, linkType, seed, ctx);
  }
  if (isArrayField) applyValidations(field, ids, seed, ctx);
}

function checkLinkTarget(field, targetId, linkType, seed, ctx) {
  const { problems, groupName, entriesById, assetsById } = ctx;
  const add = (kind, message) => problems.push({ group: groupName, kind, id: seed.id, field: field.id, message });
  if (linkType === 'Asset') {
    if (!assetsById.has(targetId)) add('dangling-link', `asset "${targetId}" is not declared in any seed group`);
    return;
  }
  const target = entriesById.get(targetId);
  if (!target) return add('dangling-link', `entry "${targetId}" is not declared in any seed group`);
  const allowed = allValidations(field).find((validation) => validation.linkContentType)?.linkContentType;
  if (allowed && !allowed.includes(target.seed.contentType)) {
    add('link-type', `"${targetId}" is a ${target.seed.contentType}; field accepts ${allowed.join(', ')}`);
  }
}

function applyValidations(field, value, seed, ctx) {
  const { problems, groupName, uniqueValues } = ctx;
  const add = (kind, message) => problems.push({ group: groupName, kind, id: seed.id, field: field.id, message });
  const items = field.type === 'Array' ? (Array.isArray(value) ? value : []) : [value];

  for (const validation of field.validations ?? []) {
    if (validation.size) {
      const length = typeof value === 'string' || Array.isArray(value) ? value.length : undefined;
      if (length !== undefined) {
        if (validation.size.min !== undefined && length < validation.size.min) add('validation', `size below minimum ${validation.size.min}`);
        if (validation.size.max !== undefined && length > validation.size.max) add('validation', `size ${length} exceeds maximum ${validation.size.max}`);
      }
    }
    if (validation.range && typeof value === 'number') {
      if (validation.range.min !== undefined && value < validation.range.min) add('validation', `value ${value} below minimum ${validation.range.min}`);
      if (validation.range.max !== undefined && value > validation.range.max) add('validation', `value ${value} above maximum ${validation.range.max}`);
    }
    if (validation.in && field.type !== 'Array' && !validation.in.includes(value)) {
      add('validation', `value ${JSON.stringify(value)} is not one of ${validation.in.join(', ')}`);
    }
    if (validation.regexp && typeof value === 'string') {
      let regexp;
      try {
        regexp = new RegExp(validation.regexp.pattern, validation.regexp.flags ?? '');
      } catch {
        regexp = null;
      }
      if (regexp && !regexp.test(value)) add('validation', validation.message ?? `value ${JSON.stringify(value)} does not match ${validation.regexp.pattern}`);
    }
    if (validation.unique && (typeof value === 'string' || typeof value === 'number')) {
      const key = `${seed.contentType}.${field.id}`;
      if (!uniqueValues.has(key)) uniqueValues.set(key, new Map());
      const seen = uniqueValues.get(key);
      if (seen.has(value) && seen.get(value) !== seed.id) {
        add('validation', `value ${JSON.stringify(value)} must be unique; also used by "${seen.get(value)}"`);
      } else {
        seen.set(value, seed.id);
      }
    }
  }

  for (const validation of field.items?.validations ?? []) {
    if (validation.in) {
      items.forEach((item, index) => {
        if (!validation.in.includes(item)) add('validation', `item ${index}: ${JSON.stringify(item)} is not one of ${validation.in.join(', ')}`);
      });
    }
  }
}

function isLinkObject(value, linkType) {
  return Boolean(value && typeof value === 'object' && value.sys?.type === 'Link' && value.sys.linkType === linkType && typeof value.sys.id === 'string');
}

function describeType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}
