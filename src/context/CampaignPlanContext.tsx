"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { CampaignPlanItem, Unipole } from "@/types/unipole";
import { loadPlan, savePlan } from "@/lib/campaign-plan";
import { unipoles } from "@/data/unipoles";

interface AddOptions {
  tentativeStartDate?: string;
  duration?: string;
}

interface ToastState {
  siteId: string;
  duplicate: boolean;
  key: number;
}

interface CampaignPlanContextValue {
  items: CampaignPlanItem[];
  hydrated: boolean;
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  add: (siteId: string, options?: AddOptions) => void;
  remove: (siteId: string) => void;
  clear: () => void;
  has: (siteId: string) => boolean;
  count: number;
  resolve: (siteId: string) => Unipole | undefined;
  toast: ToastState | null;
  dismissToast: () => void;
}

const CampaignPlanContext = createContext<CampaignPlanContextValue | null>(null);
const validSiteIds = new Set(unipoles.map((site) => site.id));

function sanitizeItems(items: CampaignPlanItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (!validSiteIds.has(item.siteId) || seen.has(item.siteId)) return false;
    seen.add(item.siteId);
    return true;
  });
}

export function CampaignPlanProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CampaignPlanItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setItems(sanitizeItems(loadPlan()));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) savePlan(items);
  }, [items, hydrated]);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  const has = useCallback((siteId: string) => items.some((item) => item.siteId === siteId), [items]);

  const showToast = useCallback((siteId: string, duplicate: boolean) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ siteId, duplicate, key: Date.now() });
    toastTimer.current = setTimeout(() => setToast(null), 6000);
  }, []);

  const add = useCallback(
    (siteId: string, options?: AddOptions) => {
      if (!validSiteIds.has(siteId)) return;

      setItems((current) => {
        const existing = current.find((item) => item.siteId === siteId);
        if (existing) {
          showToast(siteId, true);
          if (!options?.tentativeStartDate && !options?.duration) return current;
          return current.map((item) =>
            item.siteId === siteId
              ? {
                  ...item,
                  tentativeStartDate: options.tentativeStartDate || item.tentativeStartDate,
                  duration: options.duration || item.duration,
                }
              : item,
          );
        }

        showToast(siteId, false);
        return [
          ...current,
          {
            siteId,
            addedAt: new Date().toISOString(),
            tentativeStartDate: options?.tentativeStartDate,
            duration: options?.duration,
          },
        ];
      });
    },
    [showToast],
  );

  const remove = useCallback(
    (siteId: string) => setItems((current) => current.filter((item) => item.siteId !== siteId)),
    [],
  );
  const clear = useCallback(() => setItems([]), []);
  const dismissToast = useCallback(() => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(null);
  }, []);
  const resolve = useCallback((siteId: string) => unipoles.find((site) => site.id === siteId), []);

  const close = useCallback(() => setIsOpen(false), []);
  const open = useCallback(() => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("adinn:close-product-modal"));
    }
    setIsOpen(true);
  }, []);
  const toggle = useCallback(() => {
    setIsOpen((current) => {
      const next = !current;
      if (next && typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("adinn:close-product-modal"));
      }
      return next;
    });
  }, []);

  const value = useMemo<CampaignPlanContextValue>(
    () => ({
      items,
      hydrated,
      isOpen,
      open,
      close,
      toggle,
      add,
      remove,
      clear,
      has,
      count: items.length,
      resolve,
      toast,
      dismissToast,
    }),
    [
      items,
      hydrated,
      isOpen,
      open,
      close,
      toggle,
      add,
      remove,
      clear,
      has,
      resolve,
      toast,
      dismissToast,
    ],
  );

  return <CampaignPlanContext.Provider value={value}>{children}</CampaignPlanContext.Provider>;
}

export function useCampaignPlan() {
  const context = useContext(CampaignPlanContext);
  if (!context) {
    throw new Error("useCampaignPlan must be used within CampaignPlanProvider");
  }
  return context;
}
