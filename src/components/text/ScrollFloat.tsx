"use client";

import {
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

interface ScrollFloatProps {
  children: ReactNode;
  id?: string;
  scrollContainerRef?: RefObject<HTMLElement | null>;
  containerClassName?: string;
  textClassName?: string;
  animationDuration?: number;
  ease?: string;
  scrollStart?: string;
  scrollEnd?: string;
  stagger?: number;
  scrub?: boolean | number;
  playOnMount?: boolean;
}

export default function ScrollFloat({
  children,
  id,
  scrollContainerRef,
  containerClassName = "",
  textClassName = "",
  animationDuration = 1,
  ease = "power3.out",
  scrollStart = "top 90%",
  scrollEnd = "center 55%",
  stagger = 0.025,
  scrub = 0.8,
  playOnMount = false,
}: ScrollFloatProps) {
  const containerRef = useRef<HTMLHeadingElement | null>(null);

  const splitText = useMemo(() => {
    const text = typeof children === "string" ? children : "";

    return text.split(" ").map((word, wordIndex, words) => (
      <span
        key={`${word}-${wordIndex}`}
        className="inline-block whitespace-nowrap"
      >
        {word.split("").map((character, characterIndex) => (
          <span
            key={`${character}-${characterIndex}`}
            data-scroll-float-character
            className="inline-block"
          >
            {character}
          </span>
        ))}

        {wordIndex < words.length - 1 && (
          <span
            data-scroll-float-character
            className="inline-block"
            aria-hidden="true"
          >
            &nbsp;
          </span>
        )}
      </span>
    ));
  }, [children]);

  useEffect(() => {
    const element = containerRef.current;

    if (!element) return;

    gsap.registerPlugin(ScrollTrigger);

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const characters = element.querySelectorAll<HTMLElement>(
      "[data-scroll-float-character]",
    );

    if (reducedMotion) {
      gsap.set(characters, {
        opacity: 1,
        yPercent: 0,
        scaleX: 1,
        scaleY: 1,
        clearProps: "transform",
      });

      return;
    }

    if (playOnMount) {
      const context = gsap.context(() => {
        gsap.fromTo(
          characters,
          {
            opacity: 0,
            yPercent: 110,
            scaleY: 1.8,
            scaleX: 0.82,
            transformOrigin: "50% 0%",
            willChange: "opacity, transform",
          },
          {
            opacity: 1,
            yPercent: 0,
            scaleY: 1,
            scaleX: 1,
            duration: animationDuration,
            delay: 0.2,
            stagger,
            ease,
            clearProps: "willChange",
          },
        );
      }, element);

      return () => {
        context.revert();
      };
    }

    const scroller =
      scrollContainerRef?.current ?? undefined;

    const context = gsap.context(() => {
      gsap.fromTo(
        characters,
        {
          opacity: 0,
          yPercent: 120,
          scaleY: 2.1,
          scaleX: 0.75,
          transformOrigin: "50% 0%",
          willChange: "opacity, transform",
        },
        {
          opacity: 1,
          yPercent: 0,
          scaleY: 1,
          scaleX: 1,
          duration: animationDuration,
          stagger,
          ease,
          clearProps: "willChange",
          scrollTrigger: {
            trigger: element,
            scroller,
            start: scrollStart,
            end: scrollEnd,
            scrub,
            invalidateOnRefresh: true,
          },
        },
      );
    }, element);

    return () => {
      context.revert();
    };
  }, [
    animationDuration,
    ease,
    playOnMount,
    scrollContainerRef,
    scrollEnd,
    scrollStart,
    scrub,
    stagger,
  ]);

  return (
    <h1
      ref={containerRef}
      id={id}
      className={containerClassName}
    >
      <span className={textClassName}>
        {splitText}
      </span>
    </h1>
  );
}
