"use client";

import { useEffect, useRef, type MutableRefObject, type RefObject } from "react";
import { gsap } from "gsap";
import { getLenis } from "@/hooks/useLenis";

/**
 * Inner scrolling for a full-screen section, the same idea as the hero banner:
 * while the section fills the viewport, wheel / swipe / arrow keys move a step
 * counter instead of the page. The page height never includes that "scroll
 * length", so the browser scrollbar stays smooth and simply passes over the
 * section in its current state.
 *
 *  - the first gesture towards the section glides it into place;
 *  - inside it, each gesture moves exactly one step (a GSAP tween on `value`);
 *  - past the first / last step the gesture scrolls the page as normal.
 */

const WHEEL_GESTURE_GAP = 220;
const SWIPE_DISTANCE = 36;
const ENTER_DURATION = 0.85;

type Options = {
  /** Number of steps (0 … count - 1). */
  count: number;
  /** Continuous step value, called every animation frame while stepping. */
  onValue: (value: number) => void;
  /** Called when the target step changes. */
  onIndex?: (index: number) => void;
  /** Duration of one step in seconds. */
  stepDuration?: number;
  /** Only active at or above this viewport width (px). */
  minWidth?: number;
  /** With reduced motion: keep stepping, but instantly (otherwise do nothing). */
  instantWhenReduced?: boolean;
  /** Lets the owner jump to a step (for example from a click). */
  controlRef?: MutableRefObject<((index: number) => void) | null>;
};

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function useStepScroller(ref: RefObject<HTMLElement | null>, options: Options) {
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  const { count, minWidth = 0 } = options;

  useEffect(() => {
    const section = ref.current;
    if (!section) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced && !optionsRef.current.instantWhenReduced) return;

    section.dataset.stepIndex = "0";
    const proxy = { value: 0 };
    let index = 0;
    let tween: gsap.core.Tween | null = null;
    let entering = false;
    let lastWheel = 0;
    let lastWheelAbs = 0;
    let lastWheelDir = 0;
    let touchY = 0;
    let touchDecided = false;
    let touchCapture = false;
    let touchFired = false;
    let touchAction: (() => void) | null = null;

    const active = () => window.innerWidth >= minWidth;
    const busy = () =>
      document.body.style.overflow === "hidden" ||
      document.documentElement.classList.contains("is-navigating") ||
      Boolean(getLenis()?.isLocked);
    const rect = () => section.getBoundingClientRect();

    const stepTo = (target: number, immediate = false) => {
      const next = Math.max(0, Math.min(optionsRef.current.count - 1, Math.round(target)));
      tween?.kill();
      index = next;
      section.dataset.stepIndex = String(next);
      optionsRef.current.onIndex?.(next);
      if (immediate || reduced) {
        proxy.value = next;
        optionsRef.current.onValue(next);
        tween = null;
        return;
      }
      tween = gsap.to(proxy, {
        value: next,
        duration: optionsRef.current.stepDuration ?? 0.9,
        ease: "power2.inOut",
        onUpdate: () => optionsRef.current.onValue(proxy.value),
        onComplete: () => {
          tween = null;
        },
      });
    };

    if (optionsRef.current.controlRef) optionsRef.current.controlRef.current = (i) => stepTo(i);

    const glideIn = () => {
      if (entering) return;
      const lenis = getLenis();
      const destination = window.scrollY + rect().top;
      if (!lenis) {
        window.scrollTo({ top: destination });
        return;
      }
      entering = true;
      const finish = () => {
        entering = false;
      };
      lenis.scrollTo(destination, {
        duration: ENTER_DURATION,
        easing: easeInOutCubic,
        force: true,
        lock: true,
        onComplete: finish,
      });
      window.setTimeout(finish, ENTER_DURATION * 1000 + 500);
    };

    /**
     * Should a gesture in `direction` be handled by this section? Returns the
     * action to run (step or glide in), or null to let the page scroll.
     */
    const intent = (direction: number): (() => void) | null => {
      if (!active() || busy()) return null;
      if (entering) return () => {};
      const box = rect();
      if (Math.abs(box.top) <= 3) {
        if (tween) return () => {}; // mid-step: swallow input
        const next = index + direction;
        if (next < 0 || next > optionsRef.current.count - 1) return null;
        return () => stepTo(next);
      }
      const height = window.innerHeight;
      if (direction > 0 && box.top > 3 && box.top < height * 0.85) return glideIn;
      if (direction < 0 && box.top < -3 && box.bottom > height * 0.15) return glideIn;
      return null;
    };

    const onWheel = (event: WheelEvent) => {
      if (event.defaultPrevented || event.ctrlKey) return;
      const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
      const dy = event.deltaY * scale;
      if (!dy || Math.abs(dy) < Math.abs(event.deltaX * scale)) return;
      const direction = dy > 0 ? 1 : -1;
      const now = performance.now();
      const abs = Math.abs(dy);
      const fresh =
        now - lastWheel > WHEEL_GESTURE_GAP ||
        direction !== lastWheelDir ||
        (abs > lastWheelAbs * 1.6 && abs > 24);
      lastWheel = now;
      lastWheelAbs = abs;
      lastWheelDir = direction;

      const action = intent(direction);
      if (!action) return;
      event.preventDefault();
      event.stopPropagation(); // keep Lenis from scrolling the page
      if (fresh) action();
    };

    const onTouchStart = (event: TouchEvent) => {
      touchDecided = event.touches.length !== 1;
      touchCapture = false;
      touchFired = false;
      touchAction = null;
      touchY = event.touches[0]?.clientY ?? 0;
    };

    const onTouchMove = (event: TouchEvent) => {
      const dy = touchY - (event.touches[0]?.clientY ?? touchY);
      if (!touchDecided) {
        if (!dy) return;
        touchDecided = true;
        touchAction = intent(dy > 0 ? 1 : -1);
        touchCapture = Boolean(touchAction);
      }
      if (!touchCapture) return;
      if (event.cancelable) event.preventDefault();
      if (!touchFired && Math.abs(dy) > SWIPE_DISTANCE) {
        touchFired = true;
        touchAction?.();
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      const space = event.key === " ";
      if (space && target?.closest("button, a")) return;
      let direction = 0;
      if (event.key === "ArrowDown" || event.key === "PageDown" || (space && !event.shiftKey)) direction = 1;
      else if (event.key === "ArrowUp" || event.key === "PageUp" || (space && event.shiftKey)) direction = -1;
      if (!direction) return;
      const action = intent(direction);
      if (!action) return;
      event.preventDefault();
      if (!event.repeat) action();
    };

    window.addEventListener("wheel", onWheel, { passive: false, capture: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("wheel", onWheel, { capture: true });
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("keydown", onKeyDown);
      tween?.kill();
      if (optionsRef.current.controlRef) optionsRef.current.controlRef.current = null;
    };
  }, [ref, count, minWidth]);
}
