import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getContentType } from '../src/content-model.js';

const field = (type, id) => getContentType(type).fields.find((f) => f.id === id);
const allowed = (f) => (f.items ?? f).validations.find((v) => v.linkContentType).linkContentType;
const SECTIONS = ['textBlock', 'imageBlock', 'bannerButton', 'cardGrid', 'vehicleGrid', 'storyGrid', 'ctaGroup'];

test('audience has the pinned fields, defaults and key pattern', () => {
  const audience = getContentType('audience');
  assert.equal(audience.displayField, 'name');
  assert.deepEqual(audience.fields.map((f) => f.id), [
    'name', 'key', 'description', 'source', 'interestCategories', 'interestVehicles',
    'visitorType', 'minVisits', 'campaigns', 'regions', 'matchMode',
  ]);
  assert.equal(field('audience', 'name').required, true);
  assert.equal(field('audience', 'key').required, true);
  const keyValidations = field('audience', 'key').validations;
  assert.ok(keyValidations.some((v) => v.unique === true));
  assert.ok(keyValidations.some((v) => v.regexp?.pattern === '^[a-z0-9]+(-[a-z0-9]+)*$'));
  assert.deepEqual(field('audience', 'source').validations, [{ in: ['local', 'external'] }]);
  assert.deepEqual(field('audience', 'visitorType').validations, [{ in: ['any', 'first-time', 'returning'] }]);
  assert.deepEqual(field('audience', 'matchMode').validations, [{ in: ['all', 'any'] }]);
  assert.deepEqual(
    ['source', 'visitorType', 'matchMode'].map((id) => field('audience', id).defaultValue['en-US']),
    ['local', 'any', 'all'],
  );
  assert.deepEqual(allowed(field('audience', 'interestCategories')), ['vehicleCategory']);
  assert.deepEqual(allowed(field('audience', 'interestVehicles')), ['vehicle']);
  assert.equal(field('audience', 'minVisits').type, 'Integer');
  for (const id of ['campaigns', 'regions']) {
    assert.equal(field('audience', id).type, 'Array');
    assert.equal(field('audience', id).items.type, 'Symbol');
  }
});

test('contentVariant and personalizedContent accept any section type or a link', () => {
  assert.equal(getContentType('contentVariant').displayField, 'title');
  assert.equal(field('contentVariant', 'audience').required, true);
  assert.deepEqual(allowed(field('contentVariant', 'audience')), ['audience']);
  assert.equal(field('contentVariant', 'content').required, true);
  assert.deepEqual(allowed(field('contentVariant', 'content')), [...SECTIONS, 'link']);
  assert.equal(getContentType('personalizedContent').displayField, 'title');
  assert.equal(field('personalizedContent', 'default').required, true);
  assert.deepEqual(allowed(field('personalizedContent', 'default')), [...SECTIONS, 'link']);
  assert.equal(field('personalizedContent', 'variants').type, 'Array');
  assert.deepEqual(allowed(field('personalizedContent', 'variants')), ['contentVariant']);
});

test('existing types accept personalizedContent and the vehicle gains enquiryCta', () => {
  assert.deepEqual(allowed(field('page', 'sections')), [...SECTIONS, 'personalizedContent']);
  assert.deepEqual(allowed(field('story', 'sections')), ['textBlock', 'imageBlock', 'ctaGroup', 'personalizedContent']);
  assert.deepEqual(allowed(field('vehicle', 'msoBanner')), ['bannerButton', 'personalizedContent']);
  assert.equal(field('vehicle', 'enquiryCta').type, 'Link');
  assert.deepEqual(allowed(field('vehicle', 'enquiryCta')), ['link', 'personalizedContent']);
  assert.equal(field('vehicle', 'enquiryUrl').type, 'Symbol', 'enquiryUrl stays as the fallback');
});
