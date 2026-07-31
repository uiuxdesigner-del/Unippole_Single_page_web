"use client";

import dynamic from "next/dynamic";

const CTAUnipoleScene = dynamic(
  () => import("./CTAUnipoleScene"),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 bg-[#020611]" />
    ),
  },
);

export default function ProposalBanner3D() {
  return (
    <article className="relative min-h-[470px] overflow-hidden rounded-[10px] bg-[#020611] sm:col-span-2 lg:min-h-[500px] xl:col-span-2 2xl:col-span-3 2xl:min-h-[516px]">
      <CTAUnipoleScene />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-24 bg-gradient-to-t from-[#06142b]/18 to-transparent"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-20 rounded-[10px] ring-1 ring-inset ring-white/10"
      />
    </article>
  );
}