"use client";

import { useEffect } from "react";
import Lenis from "lenis";

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
type HeroNavigator = (destination: number) => boolean;
let heroNavigator: HeroNavigator | null = null;
export function setHeroNavigator(navigator: HeroNavigator | null) { heroNavigator = navigator; }

export function scrollToHash(hash: string) {
  if (!hash) return;
  const id = hash.replace(/^#/, "");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (heroNavigator) {
    const target = id === "top" ? null : document.getElementById(id);
    const destination = id === "top" ? 0 : target ? window.scrollY + target.getBoundingClientRect().top - 72 : null;
    if (destination !== null && heroNavigator(Math.max(0, destination))) return;
  }
  if (id === "top") {
    if (lenisInstance) lenisInstance.scrollTo(0, { immediate: reducedMotion });
    else window.scrollTo({ top: 0, behavior: reducedMotion ? "instant" : "smooth" });
    return;
  }
  const el = document.getElementById(id);
  if (!el) return;
  if (lenisInstance) lenisInstance.scrollTo(el, { offset: -72, immediate: reducedMotion });
  else window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top - 72, behavior: reducedMotion ? "instant" : "smooth" });
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
    let raf = 0;
    const loop = (t: number) => { lenis.raf(t); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      motionQuery.removeEventListener("change", updateMotion);
      lenis.destroy();
      lenisInstance = null;
    };
  }, []);
}
