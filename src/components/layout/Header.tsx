"use client";

import Image from "next/image";
import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import { Menu, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import {
  scrollToHash,
  lockScroll,
  unlockScroll,
} from "@/hooks/useLenis";
import { BrandButton } from "@/components/ui/BrandButton";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import PillNav, {
  type PillNavItem,
} from "@/components/navigation/PillNav";

const headerNav: PillNavItem[] = [
  { label: "Home", href: "#top" },
  { label: "About", href: "#about" },
  { label: "Inventory", href: "#inventory" },
];

const mobileNav: PillNavItem[] = [
  { label: "Home", href: "#top" },
  { label: "About", href: "#about" },
  { label: "Inventory", href: "#inventory" },
  { label: "Contact", href: "#contact" },
];

const sectionIds = ["top", "about", "inventory"];

/*
 * GAP CONTROL
 *
 * Smaller width = logo and button move closer to PillNav.
 * Larger width = more space around PillNav.
 *
 * Recommended range: 640px to 760px.
 */
const COMPACT_HEADER_WIDTH = 680;

/*
 * TRANSITION SPEED
 *
 * Increase for slower movement.
 * Decrease for faster movement.
 */
const HEADER_TRANSITION_DURATION = 1.1;

const smoothHeaderEase = [0.16, 1, 0.3, 1] as const;

export function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeHref, setActiveHref] = useState("#top");

  const menuRef = useRef<HTMLDivElement | null>(null);

  useFocusTrap(open, menuRef);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 12);
    };

    handleScroll();

    window.addEventListener("scroll", handleScroll, {
      passive: true,
    });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  useEffect(() => {
    if (open) {
      lockScroll();
    } else {
      unlockScroll();
    }

    return () => {
      if (open) {
        unlockScroll();
      }
    };
  }, [open]);

  useEffect(() => {
    const elements = sectionIds
      .map((id) => document.getElementById(id))
      .filter(
        (element): element is HTMLElement =>
          element !== null,
      );

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

        const activeId = [...sectionIds]
          .reverse()
          .find((id) => intersecting.has(id));

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

  const nav =
    (href: string) =>
    (event: MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();

      setOpen(false);
      setActiveHref(href);

      window.setTimeout(() => {
        scrollToHash(href);
      }, 40);
    };

  const handlePillNavigate = (href: string) => {
    setActiveHref(href);
    setOpen(false);
    scrollToHash(href);
  };

  const handleContact = () => {
    setOpen(false);

    window.setTimeout(() => {
      scrollToHash("#contact");
    }, 40);
  };

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-40">
      <div className="container-x flex justify-center pt-3">
        {/* Desktop header */}
        <motion.div
          initial={false}
          animate={{
            maxWidth: scrolled
              ? COMPACT_HEADER_WIDTH
              : 1600,

            paddingLeft: scrolled ? 12 : 0,
            paddingRight: scrolled ? 12 : 0,
            paddingTop: scrolled ? 6 : 0,
            paddingBottom: scrolled ? 6 : 0,

            borderRadius: scrolled ? 999 : 0,

            backgroundColor: scrolled
              ? "rgba(255, 255, 255, 0.52)"
              : "rgba(255, 255, 255, 0)",

            boxShadow: scrolled
              ? "0 12px 38px rgba(0, 0, 0, 0.09)"
              : "0 0 0 rgba(0, 0, 0, 0)",
          }}
          transition={{
            duration: HEADER_TRANSITION_DURATION,
            ease: smoothHeaderEase,
          }}
          style={{
            width: "100%",
            backdropFilter: scrolled
              ? "blur(18px)"
              : "blur(0px)",
            WebkitBackdropFilter: scrolled
              ? "blur(18px)"
              : "blur(0px)",
          }}
          className={[
            "pointer-events-auto",
            "hidden grid-cols-[1fr_auto_1fr]",
            "items-center lg:grid",
            "will-change-[max-width,padding,background-color,box-shadow]",
            "transition-[backdrop-filter]",
            "duration-[1100ms]",
            "ease-[cubic-bezier(0.16,1,0.3,1)]",
          ].join(" ")}
        >
          {/* Desktop logo */}
          <a
            href="#top"
            onClick={nav("#top")}
            className={[
              "group flex shrink-0",
              "items-center justify-self-start",
            ].join(" ")}
            aria-label="ADINN Home"
          >
            <Image
              src="/AdinnLogo.svg"
              alt="ADINN"
              width={130}
              height={42}
              priority
              className={[
                "h-9 w-auto object-contain",
                "transition-transform duration-500",
                "ease-[cubic-bezier(0.16,1,0.3,1)]",
                "group-hover:scale-[1.03]",
              ].join(" ")}
            />
          </a>

          {/* Desktop PillNav */}
          <div className="flex items-center justify-center">
            <PillNav
              items={headerNav}
              activeHref={activeHref}
              onNavigate={handlePillNavigate}
              showLogo={false}
              className="custom-nav"
              ease="power2.easeOut"
              baseColor="#111111"
              pillColor="#ffffff"
              hoveredPillTextColor="#ffffff"
              pillTextColor="#111111"
              initialLoadAnimation={false}
            />
          </div>

          {/* Enquiry button */}
          <div className="flex items-center justify-self-end">
            <BrandButton
              onClick={handleContact}
              className="inline-flex !rounded-full px-5"
              size="md"
            >
              Enquire Now
            </BrandButton>
          </div>
        </motion.div>

        {/* Mobile header */}
        <motion.div
          initial={false}
          animate={{
            paddingLeft: scrolled ? 12 : 0,
            paddingRight: scrolled ? 12 : 0,
            paddingTop: scrolled ? 8 : 4,
            paddingBottom: scrolled ? 8 : 4,

            borderRadius: scrolled ? 18 : 0,

            backgroundColor: scrolled
              ? "rgba(255, 255, 255, 0.55)"
              : "rgba(255, 255, 255, 0)",

            boxShadow: scrolled
              ? "0 8px 28px rgba(0, 0, 0, 0.08)"
              : "0 0 0 rgba(0, 0, 0, 0)",
          }}
          transition={{
            duration: 0.75,
            ease: smoothHeaderEase,
          }}
          style={{
            backdropFilter: scrolled
              ? "blur(18px)"
              : "blur(0px)",
            WebkitBackdropFilter: scrolled
              ? "blur(18px)"
              : "blur(0px)",
          }}
          className={[
            "pointer-events-auto",
            "flex w-full items-center",
            "justify-between lg:hidden",
          ].join(" ")}
        >
          {/* Mobile logo */}
          <a
            href="#top"
            onClick={nav("#top")}
            className="group flex shrink-0 items-center"
            aria-label="ADINN Home"
          >
            <Image
              src="/AdinnLogo.svg"
              alt="ADINN"
              width={120}
              height={40}
              priority
              className="h-9 w-auto object-contain"
            />
          </a>

          <button
            type="button"
            className={[
              "relative inline-flex h-10 w-10",
              "items-center justify-center rounded-full",
              "bg-white text-adinn-ink",
              "shadow-[0_4px_16px_rgba(0,0,0,0.08)]",
              "transition-colors hover:bg-adinn-soft",
            ].join(" ")}
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={18} strokeWidth={1.75} />
          </button>
        </motion.div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={menuRef}
            role="dialog"
            aria-modal="true"
            aria-label="Site menu"
            initial={{
              opacity: 0,
              y: -10,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            exit={{
              opacity: 0,
              y: -10,
            }}
            transition={{
              duration: 0.3,
              ease: smoothHeaderEase,
            }}
            className="pointer-events-auto fixed inset-0 z-50 bg-white"
          >
            <div className="container-x flex h-16 items-center justify-between border-b border-adinn-border">
              <a
                href="#top"
                onClick={nav("#top")}
                aria-label="ADINN Home"
                className="flex items-center"
              >
                <Image
                  src="/AdinnLogo.svg"
                  alt="ADINN"
                  width={120}
                  height={40}
                  className="h-9 w-auto object-contain"
                />
              </a>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className={[
                  "inline-flex h-10 w-10",
                  "items-center justify-center",
                  "rounded-full bg-adinn-soft",
                  "text-adinn-ink transition-colors",
                  "hover:bg-adinn-border",
                ].join(" ")}
                aria-label="Close menu"
              >
                <X size={18} strokeWidth={1.75} />
              </button>
            </div>

            <nav className="container-x mt-4 flex flex-col divide-y divide-adinn-border">
              {mobileNav.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={nav(item.href)}
                  className={[
                    "py-4 text-lg font-medium",
                    "text-adinn-ink transition-colors",
                    "hover:text-adinn-red",
                  ].join(" ")}
                >
                  {item.label}
                </a>
              ))}
            </nav>

            <div className="container-x mt-6">
              <BrandButton
                size="lg"
                onClick={handleContact}
                className="w-full !rounded-full"
              >
                Enquire Now
              </BrandButton>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}