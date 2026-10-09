"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";

const BLEED = 18;
type Particle = { x: number; y: number; targetX: number; targetY: number; radius: number };

/** One canvas owns the dissolving surface; no opaque pill sits behind the particles. */
export function PillSplash({ reducedMotion }: { reducedMotion: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    if (!canvas || !host || reducedMotion) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const state = { t: 0 };
    const originalBackground = host.style.background;
    const label = host.querySelector<HTMLElement>("[data-pill-label]");
    let labelBox = { x: 0, y: 0, w: 0, h: 0 };
    let particles: Particle[] = [];
    let w = 0,
      h = 0,
      dpr = 1;
    let hovered = false,
      focused = false;
    let tween: gsap.core.Animation | null = null;

    const render = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w + BLEED * 2, h + BLEED * 2);
      host.style.background = state.t < 0.001 ? originalBackground : "transparent";
      if (state.t < 0.001 || !w || !h) return;
      ctx.save();
      ctx.translate(BLEED, BLEED);
      const t = state.t;
      // The surface recedes and loses opacity as its particles disperse.
      ctx.fillStyle = "#fff";
      ctx.globalAlpha = Math.pow(1 - t, 1.5);
      ctx.beginPath();
      ctx.roundRect(t * 8, t * 7, w - t * 16, h - t * 14, (h - t * 14) / 2);
      ctx.fill();

      // Only this compact, stationary contrast backing remains under black text.
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.roundRect(labelBox.x, labelBox.y, labelBox.w, labelBox.h, 5);
      ctx.fill();
      ctx.globalAlpha = Math.sin((t * Math.PI) / 2) * 0.55;
      for (const p of particles) {
        const x = p.x + (p.targetX - p.x) * t;
        const y = p.y + (p.targetY - p.y) * t;
        ctx.beginPath();
        ctx.arc(x, y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    };

    const build = () => {
      w = host.clientWidth;
      h = host.clientHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round((w + BLEED * 2) * dpr);
      canvas.height = Math.round((h + BLEED * 2) * dpr);
      canvas.style.width = `${w + BLEED * 2}px`;
      canvas.style.height = `${h + BLEED * 2}px`;
      particles = [];
      if (!w || !h) return;
      const hostRect = host.getBoundingClientRect();
      const textRect = label?.getBoundingClientRect();
      labelBox = textRect
        ? {
            x: textRect.left - hostRect.left - 5,
            y: textRect.top - hostRect.top - 3,
            w: textRect.width + 10,
            h: textRect.height + 6,
          }
        : { x: 0, y: 0, w: 0, h: 0 };
      const r = h / 2;
      const count = Math.min(64, Math.round(w / 1.6));
      for (let i = 0; i < count; i++) {
        const x = 1.5 + ((i * 0.61803398875) % 1) * (w - 3);
        const edge = Math.sqrt(Math.max(0, r * r - (x - Math.max(r, Math.min(w - r, x))) ** 2));
        const top = i % 2 === 0;
        const edgeY = r + (top ? -edge : edge);
        particles.push({
          x,
          y: edgeY + (top ? 1 : -1) * (1 + (i % 5)),
          targetX: Math.max(-1, Math.min(w + 1, x + ((i % 3) - 1) * 1.4)),
          targetY: top ? -(5 + (i % 8)) : h + 5 + (i % 8),
          radius: 0.35 + (i % 4) * 0.1,
        });
      }
      render();
    };

    const play = () => {
      tween?.kill();
      tween = gsap.to(state, {
        t: 1,
        duration: 0.75,
        ease: "power2.inOut",
        onUpdate: render,
      });
    };
    const restore = () => {
      if (hovered || focused) return;
      tween?.kill();
      tween = gsap.to(state, { t: 0, duration: 0.65, ease: "power2.inOut", onUpdate: render });
    };
    const enter = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      hovered = true;
      if (!focused) play();
    };
    const leave = () => {
      hovered = false;
      restore();
    };
    const focus = () => {
      focused = true;
      if (!hovered) play();
    };
    const blur = () => {
      focused = false;
      restore();
    };
    build();
    const resize = new ResizeObserver(build);
    resize.observe(host);
    host.addEventListener("pointerenter", enter);
    host.addEventListener("pointerleave", leave);
    host.addEventListener("focus", focus);
    host.addEventListener("blur", blur);
    return () => {
      tween?.kill();
      resize.disconnect();
      host.removeEventListener("pointerenter", enter);
      host.removeEventListener("pointerleave", leave);
      host.removeEventListener("focus", focus);
      host.removeEventListener("blur", blur);
      host.style.background = originalBackground;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [reducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute z-[1]"
      style={{ left: -BLEED, top: -BLEED, width: "calc(100% + 36px)", height: "calc(100% + 36px)" }}
    />
  );
}
