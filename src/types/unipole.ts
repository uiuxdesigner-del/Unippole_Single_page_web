export type Availability = "available" | "temporarily-held" | "booked" | "upcoming";
export type Illumination = "front-lit" | "back-lit" | "non-illuminated";

export interface Unipole {
  id: string;
  mediaCode: string;
  title: string;
  city: string;
  state: string;
  area: string;
  roadName: string;
  landmark: string;
  size: string;
  width: number;
  height: number;
  squareFeet: number;
  facing: string;
  trafficDirection: string;
  roadType: string;
  illumination: Illumination;
  displaySides: number;
  visibilityDistance: string;
  minimumCampaignDuration: string;
  status: Availability;
  availableFrom?: string;
  audience?: string;
  peakHours?: string;
  siteFeatures?: string[];
  trafficProfile?: string;
  nearbyActivity?: string;
  dayImage: string;
  nightImage: string;
  galleryImages: string[];
  mapUrl?: string;
  isPlaceholderData: boolean;
}

export interface CampaignPlanItem {
  siteId: string;
  addedAt: string;
  tentativeStartDate?: string;
  duration?: string;
}