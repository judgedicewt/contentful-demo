import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderPanel, applyControl, createShortcut, wantsPanel } from '../site/js/panel.js';

const audience = (key, name, source = 'local') => ({ fields: { key, name, source } });
const AUDIENCES = [
  audience('supercar-fans', 'Supercar fans'), audience('returning', 'Returning visitors'), audience('trackday', 'Track day campaign'),
  audience('uk', 'United Kingdom'), audience('vip', 'VIP guests', 'external'),
];
const KEYS = AUDIENCES.map((a) => a.fields.key);
const PROFILE = {
  version: 1, visits: 3, firstSeen: null, lastSeen: null,
  viewed: { vehicles: ['750s', '750s-spider'], categories: { supercars: 2, gt: 1 } },
  campaign: 'trackday', region: 'GB', overrides: { audiences: null, region: null },
};
const model = (over = {}) => ({ open: true, profile: PROFILE, audiences: AUDIENCES, matched: new Set(['returning', 'vip']), unavailable: false, ...over });
const panel = (over) => String(renderPanel(model(over)));

test('a closed panel renders nothing', () => {
  assert.equal(String(renderPanel(model({ open: false }))), '');
});

test('the open panel shows the profile and the matched audiences with their source', () => {
  const out = panel();
  assert.match(out, /<aside class="demo-panel" aria-label="Personalization demo">/);
  assert.match(out, /data-panel-visits[^>]*>3</);
  assert.match(out, /data-panel-campaign[^>]*>trackday</);
  assert.match(out, /data-panel-region[^>]*>GB</);
  assert.match(out, /data-panel-categories[\s\S]*?supercars: 2[\s\S]*?gt: 1/);
  assert.match(out, /data-panel-vehicles[\s\S]*?750s[\s\S]*?750s-spider/);
  const matched = out.match(/data-panel-matched[\s\S]*?<\/ul>/)[0];
  assert.match(matched, /Returning visitors \(local\)/);
  assert.match(matched, /VIP guests \(external\)/);
  assert.doesNotMatch(matched, /Track day campaign/);
});

test('force controls list every audience and reflect the overrides', () => {
  assert.equal((panel().match(/data-control="force-audience"/g) || []).length, 5);
  const forced = panel({ profile: { ...PROFILE, overrides: { audiences: ['uk'], region: 'fr' } } });
  assert.match(forced, /data-control="force-audience" data-key="uk" checked/);
  assert.doesNotMatch(forced, /data-key="vip" checked/);
  assert.match(forced, /data-panel-region[^>]*>FR</, 'the shown region is the effective one');
  assert.match(forced, /name="region"[^>]*value="fr"/);
  for (const action of ['clear-overrides', 'reset-profile', 'close']) assert.match(panel(), new RegExp(`data-control="${action}"`));
});

test('an unavailable audience list is stated and offers no force controls; names are escaped', () => {
  const out = panel({ audiences: [], matched: new Set(), unavailable: true });
  assert.match(out, /audiences unavailable/i);
  assert.equal((out.match(/force-audience/g) || []).length, 0);
  const hostile = panel({ audiences: [audience('x', '<script>alert(1)</script>')], matched: new Set(['x']) });
  assert.doesNotMatch(hostile, /<script>/);
  assert.match(hostile, /&lt;script&gt;/);
});

function fakeSignals(overrides = { audiences: null, region: null }) {
  const calls = [];
  return { calls, load: () => ({ overrides }), setOverrides: (value) => calls.push(['setOverrides', value]), reset: () => calls.push(['reset']) };
}

test('force-audience builds the forced set in audience order and clears it when empty', () => {
  const add = fakeSignals({ audiences: ['uk'], region: null });
  applyControl({ action: 'force-audience', key: 'returning', checked: true }, { signals: add, audienceKeys: KEYS });
  assert.deepEqual(add.calls, [['setOverrides', { audiences: ['returning', 'uk'] }]]);
  const remove = fakeSignals({ audiences: ['uk'], region: null });
  applyControl({ action: 'force-audience', key: 'uk', checked: false }, { signals: remove, audienceKeys: KEYS });
  assert.deepEqual(remove.calls, [['setOverrides', { audiences: null }]]);
});

test('region, clear-overrides and reset-profile call the matching signals functions', () => {
  const s = fakeSignals();
  applyControl({ action: 'region', value: ' gb ' }, { signals: s, audienceKeys: KEYS });
  applyControl({ action: 'region', value: '' }, { signals: s, audienceKeys: KEYS });
  applyControl({ action: 'clear-overrides' }, { signals: s, audienceKeys: KEYS });
  applyControl({ action: 'reset-profile' }, { signals: s, audienceKeys: KEYS });
  assert.deepEqual(s.calls, [
    ['setOverrides', { region: 'gb' }],
    ['setOverrides', { region: null }],
    ['setOverrides', { audiences: null, region: null }],
    ['reset'],
  ]);
});

test('wantsPanel reads ?demo=1 from the real or the hash query string', () => {
  const cases = [['?demo=1', '#/', true], ['', '#/750s?demo=1', true], ['?x=1&demo=1', '#/', true],
    ['?demo=0', '#/', false], ['?demo=10', '#/', false], ['', '#/', false]];
  for (const [search, hash, expected] of cases) assert.equal(wantsPanel({ search, hash }), expected, `${search}${hash}`);
});

const press = (extra = {}) => ({
  key: 'D', shiftKey: true, ctrlKey: false, metaKey: false, altKey: false, repeat: false,
  target: { tagName: 'BODY', isContentEditable: false }, ...extra,
});
function shortcut() {
  let clock = 0;
  let fired = 0;
  const onKey = createShortcut({ onTrigger: () => { fired += 1; }, now: () => clock });
  return { at(ms, event = press()) { clock = ms; onKey(event); }, get fired() { return fired; } };
}

test('three Shift+D presses within two seconds fire once, then the count starts over', () => {
  const s = shortcut();
  s.at(0); s.at(900);
  assert.equal(s.fired, 0);
  s.at(1800);
  assert.equal(s.fired, 1);
  s.at(1900); s.at(2000);
  assert.equal(s.fired, 1);
  s.at(2100);
  assert.equal(s.fired, 2);
});

test('slow presses never fire, and the window slides', () => {
  const s = shortcut();
  s.at(0); s.at(1000); s.at(2500);
  assert.equal(s.fired, 0);
  s.at(2900);
  assert.equal(s.fired, 1, 'the last three presses span 1900 ms');
});

test('Shift+D in a form field, held down or with another modifier never counts', () => {
  const s = shortcut();
  const ignored = [
    press({ target: { tagName: 'INPUT' } }), press({ target: { tagName: 'TEXTAREA' } }), press({ target: { tagName: 'SELECT' } }),
    press({ target: { tagName: 'DIV', isContentEditable: true } }), press({ repeat: true }), press({ ctrlKey: true }),
    press({ metaKey: true }), press({ altKey: true }), press({ key: 'd', shiftKey: false }), press({ key: 'E' }),
  ];
  ignored.forEach((event, index) => s.at(index, event));
  assert.equal(s.fired, 0);
  s.at(20); s.at(30);
  assert.equal(s.fired, 0, 'ignored events left no count behind');
  s.at(40);
  assert.equal(s.fired, 1);
});

test('the stylesheet carries the panel and the slot outline', () => {
  const css = readFileSync(new URL('../site/styles.css', import.meta.url), 'utf8');
  assert.match(css, /\.demo-panel\s*\{/);
  assert.match(css, /body\.demo-open \[data-personalized\]\s*\{/);
  assert.match(css, /body\.demo-open \[data-personalized\]::before\s*\{[^}]*attr\(data-personalized-title\)/);
});
