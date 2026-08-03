"use client";

import Image from "next/image";
import {
  Facebook,
  Instagram,
  Linkedin,
  Youtube,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  PointerEvent as ReactPointerEvent,
} from "react";

type Point = {
  x: number;
  y: number;
};

type FooterLocation = {
  city: string;
  address: string;
};

const ROBOTO_FLEX_URL =
  "https://fonts.googleapis.com/css2?family=Roboto+Flex:opsz,wdth,wght@8..144,25..151,100..1000&display=swap";

const LOCATIONS: FooterLocation[] = [
  {
    city: "Madurai",
    address:
      "29, 1st Cross Street, Vanamamalai Nagar, By-pass Road – 625010.",
  },
  {
    city: "Chennai",
    address:
      "19/43, MG Chakrapani Street, Sathya Garden, Saligramam – 600092.",
  },
  {
    city: "Bangalore",
    address:
      "24, 2nd Floor, 9th A Cross Road, Wilson Garden – 560027.",
  },
  {
    city: "Coimbatore",
    address:
      "13, Sivasakthi Colony, Ganapathy – 641006.",
  },
];

const clamp = (
  value: number,
  minimum: number,
  maximum: number,
) => Math.min(maximum, Math.max(minimum, value));

const lerp = (
  from: number,
  to: number,
  amount: number,
) => from + (to - from) * amount;

function TextPressure({
  text = "ADINN UNIPOLE",
}: {
  text?: string;
}) {
  const containerRef =
    useRef<HTMLDivElement | null>(null);

  const titleRef =
    useRef<HTMLDivElement | null>(null);

  const characterRefs =
    useRef<Array<HTMLSpanElement | null>>([]);

  const targetPointerRef = useRef<Point>({
    x: 0,
    y: 0,
  });

  const smoothPointerRef = useRef<Point>({
    x: 0,
    y: 0,
  });

  const animationFrameRef =
    useRef<number | null>(null);

  const isVisibleRef = useRef(false);
  const isPointerInsideRef = useRef(false);
  const reducedMotionRef = useRef(false);
  const isPageVisibleRef = useRef(true);

  const [fontSize, setFontSize] =
    useState(44);

  const [scaleY, setScaleY] =
    useState(1);

  const characters = useMemo(
    () => Array.from(text),
    [text],
  );

  const stopAnimation =
    useCallback(() => {
      if (
        animationFrameRef.current !== null
      ) {
        window.cancelAnimationFrame(
          animationFrameRef.current,
        );

        animationFrameRef.current = null;
      }
    }, []);

  const setPointerToCentre =
    useCallback(() => {
      const container =
        containerRef.current;

      if (!container) return;

      targetPointerRef.current = {
        x: container.clientWidth / 2,
        y: container.clientHeight / 2,
      };
    }, []);

  const resetCharacters =
    useCallback(() => {
      characterRefs.current.forEach(
        (character) => {
          if (!character) return;

          character.style.fontVariationSettings =
            "'wght' 800, 'wdth' 100";

          character.style.opacity = "1";
        },
      );
    }, []);

  const updateSize = useCallback(() => {
    const container =
      containerRef.current;

    const title = titleRef.current;

    if (!container || !title) return;

    const containerWidth =
      container.clientWidth;

    const containerHeight =
      container.clientHeight;

    const visibleUnits =
      characters.reduce(
        (total, character) =>
          total +
          (character === " " ? 0.5 : 1),
        0,
      );

    /*
     * This follows the same sizing idea as
     * React Bits, but keeps the full title
     * safely inside the footer.
     */
    const nextFontSize = clamp(
      containerWidth /
        Math.max(
          visibleUnits * 0.52,
          1,
        ),
      34,
      260,
    );

    setFontSize(nextFontSize);
    setScaleY(1);

    window.requestAnimationFrame(() => {
      const currentTitle =
        titleRef.current;

      if (!currentTitle) return;

      const textRect =
        currentTitle.getBoundingClientRect();

      if (textRect.height > 0) {
        const verticalScale = clamp(
          containerHeight /
            textRect.height,
          0.82,
          1.18,
        );

        setScaleY(verticalScale);
      }

      setPointerToCentre();

      if (
        smoothPointerRef.current.x === 0 &&
        smoothPointerRef.current.y === 0
      ) {
        smoothPointerRef.current = {
          ...targetPointerRef.current,
        };
      }
    });
  }, [
    characters,
    setPointerToCentre,
  ]);

  const animate = useCallback(() => {
    animationFrameRef.current = null;

    if (
      !isVisibleRef.current ||
      !isPageVisibleRef.current ||
      reducedMotionRef.current
    ) {
      return;
    }

    const title = titleRef.current;

    if (!title) return;

    const smooth =
      smoothPointerRef.current;

    const target =
      targetPointerRef.current;

    smooth.x = lerp(
      smooth.x,
      target.x,
      0.13,
    );

    smooth.y = lerp(
      smooth.y,
      target.y,
      0.13,
    );

    const titleRect =
      title.getBoundingClientRect();

    const maxDistance =
      Math.max(
        titleRect.width * 0.28,
        170,
      );

    characterRefs.current.forEach(
      (character) => {
        if (!character) return;

        const characterRect =
          character.getBoundingClientRect();

        const centreX =
          characterRect.left -
          titleRect.left +
          characterRect.width / 2;

        const centreY =
          characterRect.top -
          titleRect.top +
          characterRect.height / 2;

        const deltaX =
          smooth.x - centreX;

        const deltaY =
          smooth.y - centreY;

        const distance = Math.sqrt(
          deltaX * deltaX +
            deltaY * deltaY,
        );

        const influence =
          1 -
          clamp(
            distance /
              maxDistance,
            0,
            1,
          );

        const easedInfluence =
          influence *
          influence *
          (3 - 2 * influence);

        /*
         * Real React Bits-style stretch:
         * use the variable font's native
         * width and weight axes.
         */
        const widthAxis = Math.round(
          lerp(
            72,
            126,
            easedInfluence,
          ),
        );

        const weightAxis = Math.round(
          lerp(
            620,
            900,
            easedInfluence,
          ),
        );

        character.style.fontVariationSettings =
          `'wght' ${weightAxis}, 'wdth' ${widthAxis}`;
      },
    );

    const remainingDistance =
      Math.max(
        Math.abs(
          target.x - smooth.x,
        ),
        Math.abs(
          target.y - smooth.y,
        ),
      );

    if (
      isPointerInsideRef.current ||
      remainingDistance > 0.25
    ) {
      animationFrameRef.current =
        window.requestAnimationFrame(
          animate,
        );
    }
  }, []);

  const startAnimation =
    useCallback(() => {
      if (
        animationFrameRef.current !== null ||
        !isVisibleRef.current ||
        !isPageVisibleRef.current ||
        reducedMotionRef.current
      ) {
        return;
      }

      animationFrameRef.current =
        window.requestAnimationFrame(
          animate,
        );
    }, [animate]);

  const updatePointer = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    const title = titleRef.current;

    if (!title) return;

    const bounds =
      title.getBoundingClientRect();

    targetPointerRef.current = {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    };

    startAnimation();
  };

  useEffect(() => {
    const container =
      containerRef.current;

    if (!container) return;

    const mediaQuery =
      window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      );

    const handleReducedMotion = () => {
      reducedMotionRef.current =
        mediaQuery.matches;

      if (mediaQuery.matches) {
        stopAnimation();
        resetCharacters();
      } else {
        updateSize();
        startAnimation();
      }
    };

    handleReducedMotion();

    mediaQuery.addEventListener(
      "change",
      handleReducedMotion,
    );

    const resizeObserver =
      new ResizeObserver(() => {
        updateSize();
      });

    resizeObserver.observe(container);

    const intersectionObserver =
      new IntersectionObserver(
        ([entry]) => {
          isVisibleRef.current =
            entry.isIntersecting;

          if (entry.isIntersecting) {
            updateSize();
            startAnimation();
          } else {
            stopAnimation();
          }
        },
        {
          rootMargin: "120px 0px",
          threshold: 0.01,
        },
      );

    intersectionObserver.observe(
      container,
    );

    const handleVisibilityChange = () => {
      isPageVisibleRef.current =
        !document.hidden;

      if (document.hidden) {
        stopAnimation();
      } else {
        startAnimation();
      }
    };

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange,
    );

    document.fonts?.ready.then(() => {
      updateSize();
      startAnimation();
    });

    updateSize();

    return () => {
      mediaQuery.removeEventListener(
        "change",
        handleReducedMotion,
      );

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );

      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      stopAnimation();
    };
  }, [
    resetCharacters,
    startAnimation,
    stopAnimation,
    updateSize,
  ]);

  return (
    <div
      ref={containerRef}
      aria-label={text}
      className="relative h-full w-full overflow-hidden bg-transparent"
      style={{
        touchAction: "pan-y",
      }}
      onPointerEnter={(event) => {
        isPointerInsideRef.current = true;
        updatePointer(event);
      }}
      onPointerMove={updatePointer}
      onPointerLeave={() => {
        isPointerInsideRef.current =
          false;

        setPointerToCentre();
        startAnimation();
      }}
    >
      <style>{`
        @import url('${ROBOTO_FLEX_URL}');
      `}</style>

      <div
        ref={titleRef}
        className="absolute inset-0 flex items-center justify-between whitespace-nowrap px-[0.8%] uppercase text-[#080808]"
        style={{
          fontFamily:
            "'Roboto Flex', Arial, sans-serif",
          fontSize: `${fontSize}px`,
          lineHeight: 0.78,
          letterSpacing: "-0.055em",
          transform: `scaleY(${scaleY})`,
          transformOrigin:
            "center center",
          fontVariationSettings:
            "'wght' 800, 'wdth' 100",
        }}
      >
        {characters.map(
          (character, index) => (
            <span
              key={`${character}-${index}`}
              ref={(element) => {
                characterRefs.current[
                  index
                ] = element;
              }}
              aria-hidden="true"
              className="inline-block"
              style={{
                fontVariationSettings:
                  "'wght' 800, 'wdth' 100",
              }}
            >
              {character === " "
                ? "\u00A0"
                : character}
            </span>
          ),
        )}
      </div>
    </div>
  );
}

export function FooterSection() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-white text-neutral-950">
      <div className="mx-auto max-w-[1720px] px-5 pb-4 pt-5 sm:px-8 md:pt-6 lg:px-12 xl:px-14">
        <div className="border-t border-neutral-300 pt-7 md:pt-9">
          <div className="grid gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:gap-14 xl:gap-20">
            <div>
              <Image
                src="/AdinnLogo.svg"
                alt="ADINN Roadshow and Unipole"
                width={300}
                height={110}
                className="h-auto w-[220px] object-contain sm:w-[250px] lg:w-[270px]"
              />

              <p className="mt-4 max-w-[390px] text-[16px] leading-[1.5] text-neutral-800 sm:text-[18px] lg:text-[20px]">
                We help brands stand taller with
                powerful outdoor advertising
                solutions.
              </p>

              <div className="mt-6">
                <h2 className="text-[18px] font-semibold sm:text-[20px]">
                  Contact
                </h2>

                <div className="mt-4 space-y-1 text-[16px] leading-relaxed text-neutral-800 sm:text-[18px] lg:text-[20px]">
                  <a
                    href="tel:+917339509090"
                    className="block transition-opacity hover:opacity-60"
                  >
                    +91 73395 09090
                  </a>

                  <a
                    href="tel:+919500388761"
                    className="block transition-opacity hover:opacity-60"
                  >
                    +91 95003 88761
                  </a>

                  <a
                    href="mailto:roadshowsales@adinn.co.in"
                    className="block break-all transition-opacity hover:opacity-60"
                  >
                    roadshowsales@adinn.co.in
                  </a>
                </div>
              </div>

              <div className="mt-5 flex items-center gap-7">
                <a
                  href="#"
                  aria-label="Instagram"
                  className="transition-opacity hover:opacity-60"
                >
                  <Instagram
                    size={34}
                    strokeWidth={1.8}
                  />
                </a>

                <a
                  href="#"
                  aria-label="Facebook"
                  className="transition-opacity hover:opacity-60"
                >
                  <Facebook
                    size={34}
                    strokeWidth={1.8}
                  />
                </a>

                <a
                  href="#"
                  aria-label="LinkedIn"
                  className="transition-opacity hover:opacity-60"
                >
                  <Linkedin
                    size={34}
                    strokeWidth={1.8}
                  />
                </a>

                <a
                  href="#"
                  aria-label="YouTube"
                  className="transition-opacity hover:opacity-60"
                >
                  <Youtube
                    size={36}
                    strokeWidth={1.8}
                  />
                </a>
              </div>
            </div>

            <div>
              <h2 className="text-[19px] font-semibold sm:text-[21px]">
                Locations
              </h2>

              <div className="mt-3 grid md:grid-cols-2">
                {LOCATIONS.map(
                  (location, index) => (
                    <article
                      key={location.city}
                      className={[
                        "min-h-[118px] py-5",
                        index % 2 === 0
                          ? "md:border-r md:pr-12 xl:pr-14"
                          : "md:pl-12 xl:pl-14",
                        index < 2
                          ? "border-b border-neutral-300"
                          : "",
                      ].join(" ")}
                    >
                      <h3 className="text-[18px] font-semibold sm:text-[20px]">
                        {location.city}
                      </h3>

                      <p className="mt-3 max-w-[390px] text-[16px] leading-[1.5] text-neutral-800 sm:text-[18px] lg:text-[20px]">
                        {location.address}
                      </p>
                    </article>
                  ),
                )}
              </div>
            </div>
          </div>

          <div className="mt-2 h-[86px] sm:h-[112px] md:h-[142px] lg:h-[172px] xl:h-[202px] 2xl:h-[222px]">
            <TextPressure text="ADINN UNIPOLE" />
          </div>

          <div className="mt-1 flex flex-col gap-4 border-t border-neutral-300 pt-4 text-sm text-neutral-800 sm:text-base lg:flex-row lg:items-center lg:justify-between">
            <p>
              © {year} Adinn Advertising
              Services Ltd.
            </p>

            <nav
              aria-label="Footer links"
              className="flex flex-wrap items-center gap-x-5 gap-y-3"
            >
              <a
                href="/privacy-policy"
                className="transition-opacity hover:opacity-60"
              >
                Privacy Policy
              </a>

              <span aria-hidden="true">
                |
              </span>

              <a
                href="/terms"
                className="transition-opacity hover:opacity-60"
              >
                Terms
              </a>

              <span aria-hidden="true">
                |
              </span>

              <a
                href="#contact"
                className="transition-opacity hover:opacity-60"
              >
                Contact
              </a>
            </nav>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default FooterSection;