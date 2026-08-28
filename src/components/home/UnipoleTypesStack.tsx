/* eslint-disable @next/next/no-img-element */

"use client";

import { useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

type UnipoleType = {
  number: string;
  eyebrow: string;

  titleLine1: string;
  titleLine2: string;

  badge: string;

  description: string;

  background: string;
  textColor: string;
  mutedColor: string;

  image: string;
  imageAlt: string;
  imagePosition: string;
};

const DECK_PERSPECTIVE_PX = 850;

const unipoleTypes: UnipoleType[] = [
  {
    number: "01",

    eyebrow: "STATIC OUTDOOR",

    titleLine1: "Standard",
    titleLine2: "Unipole",

    badge: "HIGH VISIBILITY",

    description:
      "Large-format static advertising built for long-distance visibility across high-traffic locations.",

    background:
      "radial-gradient(circle at 82% 70%, rgba(73, 66, 69, 0.52) 0%, rgba(32, 34, 36, 0) 39%), linear-gradient(135deg, #181a1c 0%, #111315 55%, #242326 100%)",

    textColor: "#ffffff",

    mutedColor: "#c7c8cc",

    /*
     * Standard outdoor billboard / unipole.
     */
    image:
      "https://images.unsplash.com/photo-1661810058714-a78a003af1b5?auto=format&fit=crop&w=1800&q=88",

    imageAlt:
      "Large roadside outdoor advertising billboard mounted on a tall structure",

    imagePosition: "50% 64%",
  },

  {
    number: "02",

    eyebrow: "DIGITAL OUTDOOR",

    titleLine1: "LED",
    titleLine2: "Unipole",

    badge: "DYNAMIC DISPLAY",

    description:
      "Dynamic high-impact digital displays designed for campaigns that demand movement, brightness and flexibility.",

    background: "linear-gradient(145deg, #ae1f31 0%, #781522 100%)",

    textColor: "#ffffff",

    mutedColor: "#f0cbd1",

    /*
     * Large digital advertising displays.
     */
    image:
      "https://images.unsplash.com/photo-1773578211773-772e80a2254b?auto=format&fit=crop&w=1800&q=88",

    imageAlt:
      "Large digital LED advertising displays in an urban outdoor environment",

    imagePosition: "50% 50%",
  },

  {
    number: "03",

    eyebrow: "CUSTOM FORMAT",

    titleLine1: "Special",
    titleLine2: "Unipole",

    badge: "CUSTOM BUILT",

    description:
      "Custom-engineered outdoor structures created around unique campaign ideas, locations and brand requirements.",

    background: "linear-gradient(145deg, #fd1f64 0%, #c90d46 100%)",

    textColor: "#ffffff",

    mutedColor: "#ffe0ea",

    /*
     * Large custom billboard / structural advertising frame.
     */
    image:
      "https://images.unsplash.com/photo-1585700201969-be9dd4e40aa1?auto=format&fit=crop&w=1800&q=88",

    imageAlt:
      "Large custom outdoor billboard structure supported by a central pole",

    imagePosition: "50% 47%",
  },

  {
    number: "04",

    eyebrow: "BRAND ENVIRONMENT",

    titleLine1: "Special",
    titleLine2: "Signage",

    badge: "BRAND IMPACT",

    description:
      "Distinctive signage solutions that turn structures and spaces into memorable branded experiences.",

    background: "linear-gradient(145deg, #8c031e 0%, #570012 100%)",

    textColor: "#ffffff",

    mutedColor: "#edc5cd",

    /*
     * Physical brand signage.
     */
    image:
      "https://images.unsplash.com/photo-1773609198856-125b83df4439?auto=format&fit=crop&w=1800&q=88",

    imageAlt:
      "Commercial building exterior featuring illuminated brand signage",

    imagePosition: "50% 54%",
  },
];

/* =========================================================
   COMMON CARD DESIGN
   Every card now follows exactly the same structure.
   ========================================================= */

function UnipoleCard({ item }: { item: UnipoleType }) {
  return (
    <div className="relative grid h-full min-h-[420px] grid-cols-1 overflow-hidden lg:grid-cols-[46%_54%]">
      {/* =====================================================
          LEFT SIDE BACKGROUND EFFECTS
         ===================================================== */}

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_58%,rgba(255,255,255,0.045),transparent_34%)]" />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[15%] bg-gradient-to-t from-black/25 to-transparent" />

      {/* =====================================================
          LEFT CONTENT
         ===================================================== */}

      <div
        className="
          relative z-10
          flex h-full flex-col justify-center
          px-6 py-7
          sm:px-9 sm:py-9
          lg:px-[clamp(2.75rem,4.8vw,5.25rem)]
          lg:py-[clamp(2.25rem,4.7vh,4.25rem)]
        "
      >
        <div>
          {/* Eyebrow */}

          <p
  className="
    text-[10px]
    font-normal
    uppercase
    tracking-[0.2em]
    sm:text-[11px]
    lg:text-[12px]
  "
  style={{
    color: item.mutedColor,
  }}
>
  {item.eyebrow}
</p>

          {/* Badge */}

          <span
            className="
              mt-10
              inline-flex
              min-h-10
              items-center
              rounded-[5px]
              bg-white
              px-4
              py-2
              text-[11px]
              font-bold
              uppercase
              tracking-[0.16em]
              text-black
              sm:mt-12
              sm:px-5
              sm:text-xs
              lg:min-h-[42px]
              lg:px-5
            "
          >
            {item.badge}
          </span>

          {/* Title */}

         <h3
  className="
    mt-6
    text-[clamp(3.2rem,7.1vw,7.15rem)]
    font-normal
    leading-[1.20]
    tracking-[-0.065em]
    sm:mt-7
  "
  style={{
    color: item.textColor,
  }}
>
  {item.titleLine1}

  <br />

  {item.titleLine2}
</h3>

          {/* Description */}

          <p
  className="
    mt-5
    max-w-[510px]
    text-sm
    font-regular
    leading-6
    sm:mt-6
    sm:text-base
    sm:leading-7
    lg:text-[clamp(1rem,1.35vw,1.25rem)]
    lg:leading-[1.65]
  "
  style={{
    color: item.mutedColor,
  }}
>
  {item.description}
</p>
        </div>
      </div>

      {/* =====================================================
          RIGHT IMAGE
         ===================================================== */}

      <div className="relative z-10 hidden h-full min-h-0 overflow-hidden lg:block">
        <img
          src={item.image}
          alt={item.imageAlt}
          className="
            absolute
            inset-0
            h-full
            w-full
            object-cover
          "
          style={{
            objectPosition: item.imagePosition,
          }}
          loading={item.number === "01" ? "eager" : "lazy"}
          decoding="async"
        />

        {/*
         * Very small gradient where the photo meets the
         * content area. This avoids a harsh image seam
         * without changing the card structure.
         */}

        <div
          className="
            pointer-events-none
            absolute
            inset-y-0
            left-0
            w-[3%]
            bg-gradient-to-r
            from-black/10
            to-transparent
          "
        />
      </div>
    </div>
  );
}

/* =========================================================
   MAIN SECTION
   ========================================================= */

export default function UnipoleTypesStack() {
  const sectionRef = useRef<HTMLElement | null>(null);

  const headingRef = useRef<HTMLDivElement | null>(null);

  const deckRef = useRef<HTMLDivElement | null>(null);

  const cardsRef = useRef<Array<HTMLElement | null>>([]);

  useLayoutEffect(() => {
    const section = sectionRef.current;
    const deck = deckRef.current;

    if (!section || !deck) {
      return;
    }

    const cards = cardsRef.current.filter(
      (card): card is HTMLElement => card !== null,
    );

    if (!cards.length) {
      return;
    }

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (prefersReducedMotion) {
      return;
    }

    gsap.registerPlugin(ScrollTrigger);

    const context = gsap.context(() => {
      /* =====================================================
         CARD STACK SETTINGS
         ===================================================== */

      const CARD_GAP_PX = 30;

      /*
       * One edge visually opens while scrolling.
       */

      const EXIT_ROTATION_X = 17;

      /*
       * Bottom / near side becomes wider.
       */

      const EXIT_SCALE = 1.20;

      /*
       * Distance the outgoing card moves upward.
       */

      const EXIT_Y_PERCENT = -145;

      /*
       * Scroll length for each card transition.
       */

      const SCROLL_PER_CARD = 1.15;

      /*
       * Pause while card is fully visible.
       */

      const CARD_HOLD = 0.22;

      /* =====================================================
         INITIAL DECK
         ===================================================== */

      gsap.set(deck, {
        isolation: "isolate",
      });

      cards.forEach((card, index) => {
        gsap.set(card, {
          yPercent: 0,

          y: index * CARD_GAP_PX,

          scale: 1,

          rotationX: 0,

          rotationY: 0,

          rotationZ: 0,

          autoAlpha: 1,

          transformOrigin: "50% 100%",

          backfaceVisibility: "hidden",

          force3D: true,
        });
      });

      /* =====================================================
         SCROLL TIMELINE
         ===================================================== */

      const timeline = gsap.timeline({
        defaults: {
          ease: "none",
        },

        scrollTrigger: {
          trigger: section,

          start: "top top",

          end: () =>
            `+=${
              window.innerHeight *
              (cards.length * SCROLL_PER_CARD + 0.8)
            }`,

          pin: true,

          pinSpacing: true,

          scrub: 0.75,

          anticipatePin: 1,

          invalidateOnRefresh: true,

          fastScrollEnd: false,
        },
      });

      /* Small introduction hold */

      timeline.to({}, { duration: 0.18 });

      /* =====================================================
         CARD TRANSITIONS
         ===================================================== */

      for (
        let currentIndex = 0;
        currentIndex < cards.length - 1;
        currentIndex += 1
      ) {
        const currentCard = cards[currentIndex];

        const nextCard = cards[currentIndex + 1];

        const label = `transition-${currentIndex}`;

        timeline.addLabel(label);

        /* ---------------------------------------------------
           CURRENT CARD OPENS + MOVES UP
           --------------------------------------------------- */

        timeline.to(
          currentCard,
          {
            yPercent: EXIT_Y_PERCENT,

            rotationX: EXIT_ROTATION_X,

            scale: EXIT_SCALE,

            duration: 1,
          },

          label,
        );

        /* ---------------------------------------------------
           NEXT CARD SETTLES INTO ACTIVE POSITION
           --------------------------------------------------- */

        timeline.to(
          nextCard,
          {
            yPercent: 0,

            y: 0,

            scale: 1,

            rotationX: 0,

            rotationY: 0,

            rotationZ: 0,

            duration: 1,
          },

          label,
        );

        /* ---------------------------------------------------
           REMAINING CARDS STAY AS STACK
           --------------------------------------------------- */

        cards
          .slice(currentIndex + 2)
          .forEach((waitingCard, waitingIndex) => {
            timeline.to(
              waitingCard,

              {
                y: (waitingIndex + 1) * CARD_GAP_PX,

                duration: 1,
              },

              label,
            );
          });

        /* Resting point */

        timeline.to(
          {},

          {
            duration: CARD_HOLD,
          },
        );
      }

      /* =====================================================
         FINAL CARD HOLD
         ===================================================== */

      timeline.to(
        {},

        {
          duration: 0.35,
        },
      );

      /* =====================================================
         FINAL CARD EXIT
         ===================================================== */

      timeline.to(cards[cards.length - 1], {
        yPercent: EXIT_Y_PERCENT,

        rotationX: EXIT_ROTATION_X,

        scale: EXIT_SCALE,

        duration: 0.85,
      });
    }, section);

    return () => {
      context.revert();
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      id="unipole-types"
      className={[
        "relative min-h-screen overflow-hidden",

        "bg-[#f6f3ef]",

        "px-4 py-8",

        "sm:px-6 sm:py-10",

        "lg:px-10",

        "motion-reduce:overflow-visible",
      ].join(" ")}
    >
      <div
        className="
          mx-auto
          flex
          min-h-[calc(100vh-64px)]
          max-w-[1380px]
          flex-col
        "
      >
        {/* ===================================================
            SECTION HEADING
           =================================================== */}

        <div
          ref={headingRef}
          className="
            flex
            shrink-0
            items-end
            justify-between
            gap-8
            pb-5
            sm:pb-7
          "
        >
          <div className="max-w-3xl">
            {/* <div className="mb-3 flex items-center gap-2.5">
              <span className="h-[7px] w-[7px] rounded-full bg-[#d71920]" />

              <p
                className="
                  text-[10px]
                  font-semibold
                  uppercase
                  tracking-[0.22em]
                  text-[#d71920]
                  sm:text-[11px]
                "
              >
                Adinn Unipole
              </p>
            </div> */}

            <h2
              className="
              mt-20
              mb-10
                max-w-3xl
                text-[clamp(2.15rem,4.7vw,4.8rem)]
                font-medium
                leading-[1.20]
                tracking-[-0.055em]
                text-[#201d1c]
              "
            >
              Types of Unipoles
            </h2>
          </div>
        </div>

        {/* ===================================================
            CARD DECK
           =================================================== */}

        <div
          ref={deckRef}
          className={[
            "relative min-h-0 flex-1",

            "h-[62vh] min-h-[420px]",

            "sm:min-h-[450px]",

            "lg:min-h-[500px]",

            "motion-reduce:h-auto",
          ].join(" ")}
        >
          {unipoleTypes.map((item, index) => {
            return (
              <div
                key={`${item.titleLine1}-${item.titleLine2}`}
                className={[
                  "absolute inset-0",

                  "isolate",

                  "motion-reduce:relative",

                  "motion-reduce:inset-auto",
                ].join(" ")}
                style={{
                  zIndex: unipoleTypes.length - index,

                  perspective: `${DECK_PERSPECTIVE_PX}px`,

                  perspectiveOrigin: "50% 50%",
                }}
              >
                <article
                  ref={(element) => {
                    cardsRef.current[index] = element;
                  }}
                  className={[
                    "relative h-full w-full translate-y-0",

                    "overflow-hidden rounded-[28px]",

                    "sm:rounded-[34px]",

                    "shadow-[0_30px_80px_rgba(38,25,20,0.14)]",

                    "transform-gpu will-change-transform",

                    "motion-reduce:mb-5",

                    "motion-reduce:transform-none",
                  ].join(" ")}
                  style={{
                    background: item.background,
                  }}
                >
                  <UnipoleCard item={item} />
                </article>
              </div>
            );
          })}
        </div>

        {/* ===================================================
            SCROLL HINT
           =================================================== */}

        <div
          className="
            flex
            shrink-0
            items-center
            justify-between
            pt-5
            text-[10px]
            font-medium
            uppercase
            tracking-[0.18em]
            text-[#8c8581]
            sm:pt-6
          "
        >
    

          
        </div>
      </div>
    </section>
  );
}