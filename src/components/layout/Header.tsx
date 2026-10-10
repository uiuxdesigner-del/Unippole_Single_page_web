"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { ArrowUpRight, Menu, X } from "lucide-react";
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
type HeaderTheme = "dark" | "light";
const themeVars: Record<HeaderTheme, Record<string, string | number>> = {
  dark: {
    "--hdr-fg": "rgba(255,255,255,1)",
    "--hdr-muted": "rgba(255,255,255,0.6)",
    "--hdr-border": "rgba(255,255,255,0.15)",
    "--hdr-divider": "rgba(255,255,255,0.25)",
    "--hdr-lens-a": "rgba(255,255,255,0.1)",
    "--hdr-lens-b": "rgba(255,255,255,0.03)",
    "--hdr-lens-border": "rgba(255,255,255,0.15)",
    "--hdr-edge": "rgba(255,255,255,0.24)",
    "--hdr-inset-b": "rgba(0,0,0,0.3)",
    "--hdr-drop": "rgba(0,0,0,0.2)",
    "--hdr-sheen": "rgba(255,255,255,0.3)",
    "--hdr-chip-bg": "rgba(255,255,255,1)",
    "--hdr-chip-fg": "rgba(0,0,0,1)",
    "--hdr-lens-hi": "rgba(255,255,255,0.03)",
    "--hdr-lens-sh": "rgba(0,0,0,0)",
    "--hdr-lens-drop": "rgba(0,0,0,0.2)",
    "--hdr-fill": 0,
    "--hdr-logo-light": 0,
  },
  light: {
    "--hdr-fg": "rgba(17,17,20,1)",
    "--hdr-muted": "rgba(17,17,20,0.6)",
    "--hdr-border": "rgba(255,255,255,0.7)",
    "--hdr-divider": "rgba(17,17,20,0.15)",
    "--hdr-lens-a": "rgba(17,17,20,0.025)",
    "--hdr-lens-b": "rgba(17,17,20,0.06)",
    "--hdr-lens-border": "rgba(255,255,255,0.8)",
    "--hdr-edge": "rgba(255,255,255,1)",
    "--hdr-inset-b": "rgba(17,17,20,0.09)",
    "--hdr-drop": "rgba(17,17,20,0.14)",
    "--hdr-sheen": "rgba(255,255,255,0)",
    "--hdr-chip-bg": "rgba(241,241,243,1)",
    "--hdr-chip-fg": "rgba(17,17,20,1)",
    "--hdr-lens-hi": "rgba(255,255,255,1)",
    "--hdr-lens-sh": "rgba(17,17,20,0.07)",
    "--hdr-lens-drop": "rgba(17,17,20,0.1)",
    "--hdr-fill": 1,
    "--hdr-logo-light": 1,
  },
};
const focusStyle =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--hdr-fg)] focus-visible:outline-offset-4";

function IslandFrame({ compact, grip = true }: { compact: boolean; grip?: boolean }) {
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
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-[28px] border"
      style={{
        borderColor: "var(--hdr-border)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        boxShadow:
          "inset 0 1px 0 var(--hdr-edge), inset 0 -1px 0 var(--hdr-inset-b), 0 12px 32px var(--hdr-drop), 0 1px 2px var(--hdr-lens-sh)",
      }}
    >
      <span
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(135deg,rgba(48,54,63,.92),rgba(17,21,27,.94) 55%,rgba(38,44,53,.92))",
          opacity: "clamp(0, calc((1 - var(--hdr-fill)) * 6), 1)",
        }}
      />
      <span
        className="absolute inset-0"
        style={{
          background: "linear-gradient(180deg,#ffffff,#f3f3f6)",
          opacity: "var(--hdr-fill)",
        }}
      />
      <span
        className="absolute inset-x-7 top-[3px] h-px"
        style={{ background: "linear-gradient(90deg,transparent,var(--hdr-sheen),transparent)" }}
      />
      {grip && (
        <span className="absolute bottom-[4px] left-1/2 h-[2px] w-10 -translate-x-1/2 rounded-full bg-slate-400/30" />
      )}
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
  const activeRef = useRef(activeHref);
  const selectRef = useRef<(() => void) | null>(null);
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
      const activeIndex = headerNav.findIndex((item) => item.href === activeRef.current);
      const index = hovered >= 0 ? hovered : focused >= 0 ? focused : activeIndex;
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
          x: link.offsetLeft,
          width: link.offsetWidth,
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
    const resize = new ResizeObserver(() => select());
    resize.observe(root);
    selectRef.current = select;
    select();
    return () => {
      selectRef.current = null;
      removers.forEach((remove) => remove());
      resize.disconnect();
      slide?.kill();
      surfaces.forEach((tween) => tween?.kill());
      gsap.set(shapes, { clearProps: "transform" });
      gsap.set(light, { opacity: 0 });
    };
  }, [reduced]);
  useEffect(() => {
    activeRef.current = activeHref;
    selectRef.current?.();
  }, [activeHref]);
  return (
    <nav ref={nav} aria-label="Primary navigation" className="relative flex items-center gap-1">
      <span
        ref={highlight}
        data-island-highlight
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 z-[1] h-11 rounded-[14px] border opacity-0"
        style={{
          borderColor: "var(--hdr-lens-border)",
          background: "linear-gradient(165deg,var(--hdr-lens-a),var(--hdr-lens-b))",
          boxShadow:
            "inset 0 1px 0 var(--hdr-lens-hi), inset 0 -1px 0 var(--hdr-lens-sh), 0 3px 8px var(--hdr-lens-drop)",
        }}
      />
      {headerNav.map((item) => (
        <a
          key={item.href}
          href={item.href}
          aria-current={activeHref === item.href ? "page" : undefined}
          onClick={(event) => navigate(event, item.href)}
          className={`group relative inline-flex h-11 items-center justify-center rounded-[14px] px-[18px] text-[14px] font-medium leading-none transition-colors duration-300 hover:text-[color:var(--hdr-fg)] ${
            activeHref === item.href ? "text-[color:var(--hdr-fg)]" : "text-[color:var(--hdr-muted)]"
          } ${focusStyle}`}
        >
          <span data-pill-surface aria-hidden="true" className="pointer-events-none absolute inset-0" />
          <span data-pill-label className="pointer-events-none relative z-[2]">
            {item.label}
          </span>
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute bottom-[6px] left-1/2 z-[2] h-[2px] w-[9px] -translate-x-1/2 rounded-full bg-adinn-red transition-all duration-300 ${
              activeHref === item.href ? "scale-x-100 opacity-100" : "scale-x-30 opacity-0"
            }`}
          />
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
    const root = header.current;
    if (!root) return;
    let theme: HeaderTheme | null = null;
    const apply = (next: HeaderTheme) => {
      if (next === theme) return;
      const first = theme === null;
      theme = next;
      gsap.to(root, {
        ...themeVars[next],
        duration: first || reduced ? 0 : 0.6,
        ease: "power2.inOut",
        overwrite: "auto",
      });
    };
    let io: IntersectionObserver | null = null;
    let mo: MutationObserver | null = null;
    const attach = () => {
      const hero = document.querySelector<HTMLElement>('[data-header-theme="dark"]');
      if (!hero) return false;
      // Dark while the hero still overlaps the strip occupied by the header.
      io = new IntersectionObserver(
        ([entry]) => apply(entry.isIntersecting ? "dark" : "light"),
        { rootMargin: "-88px 0px 0px 0px", threshold: 0 },
      );
      io.observe(hero);
      return true;
    };
    if (!attach()) {
      mo = new MutationObserver(() => {
        if (attach()) mo?.disconnect();
      });
      mo.observe(document.body, { childList: true, subtree: true });
    }
    return () => {
      io?.disconnect();
      mo?.disconnect();
      gsap.killTweensOf(root);
    };
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
    // Position-based: the last section whose top has passed the probe line stays
    // active until the next one reaches it ("top" wraps the page, so it is only
    // the fallback above About).
    let frame = 0;
    const update = () => {
      frame = 0;
      const probe = window.innerHeight * 0.4;
      let active = sectionIds[0];
      for (const id of sectionIds.slice(1)) {
        const element = document.getElementById(id);
        if (element && element.getBoundingClientRect().top <= probe) active = id;
      }
      setActiveHref(`#${active}`);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
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
    <span className="relative block">
      <Image
        src="/AdinnLogoWhite.svg"
        alt="ADINN"
        width={130}
        height={42}
        priority
        className="h-9 w-auto object-contain lg:h-[38px]"
        style={{ opacity: "clamp(0, calc(1 - var(--hdr-logo-light) * 2), 1)" }}
      />
      <Image
        src="/AdinnLogo.svg"
        alt=""
        aria-hidden="true"
        width={130}
        height={42}
        priority
        className="absolute inset-0 h-full w-full object-contain"
        style={{ opacity: "clamp(0, calc(var(--hdr-logo-light) * 2 - 1), 1)" }}
      />
    </span>
  );

  return (
    <header ref={header} className="pointer-events-none fixed inset-x-0 top-0 z-[100] [--hdr-border:rgba(255,255,255,0.15)] [--hdr-chip-bg:rgba(255,255,255,1)] [--hdr-chip-fg:rgba(0,0,0,1)] [--hdr-divider:rgba(255,255,255,0.25)] [--hdr-drop:rgba(0,0,0,0.2)] [--hdr-edge:rgba(255,255,255,0.24)] [--hdr-fg:rgba(255,255,255,1)] [--hdr-fill:0] [--hdr-lens-hi:rgba(255,255,255,0.03)] [--hdr-lens-sh:rgba(0,0,0,0)] [--hdr-lens-drop:rgba(0,0,0,0.2)] [--hdr-inset-b:rgba(0,0,0,0.3)] [--hdr-lens-a:rgba(255,255,255,0.1)] [--hdr-lens-b:rgba(255,255,255,0.03)] [--hdr-lens-border:rgba(255,255,255,0.15)] [--hdr-logo-light:0] [--hdr-muted:rgba(255,255,255,0.6)] [--hdr-sheen:rgba(255,255,255,0.3)]">
      <div className="container-x flex justify-center pt-3 lg:pt-5">
        <div
          data-desktop-island
          className="pointer-events-auto relative isolate hidden h-[68px] w-full max-w-[720px] grid-cols-[1fr_auto_1fr] items-center gap-4 pl-6 pr-3 lg:grid"
        >
          <IslandFrame compact={scrolled} grip={false} />
          <div className="relative flex items-center gap-5 justify-self-start">
            <a
              href="#top"
              onClick={(event) => navigate(event, "#top")}
              aria-label="ADINN Home"
              className={`rounded-sm ${focusStyle}`}
            >
              {logo}
            </a>
            <span
              aria-hidden="true"
              className="h-7 w-px shrink-0"
              style={{ background: "linear-gradient(transparent,var(--hdr-divider),transparent)" }}
            />
          </div>
          <IslandNavigation activeHref={activeHref} navigate={navigate} />
          <BrandButton
            onClick={enquire}
            className="group relative h-12 shrink-0 justify-self-end gap-4 !rounded-2xl border border-white/15 pl-5 pr-2 text-[13px] font-semibold"
            size="md"
          >
            Enquire Now
            <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[11px] border border-white/15 bg-white/10 transition-transform duration-300 group-hover:-translate-y-px group-hover:translate-x-px">
              <ArrowUpRight size={16} strokeWidth={1.7} aria-hidden="true" />
            </span>
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
              className={`inline-flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--hdr-chip-bg)] text-[color:var(--hdr-chip-fg)] ${focusStyle}`}
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
                    className={`flex h-11 items-center justify-center rounded-full bg-[color:var(--hdr-chip-bg)] text-[15px] font-medium text-[color:var(--hdr-chip-fg)] ${focusStyle}`}
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
