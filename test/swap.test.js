import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isFamilySwitch, SPINNER_DELAY_MS, HERO_DECODE_CAP_MS } from '../site/js/swap.js';

const vehicles = JSON.parse(readFileSync(new URL('./fixtures/render-vehicle.json', import.meta.url), 'utf8'));
const view = (view, entry) => ({ view, data: { entry, variants: [] } });

test('isFamilySwitch is true between a parent and its variant, in both directions', () => {
  assert.equal(isFamilySwitch(view('vehicle', vehicles.full), view('vehicle', vehicles.spider)), true);
  assert.equal(isFamilySwitch(view('vehicle', vehicles.spider), view('vehicle', vehicles.full)), true);
  assert.equal(isFamilySwitch(view('vehicle', vehicles.spider), view('vehicle', vehicles.spider)), true);
});

test('isFamilySwitch is false across families, across views, and without a current view', () => {
  assert.equal(isFamilySwitch(view('vehicle', vehicles.full), view('vehicle', vehicles.legacy)), false);
  assert.equal(isFamilySwitch(view('page', vehicles.full), view('vehicle', vehicles.spider)), false);
  assert.equal(isFamilySwitch(view('vehicle', vehicles.full), view('page', vehicles.spider)), false);
  assert.equal(isFamilySwitch(null, view('vehicle', vehicles.spider)), false);
  assert.equal(isFamilySwitch(view('vehicle', { sys: {}, fields: {} }), view('vehicle', { sys: {}, fields: {} })), false, 'no id is never a match');
});

test('timing constants', () => {
  assert.equal(SPINNER_DELAY_MS, 250);
  assert.equal(HERO_DECODE_CAP_MS, 300);
});

test('styles name the hero and title for view transitions', () => {
  const css = readFileSync(new URL('../site/styles.css', import.meta.url), 'utf8');
  assert.match(css, /view-transition-name: vehicle-hero/);
  assert.match(css, /view-transition-name: vehicle-title/);
  assert.match(css, /body\.is-loading/);
});
