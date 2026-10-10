"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Menu, X } from "lucide-react";
import { gsap } from "gsap";
import { scrollToHash } from "@/hooks/useLenis";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { BrandButton } from "@/components/ui/BrandButton";
//demo commit
const headerNav = [
  { label: "Home", href: "#top" },
  { label: "About", href: "#about" },
  { label: "Inventory", href: "#inventory" },
];
const sectionIds = ["top", "about", "inventory"];
const focusStyle =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-4";

function IslandFrame({ compact }: { compact: boolean }) {
  const frame = useRef<HTMLDivElement>(null);
  const sweep = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();
  const entered = useRef(false);
  useEffect(() => {
    const context = gsap.context(() => {
      const shape = {
        scaleX: compact ? 1 : 1.018,
        scaleY: compact ? 0.95 : 1,
        duration: reduced ? 0 : 0.65,
        ease: "power3.inOut",
      };
      if (!entered.current && !reduced) {
        gsap.fromTo(frame.current, { scaleX: 0.96, scaleY: 0.94 }, shape);
      } else gsap.to(frame.current, shape);
      entered.current = true;
      if (!reduced)
        gsap.fromTo(
          sweep.current,
          { xPercent: -150, opacity: 0 },
          {
            xPercent: 450,
            opacity: 0.22,
            duration: 1.7,
            ease: "sine.inOut",
            onComplete: () => {
              gsap.set(sweep.current, { opacity: 0 });
            },
          },
        );
      else gsap.set(sweep.current, { opacity: 0 });
    });
    return () => context.kill(false);
  }, [compact, reduced]);
  return (
    <div
      ref={frame}
      data-island-frame
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-[30px] border border-white/20"
      style={{
        background:
          "linear-gradient(135deg,rgba(48,54,63,.92),rgba(17,21,27,.94) 55%,rgba(38,44,53,.92))",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,.24), inset 0 -1px 0 rgba(0,0,0,.3), 0 12px 32px rgba(0,0,0,.2)",
      }}
    >
      <span className="absolute inset-x-7 top-[3px] h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
      <span className="absolute bottom-[4px] left-1/2 h-[2px] w-10 -translate-x-1/2 rounded-full bg-slate-400/30" />
      <span
        ref={sweep}
        className="absolute inset-y-0 left-0 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/25 to-transparent opacity-0"
      />
    </div>
  );
}

function IslandNavigation({
  activeHref,
  navigate,
}: {
  activeHref: string;
  navigate: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
}) {
  const nav = useRef<HTMLElement>(null);
  const highlight = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    const root = nav.current,
      light = highlight.current;
    if (!root || !light) return;
    const links = Array.from(root.querySelectorAll<HTMLAnchorElement>("a"));
    const shapes = links.map((link) => link.querySelector<HTMLElement>("[data-pill-surface]")!);
    const surfaces: Array<gsap.core.Animation | null> = links.map(() => null);
    let slide: gsap.core.Tween | null = null;
    let hovered = -1,
      focused = -1;
    const select = () => {
      const index = hovered >= 0 ? hovered : focused;
      shapes.forEach((shape, i) => {
        surfaces[i]?.kill();
        surfaces[i] = gsap.to(shape, {
          scaleX: i === index ? 1.018 : 1,
          scaleY: i === index ? 1.08 : 1,
          duration: reduced ? 0 : 0.38,
          ease: "power3.out",
        });
      });
      slide?.kill();
      if (index < 0) {
        slide = gsap.to(light, {
          opacity: 0,
          scaleY: 0.9,
          duration: reduced ? 0 : 0.3,
          ease: "power2.inOut",
        });
      } else {
        const link = links[index];
        slide = gsap.to(light, {
          x: link.offsetLeft + 2,
          width: link.offsetWidth - 4,
          opacity: 1,
          scaleY: 1,
          duration: reduced ? 0 : 0.42,
          ease: "power3.inOut",
        });
      }
    };
    const removers = links.map((link, i) => {
      const enter = (event: PointerEvent) => {
        if (event.pointerType !== "touch") {
          hovered = i;
          select();
        }
      };
      const leave = () => {
        hovered = -1;
        select();
      };
      const focus = () => {
        focused = i;
        select();
      };
      const blur = () => {
        focused = -1;
        select();
      };
      const press = () => {
        surfaces[i]?.kill();
        surfaces[i] = gsap
          .timeline()
          .to(shapes[i], {
            scaleX: 0.98,
            scaleY: 0.95,
            duration: reduced ? 0 : 0.09,
            ease: "power2.out",
          })
          .to(shapes[i], {
            scaleX: hovered === i || focused === i ? 1.018 : 1,
            scaleY: hovered === i || focused === i ? 1.08 : 1,
            duration: reduced ? 0 : 0.28,
            ease: "power3.out",
          });
      };
      link.addEventListener("pointerenter", enter);
      link.addEventListener("pointerleave", leave);
      link.addEventListener("focus", focus);
      link.addEventListener("blur", blur);
      link.addEventListener("click", press);
      return () => {
        link.removeEventListener("pointerenter", enter);
        link.removeEventListener("pointerleave", leave);
        link.removeEventListener("focus", focus);
        link.removeEventListener("blur", blur);
        link.removeEventListener("click", press);
      };
    });
    const resize = new ResizeObserver(() => {
      if (hovered >= 0 || focused >= 0) select();
    });
    resize.observe(root);
    return () => {
      removers.forEach((remove) => remove());
      resize.disconnect();
      slide?.kill();
      surfaces.forEach((tween) => tween?.kill());
      gsap.set(shapes, { clearProps: "transform" });
      gsap.set(light, { opacity: 0 });
    };
  }, [reduced]);
  return (
    <nav ref={nav} aria-label="Primary navigation" className="relative flex items-center gap-2">
      <span
        ref={highlight}
        data-island-highlight
        aria-hidden="true"
        className="pointer-events-none absolute -top-[2px] left-0 z-[1] h-[46px] rounded-full border border-white/80 opacity-0"
        style={{
          background: "linear-gradient(120deg,#fff,#e0e5ec 55%,#f9fafb)",
          boxShadow: "0 3px 12px rgba(0,0,0,.14)",
        }}
      />
      {headerNav.map((item) => (
        <a
          key={item.href}
          href={item.href}
          aria-current={activeHref === item.href ? "page" : undefined}
          onClick={(event) => navigate(event, item.href)}
          className={`relative inline-flex h-[42px] items-center justify-center rounded-full px-[18px] text-[15px] font-medium leading-none text-black xl:text-base ${focusStyle}`}
        >
          <span
            data-pill-surface
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-full bg-white"
          />
          <span data-pill-label className="pointer-events-none relative z-[2]">
            {item.label}
          </span>
        </a>
      ))}
    </nav>
  );
}

export function Header() {
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeHref, setActiveHref] = useState("#top");
  const header = useRef<HTMLElement>(null);
  const mobile = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const keyboardOpen = useRef(false);
  const introShown = useRef(false);
  const openRef = useRef(open);

  useEffect(() => {
    const context = gsap.context(() => {
      gsap.fromTo(
        header.current,
        { opacity: reduced || introShown.current ? 1 : 0 },
        { opacity: 1, duration: reduced ? 0 : 0.65, ease: "power2.out" },
      );
    });
    introShown.current = true;
    return () => context.revert();
  }, [reduced]);

  useEffect(() => {
    let compact = false;
    const onScroll = () => {
      const next = compact ? window.scrollY > 8 : window.scrollY > 24;
      if (next !== compact) {
        compact = next;
        setScrolled(next);
      }
    };
    const initialScroll = requestAnimationFrame(onScroll);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(initialScroll);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  useEffect(() => {
    openRef.current = open;
    const target = panel.current,
      inner = content.current;
    if (!target || !inner) return;
    const timeline = gsap.timeline();
    if (open) {
      timeline
        .set(target, { visibility: "visible" })
        .to(target, {
          height: inner.scrollHeight,
          opacity: 1,
          duration: reduced ? 0 : 0.48,
          ease: "power3.inOut",
          onComplete: () => {
            if (openRef.current) gsap.set(target, { height: "auto" });
            if (keyboardOpen.current && openRef.current)
              inner.querySelector<HTMLAnchorElement>("a")?.focus();
          },
        })
        .fromTo(
          inner,
          { y: reduced ? 0 : -6, opacity: reduced ? 1 : 0 },
          { y: 0, opacity: 1, duration: reduced ? 0 : 0.32, ease: "power2.out" },
          0.12 * Number(!reduced),
        );
    } else {
      timeline
        .to(target, { height: 0, opacity: 0, duration: reduced ? 0 : 0.38, ease: "power3.inOut" })
        .set(target, { visibility: "hidden" });
    }
    return () => {
      timeline.kill();
    };
  }, [open, reduced]);

  useEffect(() => {
    if (!open) return;
    const close = () => {
      setOpen(false);
      toggle.current?.focus();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    const outside = (event: PointerEvent) => {
      if (!mobile.current?.contains(event.target as Node)) setOpen(false);
    };
    const query = window.matchMedia("(min-width: 1024px)");
    const breakpoint = () => {
      if (query.matches) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", outside);
    query.addEventListener("change", breakpoint);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", outside);
      query.removeEventListener("change", breakpoint);
    };
  }, [open]);

  useEffect(() => {
    const elements = sectionIds
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => element !== null);

    if (!elements.length) return;

    const intersecting = new Set<string>();

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const id = entry.target.id;

          if (entry.isIntersecting) {
            intersecting.add(id);
          } else {
            intersecting.delete(id);
          }
        });

        const activeId = [...sectionIds].reverse().find((id) => intersecting.has(id));

        if (activeId) {
          setActiveHref(`#${activeId}`);
        }
      },
      {
        rootMargin: "-45% 0px -50% 0px",
        threshold: 0,
      },
    );

    elements.forEach((element) => {
      observer.observe(element);
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  const navigate = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0)
      return;
    event.preventDefault();
    setActiveHref(href);
    if (open) {
      setOpen(false);
      toggle.current?.focus();
    }
    scrollToHash(href);
  };
  const enquire = () => {
    if (open) {
      setOpen(false);
      toggle.current?.focus();
    }
    scrollToHash("#contact");
  };
  const logo = (
    <Image
      src="/AdinnLogoWhite.svg"
      alt="ADINN"
      width={130}
      height={42}
      priority
      className="h-9 w-auto object-contain"
    />
  );

  return (
    <header ref={header} className="pointer-events-none fixed inset-x-0 top-0 z-[100]">
      <div className="container-x flex justify-center pt-3">
        <div
          data-desktop-island
          className="pointer-events-auto relative isolate hidden h-[60px] w-full max-w-[720px] grid-cols-[1fr_auto_1fr] items-center gap-5 px-6 lg:grid"
        >
          <IslandFrame compact={scrolled} />
          <a
            href="#top"
            onClick={(event) => navigate(event, "#top")}
            aria-label="ADINN Home"
            className={`relative justify-self-start rounded-sm ${focusStyle}`}
          >
            {logo}
          </a>
          <IslandNavigation activeHref={activeHref} navigate={navigate} />
          <BrandButton
            onClick={enquire}
            className="relative justify-self-end !rounded-full px-5"
            size="md"
          >
            Enquire Now
          </BrandButton>
        </div>
        <div
          ref={mobile}
          data-mobile-island
          className="pointer-events-auto relative isolate w-full max-w-[440px] lg:hidden"
        >
          <IslandFrame compact={scrolled && !open} />
          <div className="relative flex h-[60px] items-center justify-between px-5">
            <a
              href="#top"
              onClick={(event) => navigate(event, "#top")}
              aria-label="ADINN Home"
              className={`rounded-sm ${focusStyle}`}
            >
              {logo}
            </a>
            <button
              ref={toggle}
              type="button"
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              aria-controls="adinn-mobile-menu"
              onClick={(event) => {
                keyboardOpen.current = event.detail === 0;
                setOpen((value) => !value);
              }}
              className={`inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-black ${focusStyle}`}
            >
              {open ? <X size={18} strokeWidth={1.75} /> : <Menu size={18} strokeWidth={1.75} />}
            </button>
          </div>
          <div
            ref={panel}
            id="adinn-mobile-menu"
            inert={!open}
            aria-hidden={!open}
            className="relative overflow-hidden"
            style={{ height: 0, opacity: 0, visibility: "hidden" }}
          >
            <div ref={content} className="px-5 pb-5 pt-2">
              <nav aria-label="Mobile navigation" className="flex flex-col gap-2">
                {headerNav.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={(event) => navigate(event, item.href)}
                    aria-current={activeHref === item.href ? "page" : undefined}
                    className={`flex h-11 items-center justify-center rounded-full bg-white text-[15px] font-medium text-black ${focusStyle}`}
                  >
                    {item.label}
                  </a>
                ))}
              </nav>
              <BrandButton size="md" onClick={enquire} className="mt-4 w-full !rounded-full">
                Enquire Now
              </BrandButton>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
