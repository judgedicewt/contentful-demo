import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carouselStep, shouldShowControls, initMotion } from '../site/js/motion.js';

test('carouselStep advances by 80% of the visible width', () => {
  assert.equal(carouselStep({ clientWidth: 1000, scrollLeft: 0, scrollWidth: 2400 }, 1), 800);
  assert.equal(carouselStep({ clientWidth: 1000, scrollLeft: 800, scrollWidth: 2400 }, 1), 1400, 'clamped to the end');
});

test('carouselStep wraps to the start past the last slide', () => {
  assert.equal(carouselStep({ clientWidth: 1000, scrollLeft: 1600, scrollWidth: 2400 }, 1), 0);
  assert.equal(carouselStep({ clientWidth: 1000, scrollLeft: 1400, scrollWidth: 2400 }, 1), 0, 'already at the end');
});

test('carouselStep goes back, wrapping to the end from the start', () => {
  assert.equal(carouselStep({ clientWidth: 1000, scrollLeft: 1000, scrollWidth: 2400 }, -1), 200);
  assert.equal(carouselStep({ clientWidth: 1000, scrollLeft: 500, scrollWidth: 2400 }, -1), 0, 'clamped to the start');
  assert.equal(carouselStep({ clientWidth: 1000, scrollLeft: 0, scrollWidth: 2400 }, -1), 1400);
});

test('shouldShowControls is false when everything fits', () => {
  assert.equal(shouldShowControls({ scrollWidth: 1000, clientWidth: 1000 }), false);
  assert.equal(shouldShowControls({ scrollWidth: 1001, clientWidth: 1000 }), false, 'sub-pixel rounding');
  assert.equal(shouldShowControls({ scrollWidth: 2400, clientWidth: 1000 }), true);
});

test('initMotion with a root lacking querySelectorAll returns a no-op teardown', () => {
  const teardown = initMotion({}, { observer: undefined });
  assert.equal(typeof teardown, 'function');
  assert.doesNotThrow(() => teardown());
  assert.doesNotThrow(() => initMotion(null)());
});

test('initMotion without an observer (and no global one) throws nothing and reveals everything', () => {
  const el = fakeEl();
  const root = fakeRoot({ '[data-reveal]': [el] });
  const teardown = initMotion(root, { reducedMotion: false, observer: undefined });
  assert.equal(el.classList.contains('is-visible'), true, 'never leave content hidden');
  assert.doesNotThrow(() => teardown());
});

// --- a minimal DOM stub ------------------------------------------------------

function fakeEl(props = {}) {
  const classes = new Set();
  return {
    classList: {
      add: (name) => classes.add(name),
      remove: (name) => classes.delete(name),
      contains: (name) => classes.has(name),
      toggle: (name, on) => (on ? classes.add(name) : classes.delete(name)),
    },
    hidden: false,
    ...props,
  };
}

function fakeRoot(map = {}) {
  const listeners = [];
  return {
    listeners,
    querySelectorAll: (selector) => map[selector] || [],
    querySelector: (selector) => (map[selector] || [])[0] || null,
    addEventListener: (type, fn, opts) => listeners.push({ type, fn, opts }),
    removeEventListener: (type, fn) => {
      const index = listeners.findIndex((item) => item.type === type && item.fn === fn);
      if (index >= 0) listeners.splice(index, 1);
    },
  };
}

function fakeObserverClass() {
  const instances = [];
  class FakeObserver {
    constructor(callback, options) {
      this.callback = callback;
      this.options = options;
      this.observed = new Set();
      this.disconnected = false;
      instances.push(this);
    }
    observe(el) { this.observed.add(el); }
    unobserve(el) { this.observed.delete(el); }
    disconnect() { this.disconnected = true; this.observed.clear(); }
    fire(entries) { this.callback(entries, this); }
  }
  FakeObserver.instances = instances;
  return FakeObserver;
}

test('initMotion reveals each element once it intersects, then stops observing it', () => {
  const [a, b] = [fakeEl(), fakeEl()];
  const root = fakeRoot({ '[data-reveal]': [a, b] });
  const Observer = fakeObserverClass();
  const teardown = initMotion(root, { reducedMotion: false, observer: Observer });
  const [reveal] = Observer.instances;
  assert.equal(reveal.options.threshold, 0.15);
  assert.equal(reveal.observed.size, 2);
  assert.equal(a.classList.contains('is-visible'), false);
  reveal.fire([{ target: a, isIntersecting: true }, { target: b, isIntersecting: false }]);
  assert.equal(a.classList.contains('is-visible'), true);
  assert.equal(b.classList.contains('is-visible'), false);
  assert.equal(reveal.observed.has(a), false);
  assert.equal(reveal.observed.has(b), true);
  teardown();
  assert.equal(reveal.disconnected, true);
});

test('initMotion under reduced motion shows reveal targets immediately and observes nothing', () => {
  const el = fakeEl();
  const root = fakeRoot({ '[data-reveal]': [el] });
  const Observer = fakeObserverClass();
  initMotion(root, { reducedMotion: true, observer: Observer });
  assert.equal(el.classList.contains('is-visible'), true);
  assert.equal(Observer.instances.length, 0);
});

test('initMotion toggles the compact bar when the hero leaves the viewport', () => {
  const hero = fakeEl();
  const bar = fakeEl();
  const root = fakeRoot({ '[data-hero]': [hero], '[data-compact-bar]': [bar] });
  const Observer = fakeObserverClass();
  initMotion(root, { reducedMotion: false, observer: Observer });
  const heroObserver = Observer.instances.find((item) => item.observed.has(hero));
  assert.ok(heroObserver, 'the hero is observed');
  heroObserver.fire([{ target: hero, isIntersecting: false }]);
  assert.equal(bar.classList.contains('is-compact'), true);
  heroObserver.fire([{ target: hero, isIntersecting: true }]);
  assert.equal(bar.classList.contains('is-compact'), false);
});

function carouselFixture(trackProps) {
  const controls = fakeEl();
  const scrolls = [];
  const track = fakeEl({ scrollTo: (arg) => scrolls.push(arg), ...trackProps });
  const section = {
    querySelector: (selector) => (selector === '[data-carousel-track]' ? track : selector === '.carousel__controls' ? controls : null),
  };
  const next = fakeEl({ closest: (selector) => (selector === '[data-carousel-next]' ? next : selector === '[data-carousel-prev]' ? null : selector === '.carousel' ? section : null) });
  const prev = fakeEl({ closest: (selector) => (selector === '[data-carousel-prev]' ? prev : selector === '[data-carousel-next]' ? null : selector === '.carousel' ? section : null) });
  section.contains = () => true;
  track.closest = (selector) => (selector === '[data-carousel-track]' ? track : selector === '.carousel' ? section : null);
  const root = fakeRoot({ '[data-carousel-track]': [track] });
  return { root, track, controls, scrolls, next, prev, section };
}

test('a carousel with one slide hides its controls and ignores clicks without throwing', () => {
  const { root, controls, scrolls, next } = carouselFixture({ clientWidth: 1000, scrollWidth: 1000, scrollLeft: 0 });
  const teardown = initMotion(root, { reducedMotion: false, observer: fakeObserverClass() });
  assert.equal(controls.hidden, true);
  const click = root.listeners.find((item) => item.type === 'click');
  assert.doesNotThrow(() => click.fn({ target: next, preventDefault() {} }));
  assert.equal(scrolls.length, 0);
  teardown();
  assert.equal(root.listeners.length, 0, 'teardown removes every listener');
});

test('carousel buttons scroll the track with carouselStep', () => {
  const { root, controls, scrolls, next, prev } = carouselFixture({ clientWidth: 1000, scrollWidth: 2400, scrollLeft: 0 });
  initMotion(root, { reducedMotion: false, observer: fakeObserverClass() });
  assert.equal(controls.hidden, false);
  const click = root.listeners.find((item) => item.type === 'click');
  click.fn({ target: next, preventDefault() {} });
  click.fn({ target: prev, preventDefault() {} });
  assert.deepEqual(scrolls, [
    { left: 800, behavior: 'smooth' },
    { left: 1400, behavior: 'smooth' },
  ]);
});

test('carousel scrolls instantly under reduced motion', () => {
  const { root, scrolls, next } = carouselFixture({ clientWidth: 1000, scrollWidth: 2400, scrollLeft: 0 });
  initMotion(root, { reducedMotion: true, observer: fakeObserverClass() });
  root.listeners.find((item) => item.type === 'click').fn({ target: next, preventDefault() {} });
  assert.deepEqual(scrolls, [{ left: 800, behavior: 'auto' }]);
});

test('arrow keys move a focused carousel track', () => {
  const { root, track, scrolls } = carouselFixture({ clientWidth: 1000, scrollWidth: 2400, scrollLeft: 800 });
  initMotion(root, { reducedMotion: false, observer: fakeObserverClass() });
  const keydown = root.listeners.find((item) => item.type === 'keydown');
  let prevented = 0;
  keydown.fn({ key: 'ArrowRight', target: track, preventDefault: () => (prevented += 1) });
  keydown.fn({ key: 'ArrowLeft', target: track, preventDefault: () => (prevented += 1) });
  keydown.fn({ key: 'a', target: track, preventDefault: () => (prevented += 1) });
  assert.equal(prevented, 2);
  assert.deepEqual(scrolls.map((s) => s.left), [1400, 0]);
});

// --- drag-to-scroll ------------------------------------------------------------

function dragFixture() {
  const trackListeners = [];
  const docListeners = [];
  const doc = {
    addEventListener: (type, fn) => docListeners.push({ type, fn }),
    removeEventListener: (type, fn) => {
      const index = docListeners.findIndex((item) => item.type === type && item.fn === fn);
      if (index >= 0) docListeners.splice(index, 1);
    },
  };
  const track = fakeEl({
    scrollLeft: 100,
    clientWidth: 1000,
    scrollWidth: 2400,
    ownerDocument: doc,
    addEventListener: (type, fn, opts) => trackListeners.push({ type, fn, opts }),
    removeEventListener: (type, fn) => {
      const index = trackListeners.findIndex((item) => item.type === type && item.fn === fn);
      if (index >= 0) trackListeners.splice(index, 1);
    },
  });
  const root = fakeRoot({ '[data-carousel-track]': [track] });
  const teardown = initMotion(root, { reducedMotion: false, observer: fakeObserverClass() });
  const fire = (list, type, event) => list.filter((item) => item.type === type).forEach((item) => item.fn(event));
  return { track, root, teardown, trackListeners, docListeners, fire };
}

const mouseDown = { pointerType: 'mouse', button: 0, clientX: 500 };

test('dragstart on the track is cancelled and its listener is removed on teardown', () => {
  const { trackListeners, fire, teardown } = dragFixture();
  let prevented = 0;
  fire(trackListeners, 'dragstart', { preventDefault: () => (prevented += 1) });
  assert.equal(prevented, 1);
  teardown();
  assert.equal(trackListeners.length, 0, 'every track listener removed');
});

test('a mouse drag scrolls the track and suppresses the click that ends it', () => {
  const { track, trackListeners, docListeners, fire } = dragFixture();
  fire(trackListeners, 'pointerdown', mouseDown);
  fire(docListeners, 'pointermove', { pointerType: 'mouse', buttons: 1, clientX: 400 });
  assert.equal(track.scrollLeft, 200);
  assert.equal(track.classList.contains('is-dragging'), true);
  fire(docListeners, 'pointerup', {});
  let prevented = 0;
  fire(trackListeners, 'click', { preventDefault: () => (prevented += 1), stopPropagation() {} });
  assert.equal(prevented, 1, 'the click right after a drag is swallowed');
});

test('the click-suppression flag is cleared after the drag ends', async () => {
  const { trackListeners, docListeners, fire } = dragFixture();
  fire(trackListeners, 'pointerdown', mouseDown);
  fire(docListeners, 'pointermove', { pointerType: 'mouse', buttons: 1, clientX: 400 });
  fire(docListeners, 'pointerup', {});
  await new Promise((resolve) => setTimeout(resolve, 5));
  let prevented = 0;
  fire(trackListeners, 'click', { preventDefault: () => (prevented += 1), stopPropagation() {} });
  assert.equal(prevented, 0, 'a later plain click is left alone');
});

test('a mouse move with no buttons held ends the drag', () => {
  const { track, trackListeners, docListeners, fire } = dragFixture();
  fire(trackListeners, 'pointerdown', mouseDown);
  fire(docListeners, 'pointermove', { pointerType: 'mouse', buttons: 1, clientX: 400 });
  assert.equal(track.classList.contains('is-dragging'), true);
  fire(docListeners, 'pointermove', { pointerType: 'mouse', buttons: 0, clientX: 300 });
  assert.equal(track.classList.contains('is-dragging'), false, 'drag ended');
  assert.equal(track.scrollLeft, 200, 'the buttonless move did not scroll');
  assert.equal(docListeners.length, 0, 'document listeners removed');
});
