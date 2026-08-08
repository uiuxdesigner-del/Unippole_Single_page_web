"use client";

import dynamic from "next/dynamic";

import { CampaignPlanProvider } from "@/context/CampaignPlanContext";
import { useLenisSetup } from "@/hooks/useLenis";
import { Header } from "@/components/layout/Header";

import {
  FaqSection,
  HeroSection,
  WhatIsUnipoleSection,
  WhyChooseSection,
} from "@/components/home/HomeSections";

import UnipoleTypesStack from "@/components/home/UnipoleTypesStack";

import { GroundToSkySection } from "@/components/home/GroundToSkySection";
import { InventorySection } from "@/components/home/InventorySection";
import { DayNightCompare } from "@/components/home/DayNightCompare";
import { EnquirySection } from "@/components/home/EnquirySection";
import { FooterSection } from "@/components/home/FooterSection";

import { CampaignPlanDrawer } from "@/components/campaign/CampaignPlanDrawer";
import { AddedToPlanToast } from "@/components/campaign/AddedToPlanToast";
import { ProductModal } from "@/components/product/ProductModal";

function LenisBoot() {
  useLenisSetup();
  return null;
}

function WebsiteContent() {
  return (
    <div
      id="top"
      className="min-h-screen overflow-x-clip bg-white text-adinn-ink"
    >
      <LenisBoot />

      <Header />

      <main>
        <HeroSection />

        <UnipoleTypesStack />

        <WhatIsUnipoleSection />

        <WhyChooseSection />

        <InventorySection />

        <DayNightCompare />

        <GroundToSkySection />

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