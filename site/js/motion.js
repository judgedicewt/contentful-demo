/**
 * Restrained motion for the site: scroll reveals, the overview carousel, and
 * the compact product bar.
 *
 * This module never touches `window` or `document` at import time, so it loads
 * under `node --test`. `initMotion` takes the element to enhance and returns a
 * teardown; the pure helpers (`carouselStep`, `shouldShowControls`) are exported
 * for tests.
 *
 * Markup contract (see the renderers): `[data-reveal]` marks reveal targets,
 * `[data-hero]` the full hero, `[data-compact-bar]` the sticky product bar,
 * `[data-carousel-track]` the scroller and `[data-carousel-prev|next]` its
 * buttons inside a `.carousel` that holds a `.carousel__controls` wrapper.
 */

const STEP = 0.8;
const DRAG_THRESHOLD = 6;
const REVEAL_THRESHOLD = 0.15;

/** Target `scrollLeft` for a prev (-1) or next (1) press. Wraps at both ends. */
export function carouselStep(track, direction) {
  const { clientWidth, scrollLeft, scrollWidth } = track;
  const max = Number.isFinite(scrollWidth) ? Math.max(0, scrollWidth - clientWidth) : Infinity;
  if (direction > 0) {
    if (scrollLeft >= max - 1) return 0;
    return Math.min(max, scrollLeft + clientWidth * STEP);
  }
  if (scrollLeft <= 0) return Number.isFinite(max) ? max : 0;
  return Math.max(0, scrollLeft - clientWidth * STEP);
}

/** False when every slide already fits, so the buttons would do nothing. */
export function shouldShowControls(track) {
  return track.scrollWidth > track.clientWidth + 1;
}

const NOOP = () => {};

function prefersReducedMotion() {
  try {
    return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
  } catch {
    return false;
  }
}

export function initMotion(root, { reducedMotion, observer } = {}) {
  if (!root || typeof root.querySelectorAll !== 'function') return NOOP;
  const reduced = reducedMotion ?? prefersReducedMotion();
  const Observer = observer ?? globalThis.IntersectionObserver;
  const cleanups = [];
  const on = (target, type, handler, options) => {
    if (!target || typeof target.addEventListener !== 'function') return;
    target.addEventListener(type, handler, options);
    cleanups.push(() => target.removeEventListener?.(type, handler, options));
  };
  const watch = (callback, options) => {
    const instance = new Observer(callback, options);
    cleanups.push(() => instance.disconnect());
    return instance;
  };
  const list = (selector) => Array.from(root.querySelectorAll(selector) || []);
  const behavior = reduced ? 'auto' : 'smooth';

  // Reveals. Without an observer (or with reduced motion) nothing may stay hidden.
  const targets = list('[data-reveal]');
  if (targets.length) {
    if (reduced || typeof Observer !== 'function') {
      for (const el of targets) el.classList.add('is-visible');
    } else {
      const reveal = watch(
        (entries, self) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            entry.target.classList.add('is-visible');
            self.unobserve(entry.target);
          }
        },
        { threshold: REVEAL_THRESHOLD },
      );
      for (const el of targets) reveal.observe(el);
    }
  }

  // Compact product bar: shrink once the hero has scrolled out of view.
  const hero = list('[data-hero]')[0];
  const bar = list('[data-compact-bar]')[0];
  if (hero && bar && typeof Observer === 'function') {
    const compact = watch(
      (entries) => {
        for (const entry of entries) bar.classList.toggle('is-compact', !entry.isIntersecting);
      },
      { threshold: 0 },
    );
    compact.observe(hero);
  }

  // Carousel.
  const tracks = list('[data-carousel-track]');
  const trackOf = (el) => el?.closest?.('.carousel')?.querySelector?.('[data-carousel-track]') || null;
  const syncControls = () => {
    for (const track of tracks) {
      const controls = track.closest?.('.carousel')?.querySelector?.('.carousel__controls');
      if (controls) controls.hidden = !shouldShowControls(track);
    }
  };
  const scrollTrack = (track, direction) => {
    if (!track || !shouldShowControls(track)) return;
    track.scrollTo?.({ left: carouselStep(track, direction), behavior });
  };
  if (tracks.length) {
    syncControls();
    on(globalThis, 'resize', syncControls);
    on(root, 'click', (event) => {
      const target = event.target;
      const next = target?.closest?.('[data-carousel-next]');
      const prev = next ? null : target?.closest?.('[data-carousel-prev]');
      const button = next || prev;
      if (!button) return;
      scrollTrack(trackOf(button), next ? 1 : -1);
    });
    on(root, 'keydown', (event) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      const track = event.target?.closest?.('[data-carousel-track]');
      if (!track || event.target !== track) return;
      event.preventDefault();
      scrollTrack(track, event.key === 'ArrowRight' ? 1 : -1);
    });
    for (const track of tracks) cleanups.push(enableDrag(track, on));
  }

  return () => {
    while (cleanups.length) cleanups.pop()();
  };
}

/** Mouse drag-to-scroll. Touch and pen already scroll natively. Returns its own cleanup. */
function enableDrag(track, on) {
  let startX = 0;
  let startLeft = 0;
  let down = false;
  let moved = false;
  let off = [];
  const end = () => {
    down = false;
    for (const fn of off) fn();
    off = [];
    track.classList?.remove('is-dragging');
  };
  const view = track.ownerDocument || null;
  on(track, 'pointerdown', (event) => {
    if (event.pointerType && event.pointerType !== 'mouse') return;
    if (event.button) return;
    down = true;
    moved = false;
    startX = event.clientX;
    startLeft = track.scrollLeft;
    const move = (e) => {
      if (!down) return;
      const dx = e.clientX - startX;
      if (!moved && Math.abs(dx) <= DRAG_THRESHOLD) return;
      moved = true;
      track.classList.add('is-dragging');
      track.scrollLeft = startLeft - dx;
    };
    view?.addEventListener('pointermove', move);
    view?.addEventListener('pointerup', end);
    view?.addEventListener('pointercancel', end);
    off = [
      () => view?.removeEventListener('pointermove', move),
      () => view?.removeEventListener('pointerup', end),
      () => view?.removeEventListener('pointercancel', end),
    ];
  });
  // A drag that ends over a link must not follow it.
  on(
    track,
    'click',
    (event) => {
      if (!moved) return;
      moved = false;
      event.preventDefault();
      event.stopPropagation();
    },
    true,
  );
  // Leave nothing attached to the document if torn down mid-drag.
  return end;
}
