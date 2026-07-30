"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  X,
  MapPin,
  Ruler,
  Sun,
  Compass,
  Users,
  Calendar,
  IndianRupee,
  MessageCircle,
  Share2,
  Plus,
  Check,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Bookmark,
} from "lucide-react";
import { unipoles } from "@/data/unipoles";
import { availabilityLabel, illuminationLabel } from "@/lib/inventory";
import { PlaceholderImage } from "@/components/ui/PlaceholderImage";
import { BrandButton } from "@/components/ui/BrandButton";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { lockScroll, scrollToHash, unlockScroll } from "@/hooks/useLenis";
import { useCampaignPlan } from "@/context/CampaignPlanContext";
import { buildWhatsAppUrl } from "@/config/site";

function readSiteFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  return new URL(window.location.href).searchParams.get("site");
}

export function ProductModal() {
  const [siteId, setSiteId] = useState<string | null>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [shortlisted, setShortlisted] = useState(false);
  const [tentativeDate, setTentativeDate] = useState("");
  const [duration, setDuration] = useState("");
  const [shareStatus, setShareStatus] = useState("");
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const { add, has, open: openPlan, close: closePlan } = useCampaignPlan();

  const site = siteId ? unipoles.find((item) => item.id === siteId) : undefined;
  const isOpen = Boolean(site);
  useFocusTrap(isOpen, dialogRef);

  const close = useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete("site");
    window.history.replaceState({}, "", url);
    setSiteId(null);
  }, []);

  useEffect(() => {
    const syncWithUrl = () => {
      const id = readSiteFromUrl();
      const valid = id ? unipoles.some((item) => item.id === id) : false;
      setSiteId(valid ? id : null);
      setGalleryIndex(0);
      setTentativeDate("");
      setDuration("");
      setShareStatus("");
    };

    const closeFromOverlayTransition = () => close();

    syncWithUrl();
    window.addEventListener("popstate", syncWithUrl);
    window.addEventListener("adinn:close-product-modal", closeFromOverlayTransition);
    return () => {
      window.removeEventListener("popstate", syncWithUrl);
      window.removeEventListener("adinn:close-product-modal", closeFromOverlayTransition);
    };
  }, [close]);

  useEffect(() => {
    if (!isOpen) return;
    closePlan();
    lockScroll();
    return () => unlockScroll();
  }, [isOpen, closePlan]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }

      const target = event.target as HTMLElement | null;
      if (target?.matches("input, select, textarea")) return;
      if (event.key === "ArrowRight") setGalleryIndex((current) => current + 1);
      if (event.key === "ArrowLeft") setGalleryIndex((current) => current - 1);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, close]);

  if (!site) return null;

  const tones: Array<"day" | "night"> = ["day", "night", "day"];
  const activeImage = ((galleryIndex % tones.length) + tones.length) % tones.length;
  const added = has(site.id);

  const handleShare = async () => {
    const shareData = {
      title: `${site.mediaCode} — ${site.title}`,
      text: `${site.title}, ${site.city} — ADINN UNIPOLE`,
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        setShareStatus("Shared");
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(window.location.href);
        setShareStatus("Link copied");
      } else {
        setShareStatus("Copy the URL from your browser");
      }
    } catch {
      setShareStatus("");
    }
  };

  const addToPlan = () => {
    add(site.id, {
      tentativeStartDate: tentativeDate || undefined,
      duration: duration || undefined,
    });
  };

  const openContact = () => {
    close();
    setTimeout(() => scrollToHash("#contact"), 80);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.button
            type="button"
            aria-label="Close site details"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[65] cursor-default bg-adinn-ink/50 backdrop-blur-sm"
            onClick={close}
          />

          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.99 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-[66] flex items-start justify-center overflow-y-auto p-0 sm:items-center sm:p-6"
          >
            <div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="site-title"
              aria-describedby="site-description"
              className="min-h-screen w-full overflow-hidden border-adinn-border bg-white sm:max-h-[90vh] sm:min-h-0 sm:max-w-6xl sm:rounded-2xl sm:border sm:shadow-[0_24px_80px_rgba(17,17,17,0.16)]"
            >
              <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-adinn-border bg-white/95 px-5 backdrop-blur sm:px-6">
                <div>
                  <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-adinn-muted">
                    {site.mediaCode}
                  </div>
                  <div className="mt-0.5 text-xs text-adinn-ink-2 sm:hidden">{site.city} · {site.area}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span aria-live="polite" className="hidden text-xs text-adinn-muted sm:inline">
                    {shareStatus}
                  </span>
                  <button
                    type="button"
                    aria-label="Share site"
                    onClick={handleShare}
                    className="grid h-10 w-10 place-items-center rounded-md border border-adinn-border text-adinn-ink transition-colors hover:bg-adinn-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-adinn-ink/40"
                  >
                    <Share2 size={16} strokeWidth={1.75} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-pressed={shortlisted}
                    aria-label={shortlisted ? "Remove from shortlist" : "Add to shortlist"}
                    onClick={() => setShortlisted((current) => !current)}
                    className={`inline-flex h-10 items-center gap-2 rounded-md border px-3 text-xs font-medium transition-colors ${
                      shortlisted
                        ? "border-adinn-red bg-adinn-soft-red text-adinn-red"
                        : "border-adinn-border text-adinn-ink-2 hover:bg-adinn-soft"
                    }`}
                  >
                    <Bookmark size={15} strokeWidth={1.75} aria-hidden="true" />
                    <span className="hidden sm:inline">{shortlisted ? "Shortlisted" : "Shortlist"}</span>
                  </button>
                  <button
                    type="button"
                    aria-label="Close"
                    onClick={close}
                    className="grid h-10 w-10 place-items-center rounded-md border border-adinn-border text-adinn-ink transition-colors hover:bg-adinn-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-adinn-ink/40"
                  >
                    <X size={17} strokeWidth={1.75} aria-hidden="true" />
                  </button>
                </div>
              </header>

              <div className="grid sm:max-h-[calc(90vh-4rem)] md:grid-cols-[1.15fr_0.85fr]">
                <div className="relative min-h-[320px] border-b border-adinn-border bg-adinn-soft md:min-h-[620px] md:border-b-0 md:border-r">
                  <PlaceholderImage tone={tones[activeImage]} label={tones[activeImage] === "night" ? "Night view" : "Day view"} />

                  <button
                    type="button"
                    onClick={() => setGalleryIndex((current) => current - 1)}
                    aria-label="Previous image"
                    className="absolute left-4 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-adinn-border bg-white/90 text-adinn-ink backdrop-blur transition-colors hover:bg-white"
                  >
                    <ChevronLeft size={18} strokeWidth={1.75} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setGalleryIndex((current) => current + 1)}
                    aria-label="Next image"
                    className="absolute right-4 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-adinn-border bg-white/90 text-adinn-ink backdrop-blur transition-colors hover:bg-white"
                  >
                    <ChevronRight size={18} strokeWidth={1.75} aria-hidden="true" />
                  </button>

                  <div className="absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-full border border-adinn-border bg-white/95 px-3 py-1.5 text-xs font-medium text-adinn-ink backdrop-blur">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        site.status === "available"
                          ? "bg-emerald-600"
                          : site.status === "upcoming"
                            ? "bg-amber-500"
                            : "bg-adinn-muted"
                      }`}
                      aria-hidden="true"
                    />
                    {availabilityLabel(site.status)}
                  </div>
                  <div className="absolute bottom-4 right-4 rounded-full border border-adinn-border bg-white/95 px-3 py-1.5 text-xs text-adinn-muted backdrop-blur">
                    {activeImage + 1} / {tones.length}
                  </div>
                </div>

                <div className="overflow-y-auto p-5 pb-28 sm:p-7 sm:pb-28 md:p-8">
                  <h2 id="site-title" className="text-h3 text-adinn-ink">
                    {site.title}
                  </h2>
                  <p id="site-description" className="mt-2 flex items-start gap-2 text-sm leading-6 text-adinn-muted">
                    <MapPin size={15} strokeWidth={1.75} className="mt-1 shrink-0" aria-hidden="true" />
                    {site.city}, {site.state} · {site.area} · {site.roadName}
                  </p>

                  <dl className="mt-7 grid grid-cols-2 gap-x-5 gap-y-5 border-y border-adinn-border py-6 text-sm">
                    <div>
                      <dt className="text-[10px] font-medium uppercase tracking-[0.18em] text-adinn-muted">Size</dt>
                      <dd className="mt-1.5 flex items-center gap-2 text-adinn-ink"><Ruler size={14} strokeWidth={1.75} />{site.size}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-medium uppercase tracking-[0.18em] text-adinn-muted">Illumination</dt>
                      <dd className="mt-1.5 flex items-center gap-2 text-adinn-ink"><Sun size={14} strokeWidth={1.75} />{illuminationLabel(site.illumination)}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-medium uppercase tracking-[0.18em] text-adinn-muted">Facing</dt>
                      <dd className="mt-1.5 flex items-center gap-2 text-adinn-ink"><Compass size={14} strokeWidth={1.75} />{site.facing}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-medium uppercase tracking-[0.18em] text-adinn-muted">Visibility</dt>
                      <dd className="mt-1.5 text-adinn-ink">{site.visibilityDistance}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-medium uppercase tracking-[0.18em] text-adinn-muted">Display</dt>
                      <dd className="mt-1.5 text-adinn-ink">{site.displaySides} side{site.displaySides === 1 ? "" : "s"}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-medium uppercase tracking-[0.18em] text-adinn-muted">Minimum duration</dt>
                      <dd className="mt-1.5 text-adinn-ink">{site.minimumCampaignDuration}</dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-[10px] font-medium uppercase tracking-[0.18em] text-adinn-muted">Audience</dt>
                      <dd className="mt-1.5 flex items-start gap-2 leading-6 text-adinn-ink-2"><Users size={14} strokeWidth={1.75} className="mt-1 shrink-0" />{site.audience ?? "General commuters"}</dd>
                    </div>
                  </dl>

                  <div className="mt-7">
                    <h3 className="text-sm font-semibold text-adinn-ink">Tentative campaign plan</h3>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2 md:grid-cols-1 xl:grid-cols-2">
                      <label className="block">
                        <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.18em] text-adinn-muted">Start date</span>
                        <div className="flex w-full min-w-0 items-center rounded-md border border-adinn-border bg-white px-3 py-2.5">
                          <Calendar size={14} strokeWidth={1.75} className="mr-2 shrink-0 text-adinn-muted" />
                          <input
                            type="date"
                            value={tentativeDate}
                            onChange={(event) => setTentativeDate(event.target.value)}
                            className="block w-full min-w-0 border-0 bg-transparent p-0 text-sm text-adinn-ink outline-none"
                          />
                        </div>
                      </label>
                      <label className="block">
                        <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.18em] text-adinn-muted">Duration</span>
                        <select
                          value={duration}
                          onChange={(event) => setDuration(event.target.value)}
                          className="h-11 w-full rounded-md border border-adinn-border bg-white px-3 text-sm text-adinn-ink outline-none focus:border-adinn-border-strong"
                        >
                          <option value="">Select duration</option>
                          <option value="7 days">7 days</option>
                          <option value="15 days">15 days</option>
                          <option value="30 days">30 days</option>
                          <option value="Custom enquiry">Custom enquiry</option>
                        </select>
                      </label>
                    </div>
                    <p className="mt-3 text-xs leading-5 text-adinn-muted">
                      Selecting a date does not reserve this location. Final availability will be confirmed by the ADINN team.
                    </p>
                  </div>

                  <div className="mt-7 border-t border-adinn-border pt-6">
                    <div className="flex items-center gap-2 text-base font-semibold text-adinn-ink">
                      <IndianRupee size={16} strokeWidth={1.75} aria-hidden="true" />
                      Price on Request
                    </div>
                    <p className="mt-2 text-xs leading-5 text-adinn-muted">
                      Final pricing may vary based on dates, availability, printing, illumination and local approval requirements.
                    </p>
                  </div>

                  <div className="mt-7 flex flex-wrap gap-2">
                    <BrandButton onClick={addToPlan}>
                      {added ? <Check size={15} strokeWidth={2} /> : <Plus size={15} strokeWidth={2} />}
                      {added ? "Update Campaign Plan" : "Add to Campaign"}
                    </BrandButton>
                    <BrandButton
                      variant="secondary"
                      onClick={() =>
                        window.open(
                          buildWhatsAppUrl(
                            `Hello ADINN, I would like a quote for ${site.mediaCode} — ${site.title}${tentativeDate ? ` from ${tentativeDate}` : ""}${duration ? ` for ${duration}` : ""}.`,
                          ),
                          "_blank",
                          "noopener,noreferrer",
                        )
                      }
                    >
                      <MessageCircle size={15} strokeWidth={1.75} aria-hidden="true" />
                      WhatsApp
                    </BrandButton>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-x-5 gap-y-3 border-t border-adinn-border pt-5 text-xs font-medium">
                    <button type="button" onClick={openContact} className="text-adinn-ink-2 transition-colors hover:text-adinn-red">Request Quote →</button>
                    <button type="button" onClick={openContact} className="text-adinn-ink-2 transition-colors hover:text-adinn-red">Schedule Site Visit →</button>
                    <button type="button" onClick={() => { close(); setTimeout(openPlan, 80); }} className="text-adinn-ink-2 transition-colors hover:text-adinn-red">Open Campaign Plan →</button>
                    {site.mapUrl && (
                      <a href={site.mapUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-adinn-ink-2 transition-colors hover:text-adinn-red">
                        <ExternalLink size={13} strokeWidth={1.75} aria-hidden="true" />
                        View on Maps
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
