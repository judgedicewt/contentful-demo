import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { renderRichText, richTextToPlain } from '../site/js/richtext.js';
import { assetUrl } from '../site/js/cda.js';
import { routeFor } from '../site/js/router.js';

const here = dirname(fileURLToPath(import.meta.url));
const doc = JSON.parse(readFileSync(join(here, 'fixtures', 'richtext-document.json'), 'utf8'));
const out = renderRichText(doc, { assetUrl, entryHref: routeFor });

test('renders headings 2 to 4', () => {
  assert.match(out, /<h2>Carved by air<\/h2>/);
  assert.match(out, /<h3>Heading three<\/h3>/);
  assert.match(out, /<h4>Heading four<\/h4>/);
});

test('renders text marks', () => {
  assert.match(out, /<strong>bold<\/strong>/);
  assert.match(out, /<em>italic<\/em>/);
  assert.match(out, /<u>underline<\/u>/);
  assert.match(out, /<code>code<\/code>/);
  assert.match(out, /<em><strong>bold italic<\/strong><\/em>/);
});

test('renders hyperlinks, escapes attribute values, and blocks javascript: URIs', () => {
  assert.match(out, /<a href="https:\/\/example\.com\/\?a=1&amp;b=2" rel="noopener">the configurator<\/a>/);
  assert.doesNotMatch(out, /javascript:/);
  assert.match(out, /<a href="#">a bad link<\/a>/);
});

test('renders entry and asset hyperlinks', () => {
  assert.match(out, /<a href="#\/750s">the 750S<\/a>/);
  assert.match(out, /<a href="https:\/\/assets\.ctfassets\.net\/x\/brochure\.pdf">the brochure<\/a>/);
});

test('renders lists, blockquote and hr', () => {
  assert.match(out, /<ul><li><p>Exhaust<\/p><\/li><li><p>Dihedral doors<\/p><\/li><\/ul>/);
  assert.match(out, /<ol><li><p>First<\/p><\/li><li><p>Second<\/p><\/li><\/ol>/);
  assert.match(out, /<blockquote><p>Lighter\. Faster\.<\/p><\/blockquote>/);
  assert.match(out, /<hr>/);
});

test('renders embedded asset blocks as figures with escaped alt and caption', () => {
  assert.match(out, /<figure class="richtext-figure"><img src="https:\/\/images\.ctfassets\.net\/x\/detail\.svg" alt="Rear wing detail &quot;active&quot; &lt;aero&gt;" loading="lazy"><figcaption>Rear wing detail &quot;active&quot; &lt;aero&gt;<\/figcaption><\/figure>/);
  // a null target renders nothing rather than throwing
  assert.equal((out.match(/<figure/g) || []).length, 1);
});

test('unknown nodes render their children', () => {
  assert.match(out, /<p>Unknown wrapper content<\/p>/);
  assert.doesNotMatch(out, /some-future-node/);
});

test('escapes script tags and special characters in text, converts newlines', () => {
  assert.doesNotMatch(out, /<script>/);
  assert.match(out, /&lt;script&gt;alert\(&#39;xss&#39;\)&lt;\/script&gt; &amp; &quot;quotes&quot;<br>new line/);
});

test('skips empty paragraphs and handles missing input', () => {
  assert.doesNotMatch(out, /<p><\/p>/);
  assert.equal(renderRichText(null), '');
  assert.equal(renderRichText(undefined), '');
  assert.equal(renderRichText({ nodeType: 'document', content: [] }), '');
});

test('renders plain strings as escaped paragraphs', () => {
  assert.equal(renderRichText('One <b>\n\nTwo'), '<p>One &lt;b&gt;</p><p>Two</p>');
});

test('richTextToPlain extracts text', () => {
  const plain = richTextToPlain(doc);
  assert.match(plain, /Carved by air/);
  assert.match(plain, /Plain, bold, italic/);
  assert.match(plain, /Exhaust\nDihedral doors/);
  // text content is kept verbatim (it is not HTML); rendered tags are not present
  assert.match(plain, /<script>alert\('xss'\)<\/script>/);
  assert.doesNotMatch(plain, /<(h2|p|strong|em|ul|li|a)\b/);
});
