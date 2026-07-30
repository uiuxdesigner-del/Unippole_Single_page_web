"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  X,
  Trash2,
  ArrowRight,
  ExternalLink,
  MessageCircle,
  ClipboardList,
  CalendarDays,
} from "lucide-react";
import { useCampaignPlan } from "@/context/CampaignPlanContext";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { lockScroll, unlockScroll, scrollToHash } from "@/hooks/useLenis";
import { PlaceholderImage } from "@/components/ui/PlaceholderImage";
import { BrandButton } from "@/components/ui/BrandButton";
import { buildWhatsAppUrl } from "@/config/site";

export function CampaignPlanDrawer() {
  const { isOpen, close, open, items, resolve, remove, clear } = useCampaignPlan();
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  useFocusTrap(isOpen, drawerRef);

  useEffect(() => {
    if (!isOpen) return;
    lockScroll();
    return () => {
      unlockScroll();
      setConfirmClear(false);
    };
  }, [isOpen]);

  useEffect(() => {
    const openFromEvent = () => open();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) close();
    };

    window.addEventListener("open-campaign-plan", openFromEvent);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("open-campaign-plan", openFromEvent);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open, isOpen, close]);

  const openSite = (siteId: string) => {
    close();
    setTimeout(() => {
      const url = new URL(window.location.href);
      url.searchParams.set("site", siteId);
      window.history.pushState({}, "", url);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }, 80);
  };

  const requestProposal = () => {
    const list = items
      .map((item) => ({ item, site: resolve(item.siteId) }))
      .filter((entry) => Boolean(entry.site))
      .map(({ item, site }) => {
        const planning = [
          item.tentativeStartDate ? `Start: ${item.tentativeStartDate}` : "",
          item.duration ? `Duration: ${item.duration}` : "",
        ]
          .filter(Boolean)
          .join(" · ");
        return `• ${site!.mediaCode} — ${site!.title} (${site!.city}, ${site!.area})${planning ? `\n  ${planning}` : ""}`;
      })
      .join("\n");

    const message = `Hello ADINN, I would like a proposal for the following ${items.length} UNIPOLE site${items.length === 1 ? "" : "s"}:\n\n${list}`;
    window.open(buildWhatsAppUrl(message), "_blank", "noopener,noreferrer");
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.button
            type="button"
            aria-label="Close campaign plan"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[60] cursor-default bg-adinn-ink/40 backdrop-blur-sm"
            onClick={close}
          />
          <motion.aside
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="plan-title"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", ease: [0.22, 1, 0.36, 1], duration: 0.34 }}
            className="fixed inset-y-0 right-0 z-[61] flex w-full max-w-full flex-col border-l border-adinn-border bg-white sm:max-w-md md:max-w-[460px]"
            style={{
              paddingTop: "env(safe-area-inset-top)",
              paddingBottom: "env(safe-area-inset-bottom)",
            }}
          >
            <header className="flex min-h-20 items-center justify-between border-b border-adinn-border px-5">
              <div>
                <div className="flex items-center gap-2">
                  <ClipboardList size={17} strokeWidth={1.75} className="text-adinn-red" aria-hidden="true" />
                  <h2 id="plan-title" className="text-base font-semibold text-adinn-ink">
                    Campaign Plan
                  </h2>
                </div>
                <p className="mt-1 text-xs text-adinn-muted">
                  {items.length} site{items.length === 1 ? "" : "s"} shortlisted for review
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Close campaign plan"
                className="grid h-10 w-10 place-items-center rounded-md border border-adinn-border text-adinn-ink transition-colors hover:bg-adinn-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-adinn-ink/40"
              >
                <X size={18} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto">
              {items.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center px-8 py-16 text-center">
                  <div className="grid h-12 w-12 place-items-center rounded-full border border-adinn-border bg-adinn-warm text-adinn-ink">
                    <ClipboardList size={21} strokeWidth={1.5} aria-hidden="true" />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-adinn-ink">Your campaign plan is empty</h3>
                  <p className="mt-2 max-w-xs text-sm leading-6 text-adinn-muted">
                    Add suitable UNIPOLE locations to compare them and request a proposal.
                  </p>
                  <BrandButton
                    variant="secondary"
                    className="mt-7"
                    onClick={() => {
                      close();
                      setTimeout(() => scrollToHash("#inventory"), 80);
                    }}
                  >
                    Browse Locations
                  </BrandButton>
                </div>
              ) : (
                <ul className="divide-y divide-adinn-border">
                  {items.map((item) => {
                    const site = resolve(item.siteId);
                    if (!site) return null;
                    return (
                      <li key={item.siteId} className="flex gap-4 p-5">
                        <div className="h-24 w-28 shrink-0 overflow-hidden rounded-lg border border-adinn-border bg-adinn-soft">
                          <PlaceholderImage tone="day" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-adinn-muted">
                            {site.mediaCode}
                          </div>
                          <h3 className="mt-1 line-clamp-2 text-sm font-semibold leading-5 text-adinn-ink">
                            {site.title}
                          </h3>
                          <p className="mt-1 text-xs leading-5 text-adinn-muted">
                            {site.city} · {site.area} · {site.size}
                          </p>
                          {(item.tentativeStartDate || item.duration) && (
                            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-adinn-ink-2">
                              {item.tentativeStartDate && (
                                <span className="inline-flex items-center gap-1.5">
                                  <CalendarDays size={12} strokeWidth={1.75} aria-hidden="true" />
                                  {item.tentativeStartDate}
                                </span>
                              )}
                              {item.duration && <span>{item.duration}</span>}
                            </div>
                          )}
                          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs font-medium">
                            <button
                              type="button"
                              onClick={() => openSite(site.id)}
                              className="inline-flex items-center gap-1.5 text-adinn-ink transition-colors hover:text-adinn-red"
                            >
                              Details <ExternalLink size={12} strokeWidth={1.75} aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => remove(site.id)}
                              aria-label={`Remove ${site.title} from campaign plan`}
                              className="inline-flex items-center gap-1.5 text-adinn-muted transition-colors hover:text-adinn-red"
                            >
                              <Trash2 size={12} strokeWidth={1.75} aria-hidden="true" /> Remove
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {items.length > 0 && (
              <footer className="space-y-3 border-t border-adinn-border bg-white p-5">
                <p className="text-xs leading-5 text-adinn-muted">
                  Adding a location to your plan does not reserve it. Final availability and pricing will be confirmed by ADINN.
                </p>

                {confirmClear ? (
                  <div className="rounded-lg border border-adinn-border bg-adinn-warm p-3">
                    <p className="text-sm font-medium text-adinn-ink">Remove all locations from this plan?</p>
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmClear(false)}
                        className="h-9 rounded-md border border-adinn-border bg-white px-3 text-xs font-medium text-adinn-ink"
                      >
                        Keep Plan
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          clear();
                          setConfirmClear(false);
                        }}
                        className="h-9 rounded-md bg-adinn-red px-3 text-xs font-medium text-white transition-colors hover:bg-adinn-red-hover"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmClear(true)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-adinn-muted transition-colors hover:text-adinn-red"
                  >
                    <Trash2 size={13} strokeWidth={1.75} aria-hidden="true" /> Clear Plan
                  </button>
                )}

                <BrandButton className="w-full" size="lg" onClick={requestProposal}>
                  <MessageCircle size={16} strokeWidth={1.75} aria-hidden="true" /> Request Proposal
                </BrandButton>
                <button
                  type="button"
                  onClick={() => {
                    close();
                    setTimeout(() => scrollToHash("#contact"), 80);
                  }}
                  className="inline-flex h-10 w-full items-center justify-center gap-1.5 text-sm font-medium text-adinn-ink transition-colors hover:text-adinn-red"
                >
                  Or fill enquiry form <ArrowRight size={14} strokeWidth={1.75} aria-hidden="true" />
                </button>
              </footer>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
