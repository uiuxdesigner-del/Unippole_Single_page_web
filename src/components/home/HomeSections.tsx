"use client";

import Image from "next/image";

import {
  motion,
  useReducedMotion,
} from "framer-motion";

import {
  ArrowRight,
  Briefcase,
  Building2,
  Car,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Compass,
  Eye,
  Film,
  Gem,
  GraduationCap,
  HeartPulse,
  Landmark,
  Layers,
  MapPin,
  Maximize2,
  MessageCircle,
  ShoppingBasket,
  Sparkles,
  Store,
  Sun,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import ScrollFloat from "@/components/text/ScrollFloat";
import { BrandButton } from "@/components/ui/BrandButton";
import Silk from "@/components/ui/Silk";
import { useCampaignPlan } from "@/context/CampaignPlanContext";
import { scrollToHash } from "@/hooks/useLenis";

import styles from "./HeroSection.module.css";

export function HeroSection() {
  const reducedMotion = useReducedMotion();
  const { open } = useCampaignPlan();

  const heroRef = useRef<HTMLElement | null>(null);
  const silkRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  const reveal = reducedMotion
    ? {}
    : {
        initial: {
          opacity: 0,
          y: 20,
        },
        animate: {
          opacity: 1,
          y: 0,
        },
      };

  useEffect(() => {
    const hero = heroRef.current;
    const silk = silkRef.current;
    const content = contentRef.current;

    if (!hero || !silk || !content || reducedMotion) {
      return;
    }

    gsap.registerPlugin(ScrollTrigger);

    const context = gsap.context(() => {
      /*
       * Background moves more slowly than the page,
       * creating the smooth parallax effect.
       */
      gsap.fromTo(
        silk,
        {
          yPercent: -4,
          scale: 1.06,
        },
        {
          yPercent: 14,
          scale: 1.12,
          ease: "none",
          scrollTrigger: {
            trigger: hero,
            start: "top top",
            end: "bottom top",
            scrub: 1.5,
            invalidateOnRefresh: true,
          },
        },
      );

      /*
       * Hero text moves slightly upward while scrolling.
       */
      gsap.fromTo(
        content,
        {
          yPercent: 0,
        },
        {
          yPercent: -9,
          ease: "none",
          scrollTrigger: {
            trigger: hero,
            start: "top top",
            end: "bottom top",
            scrub: 1.5,
            invalidateOnRefresh: true,
          },
        },
      );
    }, hero);

    return () => {
      context.revert();
    };
  }, [reducedMotion]);

  return (
    <section
      ref={heroRef}
      className={styles.hero}
      aria-labelledby="hero-title"
    >
      {/* Silk animated background */}
      <div
        ref={silkRef}
        className={styles.silkBackground}
        aria-hidden="true"
      >
        <Silk
          speed={5}
          scale={1}
          color="#b83f52"
          noiseIntensity={1.5}
          rotation={0}
        />
      </div>

      <div className={styles.scrim} aria-hidden="true" />

      <div
        ref={contentRef}
        className={styles.content}
      >
        <motion.span
          {...reveal}
          transition={{
            duration: 0.55,
            delay: 0.1,
          }}
          className={styles.badge}
        >
          <strong>NEW</strong>

          <span
            className={styles.badgeDivider}
            aria-hidden="true"
          />

          Premium outdoor visibility
        </motion.span>
        <ScrollFloat
          id="hero-title"
          containerClassName={styles.title}
          textClassName={styles.titleText}
          animationDuration={0.9}
          ease="power3.out"
          stagger={0.018}
          playOnMount
        >
          One pole. Maximum brand visibility.
        </ScrollFloat>

        <motion.div
          {...reveal}
          transition={{
            duration: 0.6,
            delay: 0.4,
          }}
          className={styles.actions}
        >
          <BrandButton
            variant="secondary"
            size="lg"
            className={styles.primaryButton}
            onClick={() => scrollToHash("#inventory")}
          >
            Explore Sites

            <ArrowRight
              size={17}
              strokeWidth={1.8}
            />
          </BrandButton>

          <button
            type="button"
            className={styles.secondaryButton}
            onClick={open}
          >
            Plan Campaign
          </button>
        </motion.div>
      </div>

      <div
        className={styles.vignette}
        aria-hidden="true"
      />
    </section>
  );
}

const whatIsFeatures = [
  { icon: Layers, label: "Single-pole design" },
  { icon: Maximize2, label: "Large creative format" },
  { icon: Eye, label: "Long-distance visibility" },
  { icon: Sun, label: "Illuminated & non-illuminated" },
];

export function WhatIsUnipoleSection() {
  const reducedMotion = useReducedMotion();

  const features = [
    {
      id: "structure",
      title: "Single Pole Structure",
      summary: "Strong, sturdy and space-efficient design.",
      description:
        "Built around a single engineered steel pole, a unipole creates a clean roadside presence while securely supporting a large-format advertising display.",
      icon: Layers,
    },
    {
      id: "visibility",
      title: "Maximum Visibility",
      summary: "High impact across long viewing distances.",
      description:
        "Its elevated position and large creative area help brands remain visible to approaching traffic across highways, junctions and busy urban corridors.",
      icon: Eye,
    },
    {
      id: "locations",
      title: "Strategic Locations",
      summary: "Present at key junctions and busy routes.",
      description:
        "Unipoles are positioned along major roads, commercial areas and high-traffic junctions where audience movement and brand exposure are strongest.",
      icon: MapPin,
    },
  ];

  const [activeFeatureId, setActiveFeatureId] = useState(
    features[0].id,
  );

  const activeFeature =
    features.find(
      (feature) => feature.id === activeFeatureId,
    ) ?? features[0];

  return (
    <section
      id="about"
      className="overflow-hidden bg-white py-20 md:py-28 lg:py-32"
      aria-labelledby="about-unipole-title"
    >
      <div className="container-x">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)] lg:gap-16 xl:gap-24">
          {/* Left content */}
          <div className="mx-auto w-full max-w-[580px] lg:mx-0">
            <h2
              id="about-unipole-title"
              className="text-[clamp(2.75rem,4.5vw,4.75rem)] font-regular leading-[0.98] tracking-[-0.045em] text-neutral-950"
            >
              About Unipole
            </h2>

            {/* Dynamic description */}
            <div className="mt-7 min-h-[145px] max-w-[550px] sm:min-h-[120px]">
              <motion.p
                key={activeFeature.id}
                initial={
                  reducedMotion
                    ? false
                    : {
                        opacity: 0,
                        y: 10,
                        filter: "blur(4px)",
                      }
                }
                animate={{
                  opacity: 1,
                  y: 0,
                  filter: "blur(0px)",
                }}
                transition={{
                  duration: reducedMotion ? 0 : 0.42,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="text-base leading-[1.75] text-neutral-600 md:text-lg"
              >
                {activeFeature.description}
              </motion.p>
            </div>

            {/* Interactive features */}
            <div className="mt-5 border-t border-neutral-200">
              {features.map((feature) => {
                const Icon = feature.icon;
                const isActive =
                  activeFeatureId === feature.id;

                return (
                  <motion.button
                    key={feature.id}
                    type="button"
                    aria-pressed={isActive}
                    onMouseEnter={() =>
                      setActiveFeatureId(feature.id)
                    }
                    onFocus={() =>
                      setActiveFeatureId(feature.id)
                    }
                    onClick={() =>
                      setActiveFeatureId(feature.id)
                    }
                    animate={{
                      x:
                        isActive && !reducedMotion
                          ? 4
                          : 0,
                    }}
                    transition={{
                      duration: reducedMotion ? 0 : 0.36,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    className="group flex w-full items-center gap-4 border-b border-neutral-200 py-5 text-left outline-none focus-visible:ring-2 focus-visible:ring-adinn-red/30 focus-visible:ring-offset-4"
                  >
                    <span
                      className={[
                        "flex h-12 w-12 shrink-0 items-center justify-center rounded-full",
                        "transition-colors duration-300",
                        isActive
                          ? "bg-red-50 text-adinn-red"
                          : "bg-neutral-100 text-neutral-700 group-hover:bg-red-50 group-hover:text-adinn-red",
                      ].join(" ")}
                    >
                      <Icon
                        size={22}
                        strokeWidth={1.6}
                        aria-hidden="true"
                      />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block text-base font-semibold tracking-[-0.015em] text-neutral-950 md:text-lg">
                        {feature.title}
                      </span>

                      <span className="mt-1 block text-sm leading-relaxed text-neutral-500 md:text-base">
                        {feature.summary}
                      </span>
                    </span>

                    <motion.span
                      aria-hidden="true"
                      animate={{
                        width: isActive ? 26 : 0,
                        opacity: isActive ? 1 : 0,
                      }}
                      transition={{
                        duration: reducedMotion ? 0 : 0.36,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                      className="hidden h-px shrink-0 bg-adinn-red sm:block"
                    />
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Right image */}
          <motion.div
            initial={
              reducedMotion
                ? false
                : {
                    opacity: 0,
                    y: 24,
                    scale: 0.985,
                  }
            }
            whileInView={{
              opacity: 1,
              y: 0,
              scale: 1,
            }}
            viewport={{
              once: true,
              amount: 0.2,
            }}
            transition={{
              duration: reducedMotion ? 0 : 0.8,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="relative aspect-[16/11] overflow-hidden rounded-[26px] bg-neutral-100 lg:aspect-[4/5] xl:aspect-[5/6]"
          >
            <Image
              src="/images/unipole-about.jpg"
              alt="Large unipole advertising structure positioned above a busy urban road"
              fill
              sizes="(min-width: 1024px) 55vw, 100vw"
              className="object-cover"
            />

            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent"
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

const benefits = [
  {
    n: "01",
    icon: Eye,
    title: "High Visibility",
    description:
      "Elevated positioning and large-format displays help brands remain visible from longer distances.",
  },
  {
    n: "02",
    icon: MapPin,
    title: "Strategic Placement",
    description:
      "Locations are selected across key roads, junctions, commercial areas and high-traffic corridors.",
  },
  {
    n: "03",
    icon: Sparkles,
    title: "Strong Brand Recall",
    description:
      "Repeated exposure helps campaigns remain familiar to daily commuters and local audiences.",
  },
  {
    n: "04",
    icon: Sun,
    title: "Day and Night Presence",
    description:
      "Illuminated options maintain campaign visibility beyond daylight hours.",
  },
  {
    n: "05",
    icon: Maximize2,
    title: "Large Creative Impact",
    description:
      "Generous display formats provide space for bold, focused and readable brand communication.",
  },
  {
    n: "06",
    icon: Layers,
    title: "Flexible Campaign Planning",
    description:
      "Locations can be shortlisted according to city, area, size, illumination and availability.",
  },
];

const benefitImages = [
  {
    src: "/images/high-visibility.jpg",
    alt: "Unipole advertising display visible above a busy city road",
  },
  {
    src: "/images/strategic-placement.jpg",
    alt: "Unipole advertising structure positioned at an important city junction",
  },
  {
    src: "/images/brand-recall.jpg",
    alt: "Large unipole advertisement seen by daily city commuters",
  },
  {
    src: "/images/day-night-presence.jpg",
    alt: "Illuminated unipole advertising display beside a road at night",
  },
  {
    src: "/images/creative-impact.jpg",
    alt: "Large-format unipole carrying a bold advertising creative",
  },
  {
    src: "/images/campaign-planning.jpg",
    alt: "Unipole advertising site selected for an outdoor campaign",
  },
];

/*
 * EASY SIZE CONTROLS
 *
 * cardWidth: changes only the card width.
 * imageHeight: changes only the image height.
 * gap: changes only the gap between cards.
 * textMinHeight: keeps the text rows aligned.
 */
const WHY_CARD_DIMENSIONS = {
  extraLargeDesktop: {
    cardWidth: 520,
    imageHeight: 360,
    gap: 24,
    minimumSidePeek: 110,
    textMinHeight: 130,
  },
  largeDesktop: {
    cardWidth: 460,
    imageHeight: 320,
    gap: 24,
    minimumSidePeek: 80,
    textMinHeight: 135,
  },
  desktop: {
    cardWidth: 390,
    imageHeight: 285,
    gap: 20,
    minimumSidePeek: 54,
    textMinHeight: 145,
  },
  tablet: {
    widthRatio: 0.76,
    maximumWidth: 620,
    imageHeight: 300,
    gap: 20,
    textMinHeight: 140,
  },
  smallTablet: {
    widthRatio: 0.84,
    maximumWidth: 540,
    imageHeight: 270,
    gap: 18,
    textMinHeight: 145,
  },
  mobile: {
    sidePadding: 22,
    imageHeight: 220,
    gap: 14,
    textMinHeight: 150,
  },
} as const;

type WhyCarouselLayout = {
  cardWidth: number;
  imageHeight: number;
  textMinHeight: number;
  gap: number;
  peek: number;
};

export function WhyChooseSection() {
  const reducedMotion = useReducedMotion();
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const [currentIndex, setCurrentIndex] = useState(2);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animateTrack, setAnimateTrack] = useState(true);
  const [layout, setLayout] = useState<WhyCarouselLayout>({
    cardWidth: 0,
    imageHeight: 0,
    textMinHeight: 0,
    gap: 24,
    peek: 0,
  });

  const cards = useMemo(
    () =>
      benefits.map((benefit, index) => ({
        ...benefit,
        image: benefitImages[index]?.src ?? benefitImages[0].src,
        imageAlt: benefitImages[index]?.alt ?? benefitImages[0].alt,
      })),
    [],
  );

  const slides = useMemo(() => {
    const total = cards.length;

    const originalSlides = cards.map((card, index) => ({
      card,
      key: `original-${index}`,
    }));

    return [
      {
        card: cards[total - 2],
        key: "clone-before-2",
      },
      {
        card: cards[total - 1],
        key: "clone-before-1",
      },
      ...originalSlides,
      {
        card: cards[0],
        key: "clone-after-1",
      },
      {
        card: cards[1],
        key: "clone-after-2",
      },
    ];
  }, [cards]);

  useEffect(() => {
    const viewport = viewportRef.current;

    if (!viewport) return;

    const updateLayout = () => {
      const viewportWidth = viewport.clientWidth;

      if (viewportWidth >= 1600) {
        const config = WHY_CARD_DIMENSIONS.extraLargeDesktop;
        const maximumCardWidth =
          (viewportWidth - config.gap - config.minimumSidePeek * 2) / 2;
        const cardWidth = Math.min(config.cardWidth, maximumCardWidth);
        const peek = (viewportWidth - cardWidth * 2 - config.gap) / 2;

        setLayout({
          cardWidth,
          imageHeight: config.imageHeight,
          textMinHeight: config.textMinHeight,
          gap: config.gap,
          peek,
        });
        return;
      }

      if (viewportWidth >= 1280) {
        const config = WHY_CARD_DIMENSIONS.largeDesktop;
        const maximumCardWidth =
          (viewportWidth - config.gap - config.minimumSidePeek * 2) / 2;
        const cardWidth = Math.min(config.cardWidth, maximumCardWidth);
        const peek = (viewportWidth - cardWidth * 2 - config.gap) / 2;

        setLayout({
          cardWidth,
          imageHeight: config.imageHeight,
          textMinHeight: config.textMinHeight,
          gap: config.gap,
          peek,
        });
        return;
      }

      if (viewportWidth >= 1024) {
        const config = WHY_CARD_DIMENSIONS.desktop;
        const maximumCardWidth =
          (viewportWidth - config.gap - config.minimumSidePeek * 2) / 2;
        const cardWidth = Math.min(config.cardWidth, maximumCardWidth);
        const peek = (viewportWidth - cardWidth * 2 - config.gap) / 2;

        setLayout({
          cardWidth,
          imageHeight: config.imageHeight,
          textMinHeight: config.textMinHeight,
          gap: config.gap,
          peek,
        });
        return;
      }

      if (viewportWidth >= 768) {
        const config = WHY_CARD_DIMENSIONS.tablet;
        const cardWidth = Math.min(
          viewportWidth * config.widthRatio,
          config.maximumWidth,
        );
        const peek = (viewportWidth - cardWidth) / 2;

        setLayout({
          cardWidth,
          imageHeight: config.imageHeight,
          textMinHeight: config.textMinHeight,
          gap: config.gap,
          peek,
        });
        return;
      }

      if (viewportWidth >= 640) {
        const config = WHY_CARD_DIMENSIONS.smallTablet;
        const cardWidth = Math.min(
          viewportWidth * config.widthRatio,
          config.maximumWidth,
        );
        const peek = (viewportWidth - cardWidth) / 2;

        setLayout({
          cardWidth,
          imageHeight: config.imageHeight,
          textMinHeight: config.textMinHeight,
          gap: config.gap,
          peek,
        });
        return;
      }

      const config = WHY_CARD_DIMENSIONS.mobile;
      const cardWidth = Math.max(240, viewportWidth - config.sidePadding * 2);
      const responsiveImageHeight = Math.min(
        config.imageHeight,
        Math.max(190, viewportWidth * 0.62),
      );
      const peek = (viewportWidth - cardWidth) / 2;

      setLayout({
        cardWidth,
        imageHeight: responsiveImageHeight,
        textMinHeight: config.textMinHeight,
        gap: config.gap,
        peek,
      });
    };

    updateLayout();

    const resizeObserver = new ResizeObserver(updateLayout);
    resizeObserver.observe(viewport);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  const activeIndex =
    ((currentIndex - 2) % cards.length + cards.length) % cards.length;

  const slideStep = layout.cardWidth + layout.gap;
  const trackX = layout.peek - currentIndex * slideStep;
  const fadeWidth = Math.min(Math.max(layout.peek * 0.6, 72), 190);

  const moveTo = (index: number) => {
    if (isAnimating || layout.cardWidth === 0) return;

    setAnimateTrack(true);
    setIsAnimating(true);
    setCurrentIndex(index);
  };

  const showPrevious = () => {
    moveTo(currentIndex - 1);
  };

  const showNext = () => {
    moveTo(currentIndex + 1);
  };

  const handleAnimationComplete = () => {
    if (!isAnimating) return;

    const firstOriginalIndex = 2;
    const lastOriginalIndex = firstOriginalIndex + cards.length - 1;
    const firstTrailingCloneIndex = firstOriginalIndex + cards.length;

    let resetIndex: number | null = null;

    if (currentIndex >= firstTrailingCloneIndex) {
      resetIndex = firstOriginalIndex;
    } else if (currentIndex < firstOriginalIndex) {
      resetIndex = lastOriginalIndex;
    }

    setIsAnimating(false);

    if (resetIndex === null) return;

    setAnimateTrack(false);
    setCurrentIndex(resetIndex);

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        setAnimateTrack(true);
      });
    });
  };

  const goToSlide = (index: number) => {
    if (index === activeIndex) return;
    moveTo(index + 2);
  };

  return (
    <section
      id="why"
      className="overflow-hidden bg-white py-20 md:py-24 lg:py-28"
      aria-labelledby="why-unipole-title"
    >
      <div className="relative mx-auto max-w-[1500px] px-5 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-[900px] text-center">
          <p className="text-[clamp(1.25rem,1.8vw,1.8rem)] font-semibold leading-tight tracking-[-0.025em] text-neutral-950">
            Why Choose
          </p>

          <h2
            id="why-unipole-title"
            className="mt-2 text-[clamp(2.35rem,3.8vw,3.75rem)] font-regular leading-[1] tracking-[-0.045em] text-neutral-950"
          >
            UNIPOLE Advertising
          </h2>
        </div>

        <div className="absolute bottom-0 right-5 hidden items-center gap-1 md:flex sm:right-8 lg:right-12">
          <button
            type="button"
            onClick={showPrevious}
            disabled={isAnimating}
            aria-label="Show previous benefit"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-neutral-800 transition-all duration-300 hover:bg-neutral-100 hover:text-black active:scale-95 disabled:pointer-events-none disabled:opacity-40"
          >
            <ChevronLeft size={28} strokeWidth={1.35} />
          </button>

          <button
            type="button"
            onClick={showNext}
            disabled={isAnimating}
            aria-label="Show next benefit"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-neutral-800 transition-all duration-300 hover:bg-neutral-100 hover:text-black active:scale-95 disabled:pointer-events-none disabled:opacity-40"
          >
            <ChevronRight size={28} strokeWidth={1.35} />
          </button>
        </div>
      </div>

      <div
        ref={viewportRef}
        role="region"
        aria-roledescription="carousel"
        aria-label="Why choose UNIPOLE advertising"
        className="relative mt-14 w-full overflow-hidden md:mt-16"
      >
        <motion.div
          initial={false}
          animate={{
            x: layout.cardWidth > 0 ? trackX : 0,
            opacity: layout.cardWidth > 0 ? 1 : 0,
          }}
          transition={
            animateTrack && !reducedMotion
              ? {
                  x: {
                    duration: 0.85,
                    ease: [0.65, 0, 0.35, 1],
                  },
                  opacity: {
                    duration: 0.25,
                  },
                }
              : {
                  duration: 0,
                }
          }
          onAnimationComplete={handleAnimationComplete}
          className="flex items-stretch will-change-transform"
          style={{
            gap: `${layout.gap}px`,
          }}
        >
          {slides.map((slide) => (
            <article
              key={slide.key}
              className="flex shrink-0 flex-col"
              style={{
                width: `${layout.cardWidth}px`,
              }}
            >
              <div
                className="group relative w-full shrink-0 overflow-hidden rounded-[24px] bg-neutral-200 sm:rounded-[28px]"
                style={{
                  height: `${layout.imageHeight}px`,
                }}
              >
                <Image
                  src={slide.card.image}
                  alt={slide.card.imageAlt}
                  fill
                  sizes="(min-width: 1600px) 520px, (min-width: 1280px) 460px, (min-width: 1024px) 390px, (min-width: 768px) 76vw, (min-width: 640px) 84vw, calc(100vw - 44px)"
                  className="object-cover object-center transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.025]"
                />
              </div>

              <div
                className="flex flex-col pt-5 sm:pt-6"
                style={{
                  minHeight: `${layout.textMinHeight}px`,
                }}
              >
                <h3 className="text-[18px] font-regular leading-tight tracking-[-0.025em] text-neutral-950 sm:text-[20px] lg:text-[22px] 2xl:text-[24px]">
  {slide.card.title}
</h3>

                <p className="mt-2 max-w-[620px] text-[15px] leading-[1.55] text-neutral-600 sm:text-base md:text-[17px]">
                  {slide.card.description}
                </p>
              </div>
            </article>
          ))}
        </motion.div>

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 z-10 hidden bg-gradient-to-r from-white via-white/75 to-transparent lg:block"
          style={{
            width: `${fadeWidth}px`,
          }}
        />

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 z-10 hidden bg-gradient-to-l from-white via-white/75 to-transparent lg:block"
          style={{
            width: `${fadeWidth}px`,
          }}
        />
      </div>

      <div className="mt-7 flex items-center justify-center gap-3 md:hidden">
        <button
          type="button"
          onClick={showPrevious}
          disabled={isAnimating}
          aria-label="Show previous benefit"
          className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-neutral-100 text-neutral-900 transition-transform duration-300 active:scale-95 disabled:opacity-40"
        >
          <ChevronLeft size={24} strokeWidth={1.5} />
        </button>

        <button
          type="button"
          onClick={showNext}
          disabled={isAnimating}
          aria-label="Show next benefit"
          className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-neutral-100 text-neutral-900 transition-transform duration-300 active:scale-95 disabled:opacity-40"
        >
          <ChevronRight size={24} strokeWidth={1.5} />
        </button>
      </div>

      <div
        className="mt-8 flex items-center justify-center gap-3 md:mt-10"
        aria-label="Select carousel slide"
      >
        {cards.map((card, index) => {
          const isActive = activeIndex === index;

          return (
            <button
              key={card.title}
              type="button"
              onClick={() => goToSlide(index)}
              aria-label={`Show ${card.title}`}
              aria-current={isActive ? "true" : undefined}
              className={[
                "h-2.5 w-2.5 rounded-full",
                "transition-all duration-500 ease-in-out",
                isActive
                  ? "scale-110 bg-neutral-950"
                  : "bg-neutral-300 hover:bg-neutral-500",
              ].join(" ")}
            />
          );
        })}
      </div>

      <p aria-live="polite" className="sr-only">
        Showing {cards[activeIndex].title}
      </p>
    </section>
  );
}

const KEY_CITIES = ["Chennai", "Madurai", "Coimbatore", "Bengaluru", "Hyderabad", "Kochi"] as const;
const LOCATION_TYPES = ["Major Road", "Junction", "Highway", "Commercial District", "Transit Corridor"] as const;
const CITY_COORDS: Record<(typeof KEY_CITIES)[number], { x: number; y: number }> = {
  Chennai: { x: 340, y: 300 },
  Madurai: { x: 260, y: 380 },
  Coimbatore: { x: 200, y: 320 },
  Bengaluru: { x: 220, y: 250 },
  Hyderabad: { x: 230, y: 130 },
  Kochi: { x: 150, y: 380 },
};


const groundSteps = [
  {
    title: "Site Identification",
    description:
      "Evaluating placement, sight-lines, traffic patterns and audience relevance.",
  },
  {
    title: "Structural Planning",
    description:
      "Detailed engineering plans reviewed for structural integrity and permits.",
  },
  {
    title: "Foundation Preparation",
    description:
      "Ground preparation with reinforced foundation for long-term stability.",
  },
  {
    title: "Pole Installation",
    description:
      "Precision installation of the primary steel pole to the required elevation.",
  },
  {
    title: "Display Frame Setup",
    description: "Assembly of the display frame at the correct height and orientation.",
  },
  {
    title: "Electrical and Lighting",
    description:
      "Wiring, illumination fixtures and safety systems installed as per specification.",
  },
  {
    title: "Campaign Mounting",
    description:
      "Campaign creative mounted and aligned for clean, readable presentation.",
  },
  {
    title: "Final Inspection",
    description: "Final inspection for structural, visual and compliance readiness.",
  },
];

export function GroundToSkySection() {
  return (
    <section className="bg-white py-20 md:py-28">
      <div className="container-x">
        <div className="max-w-2xl">
          <span className="text-xs font-medium uppercase tracking-[0.25em] text-adinn-red">
            From Ground to Sky
          </span>
          <h2 className="mt-3 text-h2 text-adinn-ink">The installation journey.</h2>
        </div>

        <ol className="relative mt-12 space-y-8 border-l border-adinn-border pl-8">
          {groundSteps.map((step, index) => (
            <li key={step.title} className="relative">
              <span className="absolute -left-[41px] top-0 grid h-6 w-6 place-items-center rounded-full border border-adinn-border bg-white text-[11px] font-semibold text-adinn-ink">
                {index + 1}
              </span>
              <h3 className="text-lg font-semibold text-adinn-ink">{step.title}</h3>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-adinn-ink-2">
                {step.description}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

const growthItems = [
  {
    title: "Strategic Location",
    description: "Sites selected where relevant audiences naturally travel.",
  },
  {
    title: "Campaign Visibility",
    description:
      "Large-format communication designed to remain visible during daily travel.",
  },
  {
    title: "Repeated Exposure",
    description:
      "Consistent roadside presence helps build familiarity over time.",
  },
  {
    title: "Brand Recall",
    description:
      "Repeated visibility supports stronger recognition across campaign periods.",
  },
  {
    title: "Customer Consideration",
    description:
      "Familiar brands are more likely to enter the audience consideration set.",
  },
  {
    title: "Business Enquiry",
    description:
      "Interested audiences can respond through the brand's available channels.",
  },
];

export function BusinessGrowthSection() {
  return (
    <section className="bg-adinn-warm py-20 md:py-28">
      <div className="container-x">
        <div className="max-w-2xl">
          <span className="text-xs font-medium uppercase tracking-[0.25em] text-adinn-red">
            Business Growth Journey
          </span>

          <h2 className="mt-3 text-h2 text-adinn-ink">
            How outdoor presence supports growth.
          </h2>
        </div>

        <div className="mt-12 grid gap-x-8 gap-y-10 md:grid-cols-2 lg:grid-cols-3">
          {growthItems.map((item, index) => (
            <article
              key={item.title}
              className="border-t border-adinn-border pt-6"
            >
              <span className="text-xs tracking-widest text-adinn-muted">
                {String(index + 1).padStart(2, "0")}
              </span>

              <h3 className="mt-2 text-lg font-semibold text-adinn-ink">
                {item.title}
              </h3>

              <p className="mt-2 text-sm leading-relaxed text-adinn-ink-2">
                {item.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

const industries = [
  { title: "Real Estate", icon: Building2 },
  { title: "Retail", icon: Store },
  { title: "Jewellery", icon: Gem },
  { title: "Healthcare", icon: HeartPulse },
  { title: "Education", icon: GraduationCap },
  { title: "Automobile", icon: Car },
  { title: "FMCG", icon: ShoppingBasket },
  { title: "Banking & Finance", icon: Landmark },
  { title: "Entertainment", icon: Film },
  { title: "Corporate Branding", icon: Briefcase },
];

export function IndustriesSection() {
  return (
    <section className="bg-adinn-warm py-20 md:py-28">
      <div className="container-x">
        <div className="max-w-2xl">
          <span className="text-xs font-medium uppercase tracking-[0.25em] text-adinn-red">
            Industries Served
          </span>
          <h2 className="mt-3 text-h2 text-adinn-ink">
            Trusted across every category that needs visibility.
          </h2>
        </div>

        <ul className="mt-12 grid gap-x-8 sm:grid-cols-2 lg:grid-cols-2">
          {industries.map((industry) => (
            <li
              key={industry.title}
              className="flex items-center gap-4 border-t border-adinn-border py-5"
            >
              <industry.icon size={20} strokeWidth={1.5} className="text-adinn-ink" />
              <span className="text-base font-medium text-adinn-ink">{industry.title}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const howItWorksSteps = [
  {
    title: "Explore Locations",
    description: "Browse curated inventory across cities, sizes and illumination.",
    icon: Compass,
  },
  {
    title: "Review Site Details",
    description: "Check specifications, audience profile and tentative availability.",
    icon: Eye,
  },
  {
    title: "Build Campaign Plan",
    description: "Shortlist locations that fit your campaign strategy.",
    icon: ClipboardList,
  },
  {
    title: "Request Proposal",
    description: "Share your plan and receive a tailored proposal from our team.",
    icon: MessageCircle,
  },
];


const faqs = [
  {
    question: "What is UNIPOLE advertising?",
    answer:
      "UNIPOLE advertising uses a large-format outdoor display supported by a single steel pole, typically installed along high-traffic roads and commercial areas.",
  },
  {
    question: "Where are ADINN UNIPOLES available?",
    answer:
      "Sites are curated across Chennai, Madurai, Coimbatore, Bengaluru, Hyderabad and Kochi, with more locations added over time.",
  },
  {
    question: "How do I check availability?",
    answer:
      "Use the inventory filters to view sites by city, area, size, illumination and status. Availability shown is indicative — final confirmation is done by our team.",
  },
  {
    question: "Is adding a site to the campaign plan a booking?",
    answer:
      "No. The campaign plan is a personal shortlist to help you request a proposal. It does not reserve or hold the site.",
  },
  {
    question: "How is pricing calculated?",
    answer:
      "Pricing depends on city, location, size, illumination, campaign duration and season. We share transparent pricing once we understand your requirement.",
  },
  {
    question: "Are illuminated sites available?",
    answer:
      "Yes. Front-lit, back-lit and non-illuminated options are available depending on the site.",
  },
  {
    question: "Can ADINN support printing and mounting?",
    answer:
      "Yes. We can help with creative production, printing and mounting through our operations team.",
  },
  {
    question: "How can I schedule a site visit?",
    answer:
      "Request a site visit from the site details or the enquiry form and our team will coordinate.",
  },
  {
    question: "Can I request multiple sites together?",
    answer: "Yes. Add multiple sites to your campaign plan and request a combined proposal.",
  },
  {
    question: "How long should a campaign run?",
    answer:
      "Most sites have a minimum campaign duration. Longer durations typically improve recall and cost efficiency.",
  },
];

export function FaqSection() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="bg-adinn-warm py-20 md:py-28">
      <div className="container-x grid gap-12 lg:grid-cols-[1fr_2fr] lg:gap-16">
        <div className="self-start lg:sticky lg:top-24">
          <span className="text-xs font-medium uppercase tracking-[0.25em] text-adinn-red">
            FAQ
          </span>
          <h2 className="mt-3 text-h2 text-adinn-ink">Answers to common questions.</h2>
        </div>

        <ul className="border-t border-adinn-border">
          {faqs.map((faq, index) => {
            const isOpen = open === index;
            return (
              <li key={faq.question} className="border-b border-adinn-border">
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : index)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-6 py-5 text-left"
                >
                  <span className="text-base font-medium text-adinn-ink md:text-lg">
                    {faq.question}
                  </span>
                  <ChevronDown
                    size={18}
                    strokeWidth={1.75}
                    className={`shrink-0 text-adinn-ink-2 transition-transform ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="pb-6 pr-10 text-sm leading-relaxed text-adinn-ink-2">
                    {faq.answer}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}