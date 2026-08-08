"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const ProposalBanner3D = dynamic(
  () => import("./ProposalBanner3D"),
  {
    ssr: false,
    loading: () => (
      <div className="h-full min-h-[430px] w-full rounded-[10px] bg-[#020611]" />
    ),
  },
);

type ModuleKey = "400" | "500" | "600" | "800" | "900";
type ModuleFilter = "all" | ModuleKey;

type UnipoleVariation = {
  id: string;
  label: string;
  poleDiameter: string;
  poleThickness: string;
  topPlate: string;
  bottomPlate: string;
  height: string;
  foundationSize: string;
  displaySize: string;
  type: string;
  boardType: string;
  /*
   * Optional future variation image.
   * When omitted, the popup automatically uses the module card image.
   */
  image?: string;
};

export type UnipoleModule = {
  id: string;
  key: ModuleKey;
  title: string;
  heightRange: string;
  displayRange: string;
  boardType: string;
  sideType: string;
  image: string;
  imageAlt: string;
  variations: UnipoleVariation[];
};

type InventorySectionProps = {
  onViewDetails?: (module: UnipoleModule) => void;
};

const FALLBACK_IMAGE = "/images/unipole/hero.webp";

const moduleFilters: Array<{
  value: ModuleFilter;
  label: string;
}> = [
  { value: "all", label: "All Modules" },
  { value: "400", label: "400 mm" },
  { value: "500", label: "500 mm" },
  { value: "600", label: "600 mm" },
  { value: "800", label: "800 mm" },
  { value: "900", label: "900 mm" },
];

const unipoleModules: UnipoleModule[] = [
  {
    id: "module-400",
    key: "400",
    title: "400 mm Module",
    heightRange: "20–50 ft",
    displayRange: "8×5 – 15×6 ft",
    boardType: "Acrylic Sign Board",
    sideType: "Double Side",
    image: "/images/400mm.webp",
    imageAlt: "400 mm UNIPOLE advertising structure",
    variations: [
      {
        id: "400-20",
        label: "400 mm · 20 ft",
        poleDiameter: "400 mm",
        poleThickness: "8 mm",
        topPlate: "JSW Make Top Plate — 16 mm thickness",
        bottomPlate: "Bottom Plate — 20 mm thickness",
        height: "20 ft",
        foundationSize: "3×3×5 ft",
        displaySize: "8×5 ft",
        type: "Double Side",
        boardType: "Acrylic Sign Board",
      },
      {
        id: "400-30",
        label: "400 mm · 30 ft",
        poleDiameter: "400 mm",
        poleThickness: "8 mm",
        topPlate: "JSW Make Top Plate — 16 mm thickness",
        bottomPlate: "Bottom Plate — 20 mm thickness",
        height: "30 ft",
        foundationSize: "3×3×5 ft",
        displaySize: "10×5 ft",
        type: "Double Side",
        boardType: "Acrylic Sign Board",
      },
      {
        id: "400-40",
        label: "400 mm · 40 ft",
        poleDiameter: "400 mm",
        poleThickness: "8 mm",
        topPlate: "JSW Make Top Plate — 16 mm thickness",
        bottomPlate: "Bottom Plate — 20 mm thickness",
        height: "40 ft",
        foundationSize: "3×3×8 ft",
        displaySize: "15×6 ft",
        type: "Double Side",
        boardType: "Acrylic Sign Board",
      },
      {
        id: "400-50",
        label: "400 mm · 50 ft",
        poleDiameter: "400 mm",
        poleThickness: "8 mm",
        topPlate: "JSW Make Top Plate — 16 mm thickness",
        bottomPlate: "Bottom Plate — 20 mm thickness",
        height: "50 ft",
        foundationSize: "3×3×8 ft",
        displaySize: "15×6 ft",
        type: "Double Side",
        boardType: "Acrylic Sign Board",
      },
    ],
  },
  {
    id: "module-500",
    key: "500",
    title: "500 mm Module",
    heightRange: "30–40 ft",
    displayRange: "10×8 – 15×8 ft",
    boardType: "Acrylic Sign Board",
    sideType: "Double Side",
    image: "/images/500mm.webp",
    imageAlt: "500 mm UNIPOLE advertising structure",
    variations: [
      {
        id: "500-30",
        label: "500 mm · 30 ft",
        poleDiameter: "500 mm",
        poleThickness: "8 mm",
        topPlate: "JSW Make Top Plate — 16 mm thickness",
        bottomPlate: "Bottom Plate — 20 mm thickness",
        height: "30 ft",
        foundationSize: "4×4×8 ft",
        displaySize: "10×8 ft",
        type: "Double Side",
        boardType: "Acrylic Sign Board",
      },
      {
        id: "500-40",
        label: "500 mm · 40 ft",
        poleDiameter: "500 mm",
        poleThickness: "8 mm",
        topPlate: "JSW Make Top Plate — 16 mm thickness",
        bottomPlate: "Bottom Plate — 20 mm thickness",
        height: "40 ft",
        foundationSize: "4×4×10 ft",
        displaySize: "15×8 ft",
        type: "Double Side",
        boardType: "Acrylic Sign Board",
      },
    ],
  },
  {
    id: "module-600",
    key: "600",
    title: "600 mm Module",
    heightRange: "40–50 ft",
    displayRange: "30×25 – 30×30 ft",
    boardType: "Flex Board",
    sideType: "Double Side",
    image: "/images/600mm.webp",
    imageAlt: "600 mm UNIPOLE advertising structure",
    variations: [
      {
        id: "600-40",
        label: "600 mm · 40 ft",
        poleDiameter: "600 mm",
        poleThickness: "8 mm",
        topPlate: "JSW Make Top Plate — 20 mm thickness",
        bottomPlate: "Bottom Plate — 25 mm thickness",
        height: "40 ft",
        foundationSize: "4×4×10 ft",
        displaySize: "30×30 ft",
        type: "Double Side",
        boardType: "Flex Board",
      },
      {
        id: "600-50",
        label: "600 mm · 50 ft",
        poleDiameter: "600 mm",
        poleThickness: "8 mm",
        topPlate: "JSW Make Top Plate — 20 mm thickness",
        bottomPlate: "Bottom Plate — 25 mm thickness",
        height: "50 ft",
        foundationSize: "4×4×10 ft",
        displaySize: "30×25 ft",
        type: "Double Side",
        boardType: "Flex Board",
      },
    ],
  },
  {
    id: "module-800",
    key: "800",
    title: "800 mm Module",
    heightRange: "40–50 ft",
    displayRange: "40×25 – 40×30 ft",
    boardType: "Flex Board",
    sideType: "Double Side",
    image: "/images/800mm.webp",
    imageAlt: "800 mm UNIPOLE advertising structure",
    variations: [
      {
        id: "800-40",
        label: "800 mm · 40 ft",
        poleDiameter: "800 mm",
        poleThickness: "8 mm",
        topPlate: "JSW Make Top Plate — 20 mm thickness",
        bottomPlate: "Bottom Plate — 25 mm thickness",
        height: "40 ft",
        foundationSize: "5×5×10 ft",
        displaySize: "40×25 ft",
        type: "Double Side",
        boardType: "Flex Board",
      },
      {
        id: "800-50",
        label: "800 mm · 50 ft",
        poleDiameter: "800 mm",
        poleThickness: "8 mm",
        topPlate: "JSW Make Top Plate — 20 mm thickness",
        bottomPlate: "Bottom Plate — 30 mm thickness",
        height: "50 ft",
        foundationSize: "6×6×10 ft",
        displaySize: "40×30 ft",
        type: "Double Side",
        boardType: "Flex Board",
      },
    ],
  },
  {
    id: "module-900",
    key: "900",
    title: "900 mm Module",
    heightRange: "40–50 ft",
    displayRange: "50×25 – 50×30 ft",
    boardType: "Flex Board",
    sideType: "Double Side",
    image: "/images/900mm.webp",
    imageAlt: "900 mm UNIPOLE advertising structure",
    variations: [
      {
        id: "900-40",
        label: "900 mm · 40 ft",
        poleDiameter: "900 mm",
        poleThickness: "10 mm",
        topPlate: "JSW Make Top Plate — 20 mm thickness",
        bottomPlate: "Bottom Plate — 30 mm thickness",
        height: "40 ft",
        foundationSize: "7×7×10 ft",
        displaySize: "50×25 ft",
        type: "Double Side",
        boardType: "Flex Board",
      },
      {
        id: "900-50",
        label: "900 mm · 50 ft",
        poleDiameter: "900 mm",
        poleThickness: "10 mm",
        topPlate: "JSW Make Top Plate — 20 mm thickness",
        bottomPlate: "Bottom Plate — 30 mm thickness",
        height: "50 ft",
        foundationSize: "7×7×10 ft",
        displaySize: "50×30 ft",
        type: "Double Side",
        boardType: "Flex Board",
      },
    ],
  },
];

function SafeImage({
  src,
  alt,
  sizes,
  className,
  priority = false,
}: {
  src: string;
  alt: string;
  sizes: string;
  className: string;
  priority?: boolean;
}) {
  const [failedSource, setFailedSource] =
    useState<string | null>(null);

  const resolvedSource =
    failedSource === src ? FALLBACK_IMAGE : src;

  return (
    <Image
      src={resolvedSource}
      alt={alt}
      fill
      sizes={sizes}
      className={className}
      priority={priority}
      onError={() => {
        setFailedSource(src);
      }}
    />
  );
}

function CardSpecification({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <li className="border-b border-[#ededed] py-[9px] text-[14px] leading-[1.45] text-black sm:text-[15px] 2xl:text-[18px]">
      <span className="font-medium">{label}:</span>{" "}
      <span className="font-normal">{value}</span>
    </li>
  );
}

function LazyProposalBanner({
  shouldMount,
  active,
}: {
  shouldMount: boolean;
  active: boolean;
}) {
  return (
    <div className="h-full w-full">
      {shouldMount ? (
        <ProposalBanner3D active={active} />
      ) : (
        <div className="h-full min-h-[430px] w-full rounded-[10px] bg-[#020611]" />
      )}
    </div>
  );
}

function ModuleCard({
  module,
  onOpen,
}: {
  module: UnipoleModule;
  onOpen: (module: UnipoleModule) => void;
}) {
  return (
    <article className="h-full min-w-0">
      <button
        type="button"
        onClick={() => onOpen(module)}
        className="group flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-[10px] bg-[#fefefe] text-left outline-none transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_45px_rgba(15,23,42,0.09)] focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-4"
        aria-label={`View ${module.title} details`}
      >
        <div className="relative aspect-[419/234] w-full overflow-hidden bg-[rgba(217,217,217,0.5)]">
          <SafeImage
            src={module.image}
            alt={module.imageAlt}
            sizes="(min-width: 1536px) 419px, (min-width: 1280px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover object-center transition-transform duration-500 ease-out group-hover:scale-[1.025]"
          />
        </div>

        <div className="flex min-h-[282px] flex-1 flex-col px-[23px] pb-[21px] pt-[23px]">
          <h3 className="text-[18px] font-medium leading-normal text-black sm:text-[19px] 2xl:text-[20px]">
            {module.title}
          </h3>

          <ul className="mt-[18px]">
            <CardSpecification
              label="Height Range"
              value={module.heightRange}
            />

            <CardSpecification
              label="Display Size"
              value={module.displayRange}
            />

            <CardSpecification
              label="Board Type"
              value={module.sideType}
            />
          </ul>

          <span className="mt-auto flex min-h-14 w-full items-center justify-between gap-5 pt-4 text-[17px] font-medium text-black transition-colors group-hover:text-adinn-red">
            <span>View Details</span>

            <ArrowRight
              size={24}
              strokeWidth={1.5}
              className="shrink-0 transition-transform duration-300 group-hover:translate-x-1"
              aria-hidden="true"
            />
          </span>
        </div>
      </button>
    </article>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="grid gap-2 border-b border-neutral-200 py-4 sm:grid-cols-[170px_minmax(0,1fr)] sm:gap-6">
      <dt className="text-[12px] font-medium uppercase tracking-[0.09em] text-neutral-500">
        {label}
      </dt>

      <dd className="text-[15px] font-medium leading-6 text-black sm:text-[16px]">
        {value}
      </dd>
    </div>
  );
}

function ModuleDetailsModal({
  module,
  onClose,
}: {
  module: UnipoleModule;
  onClose: () => void;
}) {
  const [activeVariationIndex, setActiveVariationIndex] =
    useState(0);

  const variation =
    module.variations[activeVariationIndex] ??
    module.variations[0];

  const popupImage = variation.image ?? module.image;

  const showPrevious = useCallback(() => {
    setActiveVariationIndex((current) => {
      return (
        (current - 1 + module.variations.length) %
        module.variations.length
      );
    });
  }, [module.variations.length]);

  const showNext = useCallback(() => {
    setActiveVariationIndex((current) => {
      return (current + 1) % module.variations.length;
    });
  }, [module.variations.length]);

  useEffect(() => {
    const scrollY = window.scrollY;

    const previousBodyStyles = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      left: document.body.style.left,
      right: document.body.style.right,
      width: document.body.style.width,
      paddingRight: document.body.style.paddingRight,
    };

    const previousHtmlOverflow =
      document.documentElement.style.overflow;

    const scrollbarWidth =
      window.innerWidth -
      document.documentElement.clientWidth;

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";

    if (scrollbarWidth > 0) {
      document.body.style.paddingRight =
        `${scrollbarWidth}px`;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }

      if (event.key === "ArrowLeft") {
        showPrevious();
      }

      if (event.key === "ArrowRight") {
        showNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.documentElement.style.overflow =
        previousHtmlOverflow;

      document.body.style.overflow =
        previousBodyStyles.overflow;
      document.body.style.position =
        previousBodyStyles.position;
      document.body.style.top =
        previousBodyStyles.top;
      document.body.style.left =
        previousBodyStyles.left;
      document.body.style.right =
        previousBodyStyles.right;
      document.body.style.width =
        previousBodyStyles.width;
      document.body.style.paddingRight =
        previousBodyStyles.paddingRight;

      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );

      window.scrollTo(0, scrollY);
    };
  }, [onClose, showNext, showPrevious]);

  const details = [
    ["Pole Diameter", variation.poleDiameter],
    ["Pole Thickness", variation.poleThickness],
    ["Top Plate", variation.topPlate],
    ["Bottom Plate", variation.bottomPlate],
    ["Height", variation.height],
    ["Foundation Size", variation.foundationSize],
    ["Display Size", variation.displaySize],
    ["Type", variation.type],
    ["Board Type", variation.boardType],
  ] as const;

  return (
    <div
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      onWheel={(event) => {
        const target = event.target as HTMLElement;

        if (!target.closest("[data-modal-scroll]")) {
          event.preventDefault();
        }
      }}
      onTouchMove={(event) => {
        const target = event.target as HTMLElement;

        if (!target.closest("[data-modal-scroll]")) {
          event.preventDefault();
        }
      }}
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-black/70 p-3 backdrop-blur-[5px] sm:p-5"
    >
      <div className="relative w-full max-w-[1280px]">
        {module.variations.length > 1 && (
          <>
            <button
              type="button"
              onClick={showPrevious}
              aria-label="Previous variation"
              className="absolute left-2 top-1/2 z-50 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-neutral-200 bg-white text-black shadow-[0_10px_30px_rgba(0,0,0,0.18)] transition hover:scale-105 hover:bg-black hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white lg:-left-6"
            >
              <ChevronLeft
                size={23}
                strokeWidth={1.6}
              />
            </button>

            <button
              type="button"
              onClick={showNext}
              aria-label="Next variation"
              className="absolute right-2 top-1/2 z-50 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-neutral-200 bg-white text-black shadow-[0_10px_30px_rgba(0,0,0,0.18)] transition hover:scale-105 hover:bg-black hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white lg:-right-6"
            >
              <ChevronRight
                size={23}
                strokeWidth={1.6}
              />
            </button>
          </>
        )}

        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="unipole-module-modal-title"
          className="relative grid max-h-[calc(100dvh-24px)] grid-rows-[minmax(360px,46dvh)_minmax(0,1fr)] overflow-hidden rounded-[28px] bg-white shadow-[0_40px_120px_rgba(0,0,0,0.34)] sm:max-h-[calc(100dvh-40px)] lg:grid-cols-[44%_56%] lg:grid-rows-1"
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Close module details"
            className="absolute right-4 top-4 z-50 grid h-10 w-10 place-items-center rounded-full bg-white/95 text-black shadow-md transition hover:rotate-90 hover:bg-black hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 sm:right-5 sm:top-5"
          >
            <X
              size={21}
              strokeWidth={1.7}
            />
          </button>

          {/* Left side remains fixed and never scrolls. */}
          <div className="flex min-h-0 flex-col overflow-hidden bg-[#f5f5f3] p-5 sm:p-7 lg:p-10">
            <div className="relative min-h-0 flex-1 overflow-hidden rounded-[18px] bg-neutral-200">
              <SafeImage
                src={popupImage}
                alt={`${variation.label} UNIPOLE module`}
                sizes="(min-width: 1024px) 44vw, 100vw"
                className="object-contain object-center p-3 sm:p-5"
                priority
              />
            </div>

            <div className="mt-5 shrink-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.21em] text-neutral-500">
                Select a variation
              </p>

              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
                {module.variations.map(
                  (item, index) => {
                    const isActive =
                      index === activeVariationIndex;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() =>
                          setActiveVariationIndex(index)
                        }
                        aria-pressed={isActive}
                        className={[
                          "min-h-[76px] rounded-[12px] px-4 py-3 text-left transition-colors",
                          isActive
                            ? "bg-black text-white shadow-[0_8px_20px_rgba(0,0,0,0.12)]"
                            : "bg-[#e9e9e6] text-black hover:bg-[#ddddda]",
                        ].join(" ")}
                      >
                        <span className="block text-[13px] font-semibold">
                          {item.label}
                        </span>

                        <span
                          className={[
                            "mt-1 block text-[12px]",
                            isActive
                              ? "text-white/70"
                              : "text-neutral-500",
                          ].join(" ")}
                        >
                          {item.displaySize}
                        </span>
                      </button>
                    );
                  },
                )}
              </div>
            </div>
          </div>

          {/*
           * Only this right-side detail panel is scrollable.
           * Scrolling over the image/left side does not move the page.
           */}
          <div
            data-modal-scroll
            className="min-h-0 overflow-y-auto overscroll-contain px-6 pb-10 pt-9 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:px-10 sm:pb-12 sm:pt-12 lg:px-12 lg:pb-14"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-adinn-red">
              UNIPOLE specification
            </p>

            <h2
              id="unipole-module-modal-title"
              className="mt-3 pr-12 text-[clamp(2.25rem,4vw,4rem)] font-semibold leading-[0.96] tracking-[-0.05em] text-black"
            >
              {variation.label}
            </h2>

            <p className="mt-6 max-w-[720px] text-[15px] leading-7 text-neutral-600 sm:text-[17px]">
              Review the structural specifications for this
              variation. Final engineering dimensions may be
              confirmed after the site inspection and
              soil-condition assessment.
            </p>

            <dl className="mt-8 border-t border-neutral-200">
              {details.map(([label, value]) => (
                <DetailRow
                  key={label}
                  label={label}
                  value={value}
                />
              ))}
            </dl>

            <button
              type="button"
              onClick={() => {
                onClose();

                window.setTimeout(() => {
                  document
                    .querySelector("#enquiry")
                    ?.scrollIntoView({
                      behavior: "smooth",
                      block: "start",
                    });
                }, 120);
              }}
              className="mt-8 inline-flex min-h-12 items-center justify-center gap-8 rounded-[10px] bg-black px-6 text-[14px] font-medium text-white transition-colors hover:bg-adinn-red focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-adinn-red focus-visible:ring-offset-4"
            >
              Request This Module

              <ArrowRight
                size={18}
                strokeWidth={1.6}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function InventorySection({
  onViewDetails,
}: InventorySectionProps) {
  const [activeFilter, setActiveFilter] =
    useState<ModuleFilter>("all");

  const [selectedModule, setSelectedModule] =
    useState<UnipoleModule | null>(null);

  const sectionRef = useRef<HTMLElement | null>(null);
  const [shouldMountBanner, setShouldMountBanner] =
    useState(false);
  const [isBannerActive, setIsBannerActive] =
    useState(false);

  const activateBanner = useCallback(() => {
    setIsBannerActive(true);
  }, []);

  /* Mount ProposalBanner3D shortly after the Hero has had its initial
     paint — independent of scroll position, so the Canvas exists and
     can render its first frame while the user is still up near Hero or
     About, long before Inventory is anywhere close to the viewport. */
  useEffect(() => {
    if (typeof window === "undefined") return;

    const mount = () => setShouldMountBanner(true);

    const idleWindow = window as Window & {
      requestIdleCallback?: (
        callback: IdleRequestCallback,
        options?: IdleRequestOptions,
      ) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    let idleHandle: number | null = null;

    const startTimeoutId = window.setTimeout(() => {
      if (typeof idleWindow.requestIdleCallback === "function") {
        idleHandle = idleWindow.requestIdleCallback(mount, {
          timeout: 1500,
        });
      } else {
        mount();
      }
    }, 700);

    return () => {
      window.clearTimeout(startTimeoutId);
      if (idleHandle !== null) {
        idleWindow.cancelIdleCallback?.(idleHandle);
      }
    };
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    /* Proximity only ever controls whether the already-mounted Canvas'
       continuous rendering is active or paused — it no longer gates
       mounting itself. */
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsBannerActive(entry.isIntersecting);
      },
      {
        rootMargin: "1200px 0px 1200px 0px",
        threshold: 0.01,
      },
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  const visibleModules = useMemo(() => {
    if (activeFilter === "all") {
      return unipoleModules;
    }

    return unipoleModules.filter(
      (module) => module.key === activeFilter,
    );
  }, [activeFilter]);

  const openModuleDetails = useCallback(
    (module: UnipoleModule) => {
      if (onViewDetails) {
        onViewDetails(module);
        return;
      }

      setSelectedModule(module);
    },
    [onViewDetails],
  );

  const closeModuleDetails = useCallback(() => {
    setSelectedModule(null);
  }, []);

  const ctaGridClass =
    visibleModules.length === 1
      ? "col-span-full mt-1"
      : "col-span-full 2xl:col-span-3";

  return (
    <>
      <section
        ref={sectionRef}
        id="inventory"
        aria-labelledby="inventory-title"
        onPointerEnter={activateBanner}
        onFocus={activateBanner}
        className="overflow-hidden bg-[#f8f8f8] py-20 sm:py-24 lg:py-[130px]"
      >
        <div className="mx-auto w-full max-w-[1786px] px-5 sm:px-7 lg:px-10 xl:px-[50px]">
          <div className="text-center">
            <p className="text-[clamp(1.25rem,1.8vw,1.8rem)] font-medium leading-tight tracking-[-0.025em] text-neutral-950">
              Explore Our Range
            </p>

            <h2
              id="inventory-title"
              className="mt-2 text-[clamp(2.35rem,3.8vw,3.75rem)] font-normal leading-[1] tracking-[-0.045em] text-neutral-950"
            >
              UNIPOLE Models
            </h2>
          </div>

          <div
            role="toolbar"
            aria-label="Filter UNIPOLE modules"
            className="mx-auto mt-10 flex max-w-full items-center gap-3 overflow-x-auto pb-2 sm:justify-center sm:gap-4 sm:overflow-visible lg:mt-[54px] lg:gap-[28px]"
          >
            {moduleFilters.map((filter) => {
              const isActive =
                activeFilter === filter.value;

              return (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() =>
                    setActiveFilter(filter.value)
                  }
                  aria-pressed={isActive}
                  className={[
                    "h-[52px] shrink-0 px-5 text-sm font-normal transition-colors",
                    "sm:px-7 sm:text-base lg:px-8 lg:text-[20px]",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-4",
                    isActive
                      ? "bg-black text-white"
                      : "bg-[#f2f2f2] text-black hover:bg-[#e7e7e7]",
                  ].join(" ")}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>

          <p
            aria-live="polite"
            className="sr-only"
          >
            Showing {visibleModules.length} UNIPOLE modules
          </p>

          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:mt-[48px] xl:grid-cols-3 2xl:grid-cols-4">
            {visibleModules.map((module) => (
              <ModuleCard
                key={module.id}
                module={module}
                onOpen={openModuleDetails}
              />
            ))}

            <div
              className={`${ctaGridClass} min-h-[430px] [&>*]:h-full`}
            >
              <LazyProposalBanner
                shouldMount={shouldMountBanner}
                active={isBannerActive}
              />
            </div>
          </div>
        </div>
      </section>

      {selectedModule && (
        <ModuleDetailsModal
          key={selectedModule.id}
          module={selectedModule}
          onClose={closeModuleDetails}
        />
      )}
    </>
  );
}