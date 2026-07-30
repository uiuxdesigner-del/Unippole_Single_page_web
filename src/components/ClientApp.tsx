"use client";

import dynamic from "next/dynamic";

import { CampaignPlanProvider } from "@/context/CampaignPlanContext";
import { useLenisSetup } from "@/hooks/useLenis";
import { Header } from "@/components/layout/Header";
import {
  BusinessGrowthSection,
  FaqSection,
  GroundToSkySection,
  HeroSection,
  HowItWorksSection,
  IndustriesSection,
  WhatIsUnipoleSection,
  WhyChooseSection,
} from "@/components/home/HomeSections";
import { InventorySection } from "@/components/home/InventorySection";
import { DayNightCompare } from "@/components/home/DayNightCompare";
import { EnquirySection } from "@/components/home/EnquirySection";
import { FooterSection } from "@/components/home/FooterSection";
import { CampaignPlanDrawer } from "@/components/campaign/CampaignPlanDrawer";
import { AddedToPlanToast } from "@/components/campaign/AddedToPlanToast";
import { ProductModal } from "@/components/product/ProductModal";

const AssemblyScene = dynamic(
  () => import("@/components/home/AssemblyScene").then((module) => module.AssemblyScene),
  {
    ssr: false,
    loading: () => (
      <section className="flex min-h-[70vh] items-center justify-center bg-white">
        <div className="text-sm text-adinn-muted">Loading interactive structure…</div>
      </section>
    ),
  },
);

function LenisBoot() {
  useLenisSetup();
  return null;
}

function WebsiteContent() {
  return (
    <div id="top" className="min-h-screen overflow-x-clip bg-white text-adinn-ink">
      <LenisBoot />
      <Header />
      <main>
        <HeroSection />
        <WhatIsUnipoleSection />
        <WhyChooseSection />
        <InventorySection />
        <DayNightCompare />
        <AssemblyScene />
        <GroundToSkySection />
        <IndustriesSection />
        <BusinessGrowthSection />
        <FaqSection />
        <EnquirySection />
      </main>
      <FooterSection />
      <CampaignPlanDrawer />
      <ProductModal />
      <AddedToPlanToast />
    </div>
  );
}

export function ClientApp() {
  return (
    <CampaignPlanProvider>
      <WebsiteContent />
    </CampaignPlanProvider>
  );
}
