import { test } from 'node:test';
import assert from 'node:assert/strict';
import { html } from '../site/js/dom.js';
import { STRINGS, LOCALES, langOf, t } from '../site/js/i18n.js';

test('both languages define the same keys and placeholders', () => {
  assert.deepEqual(Object.keys(STRINGS.ja).sort(), Object.keys(STRINGS.en).sort());
  for (const [key, en] of Object.entries(STRINGS.en)) {
    const wanted = [...en.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    const got = [...STRINGS.ja[key].matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    assert.deepEqual(got, wanted, key);
    assert.notEqual(STRINGS.ja[key].trim(), '', key);
  }
});

test('t formats strings, falls back, and never prints undefined', () => {
  assert.equal(t('back_to', 'en', { name: '750S' }), 'Back to 750S');
  assert.equal(t('back_to', 'ja', { name: '750S' }), STRINGS.ja.back_to.replace('{name}', '750S'));
  assert.equal(t('no_such_key', 'ja'), 'no_such_key');
  assert.equal(t('back_to', 'en'), 'Back to ');
  assert.equal(t('home', 'xx'), 'Home');
});

test('t returns parts when a var is markup, and html escapes only the literals', () => {
  const parts = t('nothing_published_at', 'en', { path: html`<code>/x</code>` });
  assert.ok(Array.isArray(parts));
  assert.equal(String(html`${parts}`), 'Nothing is published at <code>/x</code>.');
  assert.equal(String(html`${t('back_to', 'en', { name: html`<b>${'<i>'}</b>` })}`), 'Back to <b>&lt;i&gt;</b>');
});

test('langOf and LOCALES', () => {
  assert.equal(langOf('ja-JP'), 'ja');
  assert.equal(langOf('ja'), 'ja');
  assert.equal(langOf(undefined), 'en');
  assert.deepEqual(LOCALES, { en: 'en-US', ja: 'ja-JP' });
});
