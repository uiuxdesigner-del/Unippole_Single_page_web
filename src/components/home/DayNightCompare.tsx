"use client";

import {
  useCallback,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import Image from "next/image";
import { MoveHorizontal } from "lucide-react";

const DAY_IMAGE = "/images/day-view.png";
const NIGHT_IMAGE = "/images/night-view.png";

const clamp = (value: number) => Math.max(4, Math.min(96, value));

export function DayNightCompare() {
  const [position, setPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);

  const updateFromPointer = useCallback((clientX: number) => {
    const container = containerRef.current;

    if (!container) return;

    const rect = container.getBoundingClientRect();
    const percentage = ((clientX - rect.left) / rect.width) * 100;

    setPosition(clamp(percentage));
  }, []);

  const stopDragging = (event: ReactPointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <section className="bg-adinn-warm py-20 md:py-28">
      <div className="container-x">
        <div className="max-w-2xl">
          <span className="text-xs font-medium uppercase tracking-[0.25em] text-adinn-red">
            Day &amp; Night
          </span>

          <h2 className="mt-4 text-h2 text-adinn-ink">
            Visible Through Every Hour
          </h2>

          <p className="mt-5 max-w-xl text-base leading-7 text-adinn-ink-2">
            Illuminated UNIPOLE sites maintain campaign visibility beyond
            daylight. Drag the comparison control to review the day and night
            presentation.
          </p>
        </div>

        <div
          ref={containerRef}
          className="relative mt-10 aspect-[16/9] w-full cursor-ew-resize touch-pan-y select-none overflow-hidden rounded-2xl border border-adinn-border bg-adinn-soft"
          onPointerDown={(event) => {
            draggingRef.current = true;
            event.currentTarget.setPointerCapture(event.pointerId);
            updateFromPointer(event.clientX);
          }}
          onPointerMove={(event) => {
            if (draggingRef.current) {
              updateFromPointer(event.clientX);
            }
          }}
          onPointerUp={stopDragging}
          onPointerCancel={stopDragging}
        >
          {/* Day image */}
          <Image
            src={DAY_IMAGE}
            alt="Unipole advertising site during daytime"
            fill
            priority
            unoptimized
            draggable={false}
            sizes="(max-width: 768px) 100vw, 1200px"
            className="pointer-events-none select-none object-cover"
          />

          {/* Night image */}
          <div
            className="absolute inset-0 overflow-hidden"
            style={{
              clipPath: `inset(0 ${100 - position}% 0 0)`,
            }}
            aria-hidden="true"
          >
            <Image
              src={NIGHT_IMAGE}
              alt=""
              fill
              unoptimized
              draggable={false}
              sizes="(max-width: 768px) 100vw, 1200px"
              className="pointer-events-none select-none object-cover"
            />
          </div>

          {/* Divider */}
          <div
            className="pointer-events-none absolute inset-y-0 z-10"
            style={{ left: `${position}%` }}
          >
            <div className="absolute inset-y-0 -translate-x-1/2 border-l-2 border-white/90 shadow-[0_0_8px_rgba(0,0,0,0.25)]" />
          </div>

          {/* Slider */}
          <button
            type="button"
            role="slider"
            aria-label="Compare the day and night unipole views"
            aria-orientation="horizontal"
            aria-valuemin={4}
            aria-valuemax={96}
            aria-valuenow={Math.round(position)}
            className="absolute top-1/2 z-20 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize place-items-center rounded-full border border-adinn-border bg-white text-adinn-ink shadow-[0_8px_24px_rgba(17,17,17,0.15)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-adinn-ink/50"
            style={{ left: `${position}%` }}
            onKeyDown={(event) => {
              if (event.key === "ArrowLeft") {
                event.preventDefault();
                setPosition((current) => clamp(current - 4));
              }

              if (event.key === "ArrowRight") {
                event.preventDefault();
                setPosition((current) => clamp(current + 4));
              }

              if (event.key === "Home") {
                event.preventDefault();
                setPosition(4);
              }

              if (event.key === "End") {
                event.preventDefault();
                setPosition(96);
              }
            }}
          >
            <MoveHorizontal size={18} strokeWidth={1.75} aria-hidden="true" />
          </button>

          <span className="pointer-events-none absolute left-4 top-4 z-20 rounded-full border border-white/20 bg-adinn-ink/75 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-white backdrop-blur">
            Night
          </span>

          <span className="pointer-events-none absolute right-4 top-4 z-20 rounded-full border border-adinn-border bg-white/90 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-adinn-ink backdrop-blur">
            Day
          </span>
        </div>
      </div>
    </section>
  );
}