"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { ScrollTrigger } from "gsap/ScrollTrigger";

let lenisInstance: Lenis | null = null;
let lockCount = 0;

export function getLenis() { return lenisInstance; }

export function lockScroll() {
  lockCount++;
  lenisInstance?.stop();
  if (typeof document !== "undefined") document.body.style.overflow = "hidden";
}
export function unlockScroll() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    lenisInstance?.start();
    if (typeof document !== "undefined") document.body.style.overflow = "";
  }
}
/**
 * Set by the 3D hero while mounted. Navigation whose path crosses the hero's
 * scroll track is handed to it, so the page moves directly to the target
 * instead of replaying the city-by-city camera sequence. Returns false when
 * the hero is not involved.
 */
type HeroNavigator = (destination: number, duration?: number, onArrive?: () => void) => boolean;
/** Header-link glide: longer for longer distances, gentle ease in and out. */
const glideDuration = (distance: number) => Math.min(2.4, Math.max(1.1, 0.9 + Math.abs(distance) / 5000));
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * Scroll ranges whose inner animation must not play during a programmatic
 * glide: every pinned ScrollTrigger (card stack, About) and the sticky
 * Ground-to-Sky installation track (3D unipole build).
 */
function skipRanges(): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  ScrollTrigger.getAll().forEach((trigger) => {
    // Margin of one screen each side: the section is never on screen during the glide.
    if (trigger.pin) ranges.push([trigger.start - window.innerHeight, trigger.end + window.innerHeight]);
  });
  const installation = document.getElementById("installation");
  if (installation) {
    const top = window.scrollY + installation.getBoundingClientRect().top;
    ranges.push([top - window.innerHeight, top + installation.offsetHeight]);
  }
  return ranges.filter(([from, to]) => to - from > 1).sort((x, y) => x[0] - y[0]);
}

/**
 * Easing for a programmatic scroll from `start` to `target` that glides over
 * the page but hops straight across the skip ranges, so the cards and the 3D
 * installation are never scrubbed through while a header link is travelling.
 */
export function glideEasing(start: number, target: number, ease: (t: number) => number = easeInOutCubic) {
  const lo = Math.min(start, target);
  const hi = Math.max(start, target);
  const clipped: Array<[number, number]> = [];
  skipRanges()
    .map(([from, to]): [number, number] => [Math.max(from, lo), Math.min(to, hi)])
    .filter(([from, to]) => to - from > 1)
    .forEach(([from, to]) => {
      const last = clipped[clipped.length - 1];
      if (last && from <= last[1]) last[1] = Math.max(last[1], to);
      else clipped.push([from, to]);
    });
  if (!clipped.length || hi - lo < 1) return ease;
  const skipped = clipped.reduce((sum, [from, to]) => sum + (to - from), 0);
  const total = hi - lo - skipped;
  // Everything on the way is skipped: hop once, right after the glide starts.
  if (total < 1) return (t: number) => (t > 0.02 ? 1 : 0);
  const down = target > start;
  const ordered = down ? clipped : [...clipped].reverse();
  return (t: number) => {
    const travelled = ease(t) * total;
    let position = down ? start + travelled : start - travelled;
    for (const [from, to] of ordered) {
      if (down && position > from) position += to - from;
      if (!down && position < to) position -= to - from;
    }
    return (position - start) / (target - start);
  };
}

let heroNavigator: HeroNavigator | null = null;
export function setHeroNavigator(navigator: HeroNavigator | null) { heroNavigator = navigator; }
/**
 * While a header link is gliding, every section stays static: scroll-driven
 * (non-pinned) triggers are paused and CSS animations are held, then resumed
 * on arrival. Pinned sections are hopped over by `glideEasing`. Returns a
 * one-shot release.
 */
function freezePage() {
  const root = document.documentElement;
  const paused = ScrollTrigger.getAll().filter((trigger) => !trigger.pin);
  paused.forEach((trigger) => trigger.disable(false));
  root.classList.add("is-navigating");
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    window.clearTimeout(safety);
    root.classList.remove("is-navigating");
    paused.forEach((trigger) => trigger.enable(false, false));
    ScrollTrigger.update();
  };
  const safety = window.setTimeout(release, 6000);
  return release;
}
/** Sections that fill the screen with inner scroll land flush with the top; the rest clear the floating header. */
const hashOffset = (id: string) => (id === "about" || id === "installation" || id === "unipole-types" ? 0 : 72);
export function scrollToHash(hash: string, { instant = false }: { instant?: boolean } = {}) {
  if (!hash) return;
  const id = hash.replace(/^#/, "");
  const reducedMotion = instant || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Pinned sections finish laying out lazily; after arriving, re-measure and
  // correct if the page moved so the click always ends exactly on its section.
  const release = reducedMotion ? () => {} : freezePage();
  const settle = () => {
    const fresh = id === "top" ? 0 : (() => {
      const node = document.getElementById(id);
      return node ? window.scrollY + node.getBoundingClientRect().top - hashOffset(id) : null;
    })();
    if (fresh === null || !lenisInstance || reducedMotion) return release();
    if (Math.abs(fresh - window.scrollY) > 4) {
      lenisInstance.scrollTo(Math.max(0, fresh), { duration: 0.6, easing: easeInOutCubic, force: true, onComplete: release });
    } else release();
  };
  if (heroNavigator) {
    const target = id === "top" ? null : document.getElementById(id);
    const destination = id === "top" ? 0 : target ? window.scrollY + target.getBoundingClientRect().top - hashOffset(id) : null;
    if (destination !== null) {
      const clamped = Math.max(0, destination);
      if (heroNavigator(clamped, instant ? 0 : reducedMotion ? undefined : glideDuration(clamped - window.scrollY), settle)) return;
    }
  }
  if (id === "top") {
    if (lenisInstance) lenisInstance.scrollTo(0, { immediate: reducedMotion, force: true, duration: glideDuration(window.scrollY), easing: glideEasing(window.scrollY, 0), onComplete: settle });
    else {
      release();
      window.scrollTo({ top: 0, behavior: reducedMotion ? "instant" : "smooth" });
    }
    return;
  }
  const el = document.getElementById(id);
  if (!el) return release();
  if (lenisInstance) {
    const target = window.scrollY + el.getBoundingClientRect().top - hashOffset(id);
    lenisInstance.scrollTo(el, { offset: -hashOffset(id), immediate: reducedMotion, force: true, duration: glideDuration(target - window.scrollY), easing: glideEasing(window.scrollY, target), onComplete: settle });
  }
  else {
    release();
    window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top - hashOffset(id), behavior: reducedMotion ? "instant" : "smooth" });
  }
}
/**
 * Exact scroll ranges in which a section plays its own scroll animation: the
 * pinned card stack / About, and the sticky installation track.
 */
function holdRanges(): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  ScrollTrigger.getAll().forEach((trigger) => {
    if (trigger.pin) ranges.push([trigger.start, trigger.end]);
  });
  const installation = document.getElementById("installation");
  if (installation) {
    const top = window.scrollY + installation.getBoundingClientRect().top;
    ranges.push([top, top + installation.offsetHeight - window.innerHeight]);
  }
  return ranges.filter(([from, to]) => to - from > 4);
}

/**
 * Dragging the browser scrollbar never scrubs through a section's own scroll
 * animation (card flipping, the 3D build, About's feature changes): when the
 * thumb enters such a range the page hops once to its far edge in the drag
 * direction, then follows the thumb natively, so the scrollbar stays smooth.
 */
function holdDuringScrollbarDrag(lenis: Lenis) {
  let dragging = false;
  let lastY = window.scrollY;
  const down = (event: PointerEvent) => {
    if (event.clientX >= document.documentElement.clientWidth) {
      dragging = true;
      lastY = window.scrollY;
    }
  };
  const up = () => {
    dragging = false;
  };
  const onScroll = () => {
    const y = window.scrollY;
    const previous = lastY;
    lastY = y;
    if (!dragging || y === previous) return;
    const forward = y > previous;
    for (const [from, to] of holdRanges()) {
      if (y > from + 2 && y < to - 2) {
        lenis.scrollTo(forward ? to + 1 : from - 1, { immediate: true, force: true });
        lastY = window.scrollY;
        return;
      }
    }
  };
  window.addEventListener("pointerdown", down, true);
  window.addEventListener("pointerup", up, true);
  window.addEventListener("pointercancel", up, true);
  window.addEventListener("blur", up);
  window.addEventListener("scroll", onScroll, { passive: true });
  return () => {
    window.removeEventListener("pointerdown", down, true);
    window.removeEventListener("pointerup", up, true);
    window.removeEventListener("pointercancel", up, true);
    window.removeEventListener("blur", up);
    window.removeEventListener("scroll", onScroll);
  };
}

export function useLenisSetup() {
  useEffect(() => {
    if (lenisInstance) return;
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const lenis = new Lenis({ duration: 0.65, smoothWheel: !motionQuery.matches });
    lenisInstance = lenis;
    if (lockCount > 0) lenis.stop();
    const updateMotion = () => {
      lenis.options.smoothWheel = !motionQuery.matches;
      if (motionQuery.matches) lenis.scrollTo(window.scrollY, { immediate: true });
    };
    motionQuery.addEventListener("change", updateMotion);
    const stopHold = holdDuringScrollbarDrag(lenis);
    let raf = 0;
    const loop = (t: number) => { lenis.raf(t); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      stopHold();
      motionQuery.removeEventListener("change", updateMotion);
      lenis.destroy();
      lenisInstance = null;
    };
  }, []);
}
