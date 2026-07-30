import type { CampaignPlanItem } from "@/types/unipole";

export const STORAGE_KEY = "adinn-unipole-campaign-plan-v1";

export function loadPlan(): CampaignPlanItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is CampaignPlanItem =>
        !!x && typeof x === "object" && typeof x.siteId === "string" && typeof x.addedAt === "string",
    );
  } catch {
    return [];
  }
}

export function savePlan(items: CampaignPlanItem[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* ignore */
  }
}