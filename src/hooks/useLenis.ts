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
export function scrollToHash(hash: string) {
  if (!hash) return;
  const id = hash.replace(/^#/, "");
  if (id === "top") { lenisInstance?.scrollTo(0, { offset: 0 }); return; }
  const el = document.getElementById(id);
  if (!el) return;
  if (lenisInstance) lenisInstance.scrollTo(el, { offset: -72 });
  else el.scrollIntoView({ behavior: "smooth", block: "start" });
}
export function useLenisSetup() {
  useEffect(() => {
    if (lenisInstance) return;
    const lenis = new Lenis({ duration: 1.1, smoothWheel: true });
    lenisInstance = lenis;
    let raf = 0;
    const loop = (t: number) => { lenis.raf(t); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); lenis.destroy(); lenisInstance = null; };
  }, []);
}