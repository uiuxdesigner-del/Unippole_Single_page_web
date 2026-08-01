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

function TextPressure({
  text = "ADINN UNIPOLE",
}: {
  text?: string;
}) {
  const containerRef =
    useRef<HTMLDivElement | null>(null);

  const characterRefs =
    useRef<Array<HTMLSpanElement | null>>([]);

  const characterCentresRef =
    useRef<Point[]>([]);

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

  const [fontSize, setFontSize] =
    useState(34);

  const characters = useMemo(
    () => Array.from(text),
    [text],
  );

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

  const measureCharacters =
    useCallback(() => {
      characterCentresRef.current =
        characterRefs.current.map(
          (character) => {
            if (!character) {
              return {
                x: 0,
                y: 0,
              };
            }

            return {
              x:
                character.offsetLeft +
                character.offsetWidth / 2,
              y:
                character.offsetTop +
                character.offsetHeight / 2,
            };
          },
        );
    }, []);

  const updateSize = useCallback(() => {
    const container =
      containerRef.current;

    if (!container) return;

    const availableWidth = Math.max(
      container.clientWidth -
        Math.max(
          16,
          container.clientWidth * 0.018,
        ),
      1,
    );

    const visibleUnits =
      characters.reduce(
        (total, character) =>
          total +
          (character === " " ? 0.42 : 1),
        0,
      );

    const nextFontSize = clamp(
      availableWidth /
        Math.max(
          visibleUnits * 0.59,
          1,
        ),
      30,
      245,
    );

    setFontSize(nextFontSize);

    window.requestAnimationFrame(() => {
      measureCharacters();
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
    measureCharacters,
    setPointerToCentre,
  ]);

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

  const resetCharacters =
    useCallback(() => {
      characterRefs.current.forEach(
        (character) => {
          if (!character) return;

          character.style.transform =
            "scaleX(1)";

          character.style.fontWeight =
            "800";
        },
      );
    }, []);

  const animate = useCallback(() => {
    animationFrameRef.current = null;

    if (
      !isVisibleRef.current ||
      reducedMotionRef.current
    ) {
      return;
    }

    const smooth =
      smoothPointerRef.current;

    const target =
      targetPointerRef.current;

    smooth.x = lerp(
      smooth.x,
      target.x,
      0.17,
    );

    smooth.y = lerp(
      smooth.y,
      target.y,
      0.17,
    );

    let remainingDistance = 0;

    characterRefs.current.forEach(
      (character, index) => {
        if (!character) return;

        const centre =
          characterCentresRef.current[
            index
          ];

        if (!centre) return;

        const deltaX =
          smooth.x - centre.x;

        const deltaY =
          smooth.y - centre.y;

        const distance = Math.sqrt(
          deltaX * deltaX +
            deltaY * deltaY,
        );

        const responseRadius = Math.max(
          170,
          Math.min(
            330,
            (
              containerRef.current
                ?.clientWidth ?? 1200
            ) * 0.22,
          ),
        );

        const influence =
          1 -
          clamp(
            distance /
              responseRadius,
            0,
            1,
          );

        const easedInfluence =
          influence *
          influence *
          (3 - 2 * influence);

        const widthScale = lerp(
          0.9,
          1.24,
          easedInfluence,
        );

        const weight = Math.round(
          lerp(
            720,
            950,
            easedInfluence,
          ),
        );

        character.style.transform =
          `scaleX(${widthScale.toFixed(
            3,
          )})`;

        character.style.fontWeight =
          String(weight);

        remainingDistance = Math.max(
          remainingDistance,
          Math.abs(
            target.x - smooth.x,
          ),
          Math.abs(
            target.y - smooth.y,
          ),
        );
      },
    );

    if (
      isPointerInsideRef.current ||
      remainingDistance > 0.35
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
    const container =
      containerRef.current;

    if (!container) return;

    const bounds =
      container.getBoundingClientRect();

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
      }
    };

    handleReducedMotion();

    mediaQuery.addEventListener(
      "change",
      handleReducedMotion,
    );

    const resizeObserver =
      new ResizeObserver(updateSize);

    resizeObserver.observe(container);

    const intersectionObserver =
      new IntersectionObserver(
        ([entry]) => {
          isVisibleRef.current =
            entry.isIntersecting;

          if (entry.isIntersecting) {
            updateSize();
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

    document.fonts?.ready.then(
      updateSize,
    );

    updateSize();

    return () => {
      mediaQuery.removeEventListener(
        "change",
        handleReducedMotion,
      );

      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      stopAnimation();
    };
  }, [
    resetCharacters,
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
      <div
        className="absolute inset-0 flex items-center justify-between whitespace-nowrap px-[1%] uppercase text-[#080808]"
        style={{
          fontFamily:
            "Arial Black, Arial, sans-serif",
          fontSize: `${fontSize}px`,
          fontWeight: 800,
          lineHeight: 0.8,
          letterSpacing: "-0.065em",
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
              className="inline-block transform-gpu will-change-transform"
              style={{
                transformOrigin:
                  "center center",
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
      <div className="mx-auto max-w-[1720px] px-5 pb-5 pt-8 sm:px-8 md:pt-10 lg:px-12 xl:px-14">
        <div className="border-t border-neutral-300 pt-10 md:pt-14">
          <div className="grid gap-12 lg:grid-cols-[0.82fr_1.18fr] lg:gap-20 xl:gap-28">
            <div>
              <Image
                src="/AdinnLogo.svg"
                alt="ADINN Roadshow and Unipole"
                width={300}
                height={110}
                className="h-auto w-[220px] object-contain sm:w-[250px] lg:w-[270px]"
              />

              <p className="mt-6 max-w-[390px] text-[16px] leading-[1.5] text-neutral-800 sm:text-[18px] lg:text-[20px]">
                We help brands stand taller with
                powerful outdoor advertising
                solutions.
              </p>

              <div className="mt-9">
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

              <div className="mt-8 flex items-center gap-7">
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

              <div className="mt-5 grid md:grid-cols-2">
                {LOCATIONS.map(
                  (location, index) => (
                    <article
                      key={location.city}
                      className={[
                        "min-h-[150px] py-7",
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

          <div className="mt-10 h-[94px] sm:h-[140px] md:h-[185px] lg:h-[230px] xl:h-[280px] 2xl:h-[310px]">
            <TextPressure text="ADINN UNIPOLE" />
          </div>

          <div className="mt-4 flex flex-col gap-5 border-t border-neutral-300 pt-6 text-sm text-neutral-800 sm:text-base lg:flex-row lg:items-center lg:justify-between">
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