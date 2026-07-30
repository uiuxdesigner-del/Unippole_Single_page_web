"use client";

import Image from "next/image";
import { ArrowRight, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

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
  image: string;
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
  onRequestProposal?: () => void;
};

const FALLBACK_IMAGE = "/images/unipole/hero.webp";

const moduleFilters: Array<{ value: ModuleFilter; label: string }> = [
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
        image: "/images/unipole/modules/400mm-20ft.webp",
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
        image: "/images/unipole/modules/400mm-30ft.webp",
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
        image: "/images/unipole/modules/400mm-40ft.webp",
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
        image: "/images/unipole/modules/400mm-50ft.webp",
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
        image: "/images/unipole/modules/500mm-30ft.webp",
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
        image: "/images/unipole/modules/500mm-40ft.webp",
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
        image: "/images/unipole/modules/600mm-40ft.webp",
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
        image: "/images/unipole/modules/600mm-50ft.webp",
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
        image: "/images/unipole/modules/800mm-40ft.webp",
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
        image: "/images/unipole/modules/800mm-50ft.webp",
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
        image: "/images/unipole/modules/900mm-40ft.webp",
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
        image: "/images/unipole/modules/900mm-50ft.webp",
      },
    ],
  },
];

function SafeImage({
  src,
  alt,
  sizes,
  className,
}: {
  src: string;
  alt: string;
  sizes: string;
  className: string;
}) {
  const [imageSource, setImageSource] = useState(src);

  useEffect(() => {
    setImageSource(src);
  }, [src]);

  return (
    <Image
      src={imageSource}
      alt={alt}
      fill
      sizes={sizes}
      className={className}
      onError={() => {
        if (imageSource !== FALLBACK_IMAGE) {
          setImageSource(FALLBACK_IMAGE);
        }
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

function ModuleCard({
  module,
  onOpen,
}: {
  module: UnipoleModule;
  onOpen: (module: UnipoleModule) => void;
}) {
  return (
    <article className="group flex min-w-0 flex-col overflow-hidden rounded-[10px] bg-[#fefefe]">
      <div className="relative aspect-[419/234] w-full overflow-hidden bg-[rgba(217,217,217,0.5)]">
        <SafeImage
          src={module.image}
          alt={module.imageAlt}
          sizes="(min-width: 1536px) 419px, (min-width: 1280px) 33vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover object-center transition-transform duration-500 ease-out group-hover:scale-[1.015]"
        />
      </div>

      <div className="flex min-h-[282px] flex-1 flex-col px-[23px] pb-[21px] pt-[23px]">
        <h3 className="text-[18px] font-medium leading-normal text-black sm:text-[19px] 2xl:text-[20px]">
          {module.title}
        </h3>

        <ul className="mt-[18px]">
          <CardSpecification label="Height Range" value={module.heightRange} />
          <CardSpecification label="Display Size" value={module.displayRange} />
          <CardSpecification label="Board Type" value={module.sideType} />
        </ul>

        <button
          type="button"
          onClick={() => onOpen(module)}
          className="mt-auto flex min-h-14 w-full items-center justify-between gap-5 pt-4 text-left text-[17px] font-medium text-black outline-none transition-colors hover:text-adinn-red focus-visible:text-adinn-red focus-visible:ring-2 focus-visible:ring-adinn-red/30"
        >
          <span>View Details</span>
          <ArrowRight
            size={24}
            strokeWidth={1.5}
            className="shrink-0 transition-transform duration-300 group-hover:translate-x-1"
            aria-hidden="true"
          />
        </button>
      </div>
    </article>
  );
}

function ProposalBanner({
  onRequestProposal,
}: {
  onRequestProposal: () => void;
}) {
  return (
    <article className="relative min-h-[430px] overflow-hidden rounded-[10px] bg-white sm:col-span-2 xl:col-span-2 2xl:col-span-3 2xl:min-h-[516px]">
      <div className="grid min-h-[430px] items-stretch gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_minmax(340px,484px)] lg:gap-8 2xl:min-h-[516px]">
        <div className="flex flex-col justify-center px-5 py-10 sm:px-8 lg:px-4 2xl:px-5">
          <h3 className="max-w-[760px] text-[clamp(2.5rem,4vw,4.375rem)] font-medium leading-[1.04] tracking-[-0.045em] text-black">
            UNIPOLE Advertising
          </h3>

          <p className="mt-4 max-w-[724px] text-[15px] leading-7 text-black sm:text-[17px] 2xl:text-[20px]">
            Our engineering team will help you select the appropriate pole
            diameter, height, foundation and display size for your required
            location.
          </p>

          <button
            type="button"
            onClick={onRequestProposal}
            className="mt-7 inline-flex min-h-[52px] w-fit items-center justify-center bg-black px-5 text-[15px] font-normal text-white transition-colors hover:bg-adinn-red focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-adinn-red focus-visible:ring-offset-4 sm:text-[17px] 2xl:text-[20px]"
          >
            Request a Proposal
          </button>
        </div>

        <div className="relative min-h-[300px] overflow-hidden rounded-[10px] bg-[#f5f5f5] lg:min-h-0">
          <SafeImage
            src="/images/unipole/modules/proposal-unipole.webp"
            alt="UNIPOLE structure"
            sizes="(min-width: 1536px) 484px, (min-width: 1024px) 38vw, 100vw"
            className="object-cover object-center opacity-90"
          />
          <div aria-hidden="true" className="absolute inset-0 bg-white/15" />
        </div>
      </div>
    </article>
  );
}

function ModuleDetailsModal({
  module,
  onClose,
}: {
  module: UnipoleModule | null;
  onClose: () => void;
}) {
  const [activeVariationIndex, setActiveVariationIndex] = useState(0);

  useEffect(() => {
    setActiveVariationIndex(0);
  }, [module]);

  useEffect(() => {
    if (!module) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [module, onClose]);

  if (!module) return null;

  const variation = module.variations[activeVariationIndex];

  const showPrevious = () => {
    setActiveVariationIndex(
      (current) =>
        (current - 1 + module.variations.length) % module.variations.length,
    );
  };

  const showNext = () => {
    setActiveVariationIndex(
      (current) => (current + 1) % module.variations.length,
    );
  };

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
  ];

  return (
    <div
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 p-3 backdrop-blur-sm sm:p-6"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="unipole-module-modal-title"
        className="relative max-h-[94vh] w-full max-w-[1280px] overflow-y-auto rounded-[18px] bg-white"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close module details"
          className="absolute right-4 top-4 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-white text-black transition-colors hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
        >
          <X size={21} strokeWidth={1.6} />
        </button>

        <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
          <div className="bg-[#f5f5f3] p-5 sm:p-8 lg:p-10">
            <div className="relative aspect-[4/3] overflow-hidden rounded-[12px] bg-neutral-200">
              <SafeImage
                src={variation.image}
                alt={variation.label}
                sizes="(min-width: 1024px) 45vw, 100vw"
                className="object-cover object-center"
              />

              {module.variations.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={showPrevious}
                    aria-label="Previous variation"
                    className="absolute left-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white text-black transition-colors hover:bg-neutral-100"
                  >
                    <ChevronLeft size={23} strokeWidth={1.5} />
                  </button>

                  <button
                    type="button"
                    onClick={showNext}
                    aria-label="Next variation"
                    className="absolute right-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white text-black transition-colors hover:bg-neutral-100"
                  >
                    <ChevronRight size={23} strokeWidth={1.5} />
                  </button>
                </>
              )}
            </div>

            <div className="mt-5">
              <p className="text-xs font-medium uppercase tracking-[0.15em] text-neutral-500">
                Select a variation
              </p>

              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
                {module.variations.map((item, index) => {
                  const isActive = index === activeVariationIndex;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveVariationIndex(index)}
                      aria-pressed={isActive}
                      className={[
                        "min-h-[82px] rounded-[10px] px-4 py-3 text-left transition-colors",
                        isActive
                          ? "bg-black text-white"
                          : "bg-white text-black hover:bg-neutral-100",
                      ].join(" ")}
                    >
                      <span className="block text-sm font-semibold">
                        {item.label}
                      </span>
                      <span
                        className={[
                          "mt-1 block text-xs",
                          isActive ? "text-white/70" : "text-neutral-500",
                        ].join(" ")}
                      >
                        {item.displaySize}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-9 lg:p-12">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-adinn-red">
              UNIPOLE specification
            </p>

            <h2
              id="unipole-module-modal-title"
              className="mt-3 pr-12 text-[clamp(2rem,4vw,3.5rem)] font-semibold leading-[1] tracking-[-0.045em] text-black"
            >
              {variation.label}
            </h2>

            <p className="mt-4 max-w-[620px] text-sm leading-7 text-neutral-600 sm:text-base">
              Review the structural specifications for this variation. Final
              engineering dimensions may be confirmed after the site inspection
              and soil-condition assessment.
            </p>

            <dl className="mt-8 divide-y divide-neutral-200 border-y border-neutral-200">
              {details.map(([label, value]) => (
                <div
                  key={label}
                  className="grid gap-1 py-4 sm:grid-cols-[170px_1fr] sm:gap-6"
                >
                  <dt className="text-xs font-medium uppercase tracking-[0.08em] text-neutral-500">
                    {label}
                  </dt>
                  <dd className="text-sm font-medium leading-6 text-black sm:text-base">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>

            <button
              type="button"
              onClick={() => {
                onClose();
                window.setTimeout(() => {
                  document.querySelector("#enquiry")?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                  });
                }, 120);
              }}
              className="mt-8 inline-flex min-h-12 items-center justify-center gap-5 bg-black px-6 text-sm font-medium text-white transition-colors hover:bg-adinn-red focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-adinn-red focus-visible:ring-offset-4"
            >
              Request This Module
              <ArrowRight size={18} strokeWidth={1.6} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function InventorySection({
  onViewDetails,
  onRequestProposal,
}: InventorySectionProps) {
  const [activeFilter, setActiveFilter] =
    useState<ModuleFilter>("all");
  const [selectedModule, setSelectedModule] =
    useState<UnipoleModule | null>(null);

  const visibleModules = useMemo(() => {
    if (activeFilter === "all") return unipoleModules;
    return unipoleModules.filter((module) => module.key === activeFilter);
  }, [activeFilter]);

  const openModuleDetails = (module: UnipoleModule) => {
    if (onViewDetails) {
      onViewDetails(module);
      return;
    }
    setSelectedModule(module);
  };

  const handleRequestProposal = () => {
    if (onRequestProposal) {
      onRequestProposal();
      return;
    }

    document.querySelector("#enquiry")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <>
      <section
        id="inventory"
        aria-labelledby="inventory-title"
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
              const isActive = activeFilter === filter.value;

              return (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setActiveFilter(filter.value)}
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

          <p aria-live="polite" className="sr-only">
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

            <ProposalBanner onRequestProposal={handleRequestProposal} />
          </div>
        </div>
      </section>

      <ModuleDetailsModal
        module={selectedModule}
        onClose={() => setSelectedModule(null)}
      />
    </>
  );
} 