import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const PATH = new URL('../fusion/enquiry-scenario.blueprint.json', import.meta.url);
const PAYLOAD_KEYS = [
  'name', 'email', 'phone', 'country', 'model', 'modelSlug',
  'message', 'consent', 'source', 'pageUrl', 'submittedAt', 'locale'
];

const load = () => JSON.parse(readFileSync(PATH, 'utf8'));

test('blueprint has the three expected modules in order', () => {
  const bp = load();
  assert.deepEqual(bp.flow.map((m) => m.module), [
    'gateway:CustomWebHook',
    'workfront-workfront:createARecord',
    'gateway:WebhookRespond'
  ]);
  assert.deepEqual(bp.flow.map((m) => m.id), [1, 4, 3]);
  assert.equal(bp.flow[1].version, 2);
});

test('blueprint metadata and name', () => {
  const bp = load();
  assert.equal(bp.name, 'McLaren enquiry to Workfront');
  assert.equal(bp.metadata.instant, true);
  assert.equal(bp.metadata.zone, 'app.workfrontfusion.com');
});

test('module 1 keeps the starter webhook', () => {
  const [hook] = load().flow;
  assert.equal(hook.parameters.hook, 200628);
});

test('module 2 creates an OPTASK in the queue project', () => {
  const m = load().flow[1];
  assert.equal(m.mapper.object_code, 'OPTASK');
  assert.deepEqual(m.mapper.fieldNames, ['name', 'projectID', 'description']);
  assert.equal(m.mapper.projectID, '6ad8d2f90005295eaf29343ebd663ed8');
  assert.equal(m.mapper.name, 'Enquiry: {{1.model}} - {{1.name}}');
  for (const key of PAYLOAD_KEYS) {
    assert.ok(m.mapper.description.includes(`{{1.${key}}}`), `description maps ${key}`);
  }
});

test('module 2 binds the exported Workfront connection', () => {
  const m = load().flow[1];
  assert.equal(typeof m.parameters.__IMTCONN__, 'number');
});

test('module 3 answers 200 JSON with the record id', () => {
  const m = load().flow[2];
  assert.equal(m.mapper.status, '200');
  assert.ok(m.mapper.body.includes('{{4.ID}}'));
  assert.deepEqual(m.mapper.headers, [{ key: 'Content-Type', value: 'application/json' }]);
});

test('the blueprint contains no secrets', () => {
  const text = readFileSync(PATH, 'utf8');
  assert.ok(!/token|password|secret/i.test(text));
});
