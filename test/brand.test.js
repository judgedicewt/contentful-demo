import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { brandLockup, brandMark, BRAND_NAME } from '../site/js/brand.js';
import { renderFooter, renderHeader, renderLoading } from '../site/js/shell.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('brandMark is decorative by default and labelled when given a title', () => {
  const decorative = String(brandMark());
  assert.match(decorative, /^<svg class="brand-mark" viewBox="0 0 64 64"[^>]* aria-hidden="true" focusable="false">/);
  const id = decorative.match(/<linearGradient id="([\w-]+)"/)[1];
  assert.equal((decorative.match(new RegExp(`stroke="url\\(#${id}\\)"`, 'g')) || []).length, 2, 'both curves use the gradient');
  assert.notEqual(String(brandMark()).match(/<linearGradient id="([\w-]+)"/)[1], id, 'each mark has its own gradient id');
  const labelled = String(brandMark({ className: 'x', title: 'A "quoted" <name>' }));
  assert.match(labelled, /class="x"[^>]* role="img" aria-label="A &quot;quoted&quot; &lt;name&gt;"/);
  assert.doesNotMatch(labelled, /aria-hidden/);
});

test('brandLockup pairs the mark with the escaped name', () => {
  const out = String(brandLockup({ name: 'Nova & Co' }));
  assert.match(out, /^<span class="brand-lockup"><svg class="brand-mark"/);
  assert.match(out, /<span class="brand-lockup__name">Nova &amp; Co<\/span><\/span>$/);
  assert.match(String(brandLockup()), new RegExp(`>${BRAND_NAME}<`));
});

test('the header, footer and loading state carry the mark', () => {
  const settings = { fields: { siteName: 'Strada Nova' } };
  assert.match(String(renderHeader(settings, [])), /<a class="wordmark"[^>]*aria-label="[^"]*Strada Nova[^"]*"><span class="brand-lockup"><svg/);
  assert.match(String(renderFooter(settings)), /<a class="footer__brand"[^>]*><span class="brand-lockup brand-lockup--footer"><svg/);
  assert.match(String(renderHeader({ fields: {} }, [])), />Strada Nova<\/span>/, 'the brand name is the fallback');
  assert.match(String(renderLoading()), /<svg class="brand-mark status__mark"/);
});

test('index.html links the favicon and the logo files exist', () => {
  const index = read('site/index.html');
  assert.match(index, /<link rel="icon" href="favicon.svg" type="image\/svg\+xml">/);
  assert.match(index, /<img class="status__mark" src="brand\/strada-nova-mark.svg"/);
  for (const path of ['site/favicon.svg', 'site/brand/strada-nova-mark.svg']) {
    assert.match(read(path), /^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" viewBox="0 0 64 64"/, path);
  }
  assert.match(read('site/styles.css'), /url\("brand\/strada-nova-mark.svg"\)/);
});
