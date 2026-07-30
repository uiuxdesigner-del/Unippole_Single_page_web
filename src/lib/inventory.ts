import type { Unipole } from "@/types/unipole";

export interface InventoryFilters {
  search: string;
  city: string;
  area: string;
  size: string;
  illumination: string;
  availability: string;
}

export const defaultFilters: InventoryFilters = {
  search: "",
  city: "all",
  area: "all",
  size: "all",
  illumination: "all",
  availability: "all",
};

function unique<T extends string>(v: T[]): T[] {
  return Array.from(new Set(v)).sort();
}

export function getFilterOptions(items: Unipole[]) {
  return {
    cities: unique(items.map((i) => i.city)),
    areas: unique(items.map((i) => i.area)),
    sizes: unique(items.map((i) => i.size)),
    illuminations: unique(items.map((i) => i.illumination)),
    availabilities: unique(items.map((i) => i.status)),
  };
}

export function filterInventory(items: Unipole[], f: InventoryFilters): Unipole[] {
  const q = f.search.trim().toLowerCase();
  return items.filter((i) => {
    if (q) {
      const hay = [i.title, i.mediaCode, i.city, i.area, i.roadName, i.landmark, i.facing]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (f.city !== "all" && i.city !== f.city) return false;
    if (f.area !== "all" && i.area !== f.area) return false;
    if (f.size !== "all" && i.size !== f.size) return false;
    if (f.illumination !== "all" && i.illumination !== f.illumination) return false;
    if (f.availability !== "all" && i.status !== f.availability) return false;
    return true;
  });
}

export function availabilityLabel(a: Unipole["status"]): string {
  return {
    available: "Available",
    "temporarily-held": "Temporarily Held",
    booked: "Booked",
    upcoming: "Upcoming",
  }[a];
}

export function illuminationLabel(a: Unipole["illumination"]): string {
  return { "front-lit": "Front-lit", "back-lit": "Back-lit", "non-illuminated": "Non-illuminated" }[a];
}