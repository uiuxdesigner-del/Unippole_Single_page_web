"use client";

/**
 * Adapted from the official React Bits "PillNav-TS-TW" component.
 *
 * Next.js adaptations:
 * - Uses normal anchor elements instead of react-router-dom.
 * - Supports hash navigation through onNavigate.
 * - Supports hiding the internal logo.
 * - Removes the active dot.
 * - activeHref is used only for aria-current accessibility.
 * - No pill receives a permanent active background.
 * - Every pill remains white and turns black only on hover/focus.
 * - GSAP motion respects prefers-reduced-motion.
 */

import React, {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
} from "react";
import { gsap } from "gsap";

export type PillNavItem = {
  label: string;
  href: string;
  ariaLabel?: string;
};

export interface PillNavProps {
  logo?: string;
  logoAlt?: string;
  showLogo?: boolean;
  items: PillNavItem[];
  activeHref?: string;
  className?: string;
  ease?: string;
  baseColor?: string;
  pillColor?: string;
  hoveredPillTextColor?: string;
  pillTextColor?: string;
  onMobileMenuClick?: () => void;
  onNavigate?: (href: string) => void;
  initialLoadAnimation?: boolean;
}

const PillNav: React.FC<PillNavProps> = ({
  logo,
  logoAlt = "Logo",
  showLogo = true,
  items,
  activeHref,
  className = "",
  ease = "power2.easeOut",
  baseColor = "#111111",
  pillColor = "#ffffff",
  hoveredPillTextColor = "#ffffff",
  pillTextColor = "#111111",
  onMobileMenuClick,
  onNavigate,
  initialLoadAnimation = true,
}) => {
  const resolvedPillTextColor = pillTextColor ?? baseColor;

  const [isMobileMenuOpen, setIsMobileMenuOpen] =
    useState(false);

  const circleRefs = useRef<
    Array<HTMLSpanElement | null>
  >([]);

  const timelineRefs = useRef<
    Array<gsap.core.Timeline | null>
  >([]);

  const activeTweenRefs = useRef<
    Array<gsap.core.Tween | null>
  >([]);

  const logoImgRef = useRef<HTMLImageElement | null>(null);
  const logoTweenRef = useRef<gsap.core.Tween | null>(null);
  const hamburgerRef = useRef<HTMLButtonElement | null>(null);
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);
  const navItemsRef = useRef<HTMLDivElement | null>(null);
  const logoRef = useRef<HTMLAnchorElement | null>(null);
  const reducedMotionRef = useRef(false);

  useEffect(() => {
    const query = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );

    const handleMotionPreference = () => {
      reducedMotionRef.current = query.matches;
    };

    handleMotionPreference();

    query.addEventListener(
      "change",
      handleMotionPreference,
    );

    return () => {
      query.removeEventListener(
        "change",
        handleMotionPreference,
      );
    };
  }, []);

  const duration = (value: number) =>
    reducedMotionRef.current ? 0 : value;

  useEffect(() => {
    const createAnimations = () => {
      circleRefs.current.forEach((circle, index) => {
        if (!circle?.parentElement) return;

        const pill = circle.parentElement as HTMLElement;
        const rect = pill.getBoundingClientRect();

        const width = rect.width;
        const height = rect.height;

        if (!width || !height) return;

        const radius =
          ((width * width) / 4 + height * height) /
          (2 * height);

        const diameter = Math.ceil(2 * radius) + 2;

        const delta =
          Math.ceil(
            radius -
              Math.sqrt(
                Math.max(
                  0,
                  radius * radius -
                    (width * width) / 4,
                ),
              ),
          ) + 1;

        const transformOriginY = diameter - delta;

        circle.style.width = `${diameter}px`;
        circle.style.height = `${diameter}px`;
        circle.style.bottom = `-${delta}px`;

        gsap.set(circle, {
          xPercent: -50,
          scale: 0,
          transformOrigin: `50% ${transformOriginY}px`,
        });

        const defaultLabel =
          pill.querySelector<HTMLElement>(
            ".pill-label",
          );

        const hoverLabel =
          pill.querySelector<HTMLElement>(
            ".pill-label-hover",
          );

        if (defaultLabel) {
          gsap.set(defaultLabel, {
            y: 0,
            opacity: 1,
          });
        }

        if (hoverLabel) {
          gsap.set(hoverLabel, {
            y: Math.ceil(height + 100),
            opacity: 0,
          });
        }

        timelineRefs.current[index]?.kill();

        const timeline = gsap.timeline({
          paused: true,
        });

        timeline.to(
          circle,
          {
            scale: 1.2,
            xPercent: -50,
            duration: 2,
            ease,
            overwrite: "auto",
          },
          0,
        );

        if (defaultLabel) {
          timeline.to(
            defaultLabel,
            {
              y: -(height + 8),
              opacity: 0,
              duration: 2,
              ease,
              overwrite: "auto",
            },
            0,
          );
        }

        if (hoverLabel) {
          timeline.to(
            hoverLabel,
            {
              y: 0,
              opacity: 1,
              duration: 2,
              ease,
              overwrite: "auto",
            },
            0,
          );
        }

        timelineRefs.current[index] = timeline;
      });
    };

    createAnimations();

    const handleResize = () => {
      createAnimations();
    };

    window.addEventListener("resize", handleResize);

    document.fonts?.ready
      .then(() => {
        createAnimations();
      })
      .catch(() => undefined);

    const mobileMenu = mobileMenuRef.current;

    if (mobileMenu) {
      gsap.set(mobileMenu, {
        visibility: "hidden",
        opacity: 0,
        scaleY: 1,
        y: 0,
      });
    }

    if (initialLoadAnimation) {
      const logoElement = logoRef.current;
      const navItems = navItemsRef.current;

      if (logoElement) {
        gsap.set(logoElement, {
          scale: 0,
        });

        gsap.to(logoElement, {
          scale: 1,
          duration: duration(0.6),
          ease,
        });
      }

      if (navItems) {
        gsap.set(navItems, {
          width: 0,
          overflow: "hidden",
        });

        gsap.to(navItems, {
          width: "auto",
          duration: duration(0.6),
          ease,
        });
      }
    }

    const timelines = timelineRefs.current;
    const activeTweens = activeTweenRefs.current;

    return () => {
      window.removeEventListener(
        "resize",
        handleResize,
      );

      timelines.forEach((timeline) => {
        timeline?.kill();
      });

      activeTweens.forEach((tween) => {
        tween?.kill();
      });

      logoTweenRef.current?.kill();
    };
  }, [items, ease, initialLoadAnimation]);

  const handleEnter = (index: number) => {
    const timeline = timelineRefs.current[index];

    if (!timeline) return;

    activeTweenRefs.current[index]?.kill();

    activeTweenRefs.current[index] =
      timeline.tweenTo(timeline.duration(), {
        duration: duration(0.3),
        ease,
        overwrite: "auto",
      });
  };

  const handleLeave = (index: number) => {
    const timeline = timelineRefs.current[index];

    if (!timeline) return;

    activeTweenRefs.current[index]?.kill();

    activeTweenRefs.current[index] =
      timeline.tweenTo(0, {
        duration: duration(0.2),
        ease,
        overwrite: "auto",
      });
  };

  const handleLogoEnter = () => {
    const image = logoImgRef.current;

    if (!image) return;

    logoTweenRef.current?.kill();

    gsap.set(image, {
      rotate: 0,
    });

    logoTweenRef.current = gsap.to(image, {
      rotate: 360,
      duration: duration(0.2),
      ease,
      overwrite: "auto",
    });
  };

  const handleNavigation = (
    event: MouseEvent<HTMLAnchorElement>,
    href: string,
  ) => {
    if (!onNavigate) return;

    event.preventDefault();
    onNavigate(href);
  };

  const toggleMobileMenu = () => {
    const nextState = !isMobileMenuOpen;

    setIsMobileMenuOpen(nextState);

    const hamburger = hamburgerRef.current;
    const mobileMenu = mobileMenuRef.current;

    if (hamburger) {
      const lines = hamburger.querySelectorAll(
        ".hamburger-line",
      );

      if (nextState) {
        gsap.to(lines[0], {
          rotation: 45,
          y: 3,
          duration: duration(0.3),
          ease,
        });

        gsap.to(lines[1], {
          rotation: -45,
          y: -3,
          duration: duration(0.3),
          ease,
        });
      } else {
        gsap.to(lines[0], {
          rotation: 0,
          y: 0,
          duration: duration(0.3),
          ease,
        });

        gsap.to(lines[1], {
          rotation: 0,
          y: 0,
          duration: duration(0.3),
          ease,
        });
      }
    }

    if (mobileMenu) {
      if (nextState) {
        gsap.set(mobileMenu, {
          visibility: "visible",
        });

        gsap.fromTo(
          mobileMenu,
          {
            opacity: 0,
            y: 10,
            scaleY: 1,
          },
          {
            opacity: 1,
            y: 0,
            scaleY: 1,
            duration: duration(0.3),
            ease,
            transformOrigin: "top center",
          },
        );
      } else {
        gsap.to(mobileMenu, {
          opacity: 0,
          y: 10,
          scaleY: 1,
          duration: duration(0.2),
          ease,
          transformOrigin: "top center",
          onComplete: () => {
            gsap.set(mobileMenu, {
              visibility: "hidden",
            });
          },
        });
      }
    }

    onMobileMenuClick?.();
  };

  const cssVariables = {
    ["--base"]: baseColor,
    ["--pill-bg"]: pillColor,
    ["--hover-text"]: hoveredPillTextColor,
    ["--pill-text"]: resolvedPillTextColor,

    // Overall navigation height
    ["--nav-h"]: "55px",

    // Horizontal spacing inside each pill
    ["--pill-pad-x"]: "18px",

    // Black space between white pills
    ["--pill-gap"]: "3px",
  } as CSSProperties;

  return (
    <div className="relative">
      <nav
        aria-label="Primary navigation"
        className={[
          "flex w-full items-center justify-between",
          "box-border px-4",
          "md:w-max md:justify-start md:px-0",
          className,
        ].join(" ")}
        style={cssVariables}
      >
        {showLogo && logo && (
          <a
            ref={logoRef}
            href={items[0]?.href || "#"}
            aria-label="Home"
            onMouseEnter={handleLogoEnter}
            onClick={(event) =>
              handleNavigation(
                event,
                items[0]?.href || "#",
              )
            }
            className={[
              "inline-flex items-center justify-center",
              "overflow-hidden rounded-full p-2",
            ].join(" ")}
            style={{
              width: "var(--nav-h)",
              height: "var(--nav-h)",
              background: "var(--base, #111111)",
            }}
          >
            <img
              ref={logoImgRef}
              src={logo}
              alt={logoAlt}
              className="block h-full w-full object-cover"
            />
          </a>
        )}

        <div
          ref={navItemsRef}
          className={[
            "relative ml-2 hidden items-center",
            "overflow-hidden rounded-full md:flex",
          ].join(" ")}
          style={{
            height: "var(--nav-h)",
            background: "var(--base, #111111)",
          }}
        >
          <ul
            role="menubar"
            className={[
              "m-0 flex h-full list-none",
              "items-stretch p-[3px]",
            ].join(" ")}
            style={{
              gap: "var(--pill-gap)",
            }}
          >
            {items.map((item, index) => {
              /*
               * activeHref is used only for accessibility.
               * It does not change the visual background.
               */
              const isCurrent =
                activeHref === item.href;

              const pillStyle: CSSProperties = {
                // Every pill stays white by default.
                background:
                  "var(--pill-bg, #ffffff)",

                // Every pill has dark text by default.
                color:
                  "var(--pill-text, #111111)",

                paddingLeft:
                  "var(--pill-pad-x)",

                paddingRight:
                  "var(--pill-pad-x)",
              };

              const pillClasses = [
                "relative inline-flex h-full",
                "items-center justify-center",
                "overflow-hidden rounded-full",
                "box-border cursor-pointer",
                "whitespace-nowrap no-underline",
                "px-0 font-medium",
                "text-[15px]",
                "leading-none tracking-[0.2px]",
                "xl:text-[16px]",
                "2xl:text-[17px]",
                "focus-visible:outline-none",
                "focus-visible:ring-2",
                "focus-visible:ring-white",
                "focus-visible:ring-offset-2",
                "focus-visible:ring-offset-black",
              ].join(" ");

              return (
                <li
                  key={item.href}
                  role="none"
                  className="flex h-full"
                >
                  <a
                    role="menuitem"
                    href={item.href}
                    className={pillClasses}
                    style={pillStyle}
                    aria-label={
                      item.ariaLabel || item.label
                    }
                    aria-current={
                      isCurrent ? "page" : undefined
                    }
                    onMouseEnter={() =>
                      handleEnter(index)
                    }
                    onMouseLeave={() =>
                      handleLeave(index)
                    }
                    onFocus={() =>
                      handleEnter(index)
                    }
                    onBlur={() =>
                      handleLeave(index)
                    }
                    onClick={(event) =>
                      handleNavigation(
                        event,
                        item.href,
                      )
                    }
                  >
                    {/* Black circular hover fill */}
                    <span
                      ref={(element) => {
                        circleRefs.current[index] =
                          element;
                      }}
                      aria-hidden="true"
                      className={[
                        "pointer-events-none absolute",
                        "bottom-0 left-1/2 z-[1]",
                        "block rounded-full",
                      ].join(" ")}
                      style={{
                        background:
                          "var(--base, #111111)",
                        willChange: "transform",
                      }}
                    />

                    <span className="relative z-[2] inline-block overflow-hidden leading-none">
                      {/* Default black text */}
                      <span
                        className="pill-label relative z-[2] inline-block leading-none"
                        style={{
                          willChange:
                            "transform, opacity",
                        }}
                      >
                        {item.label}
                      </span>

                      {/* White text shown only on hover */}
                      <span
                        aria-hidden="true"
                        className={[
                          "pill-label-hover absolute",
                          "left-0 top-0 z-[3]",
                          "inline-block leading-none",
                        ].join(" ")}
                        style={{
                          color:
                            "var(--hover-text, #ffffff)",
                          willChange:
                            "transform, opacity",
                        }}
                      >
                        {item.label}
                      </span>
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </div>

        <button
          ref={hamburgerRef}
          type="button"
          onClick={toggleMobileMenu}
          aria-label="Toggle menu"
          aria-expanded={isMobileMenuOpen}
          className={[
            "relative flex cursor-pointer",
            "flex-col items-center justify-center",
            "gap-1 rounded-full border-0 p-0",
            "md:hidden",
          ].join(" ")}
          style={{
            width: "var(--nav-h)",
            height: "var(--nav-h)",
            background: "var(--base, #111111)",
          }}
        >
          <span
            className="hamburger-line h-0.5 w-4 rounded"
            style={{
              background:
                "var(--pill-bg, #ffffff)",
            }}
          />

          <span
            className="hamburger-line h-0.5 w-4 rounded"
            style={{
              background:
                "var(--pill-bg, #ffffff)",
            }}
          />
        </button>
      </nav>

      <div
        ref={mobileMenuRef}
        className={[
          "absolute left-4 right-4 top-[3.5em]",
          "z-[998] origin-top rounded-[27px]",
          "shadow-[0_8px_32px_rgba(0,0,0,0.12)]",
          "md:hidden",
        ].join(" ")}
        style={{
          ...cssVariables,
          background: "var(--base, #111111)",
        }}
      >
        <ul className="m-0 flex list-none flex-col gap-[3px] p-[3px]">
          {items.map((item) => (
            <li key={item.href}>
              <a
                href={item.href}
                className={[
                  "block rounded-[50px]",
                  "px-4 py-3",
                  "text-[16px] font-medium",
                  "transition-colors duration-200",
                ].join(" ")}
                style={{
                  background:
                    "var(--pill-bg, #ffffff)",
                  color:
                    "var(--pill-text, #111111)",
                }}
                onMouseEnter={(event) => {
                  event.currentTarget.style.background =
                    "var(--base, #111111)";

                  event.currentTarget.style.color =
                    "var(--hover-text, #ffffff)";
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.background =
                    "var(--pill-bg, #ffffff)";

                  event.currentTarget.style.color =
                    "var(--pill-text, #111111)";
                }}
                onFocus={(event) => {
                  event.currentTarget.style.background =
                    "var(--base, #111111)";

                  event.currentTarget.style.color =
                    "var(--hover-text, #ffffff)";
                }}
                onBlur={(event) => {
                  event.currentTarget.style.background =
                    "var(--pill-bg, #ffffff)";

                  event.currentTarget.style.color =
                    "var(--pill-text, #111111)";
                }}
                onClick={(event) => {
                  setIsMobileMenuOpen(false);

                  handleNavigation(
                    event,
                    item.href,
                  );
                }}
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default PillNav;