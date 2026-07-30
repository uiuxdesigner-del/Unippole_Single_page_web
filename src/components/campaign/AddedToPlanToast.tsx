"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Info, X } from "lucide-react";
import { useCampaignPlan } from "@/context/CampaignPlanContext";

export function AddedToPlanToast() {
  const { toast, dismissToast, resolve, open } = useCampaignPlan();
  const u = toast ? resolve(toast.siteId) : null;

  return (
    <div aria-live="polite" aria-atomic="true" className="fixed bottom-4 inset-x-0 z-[70] pointer-events-none flex justify-center px-4">
      <AnimatePresence>
        {toast && u && (
          <motion.div
            key={toast.key}
            initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="pointer-events-auto max-w-md w-full rounded-lg border border-adinn-border bg-white shadow-sm p-3.5 flex items-start gap-3"
            role="status"
          >
            {toast.duplicate
              ? <Info size={18} strokeWidth={1.75} className="text-adinn-ink-2 mt-0.5 shrink-0" />
              : <CheckCircle2 size={18} strokeWidth={1.75} className="text-adinn-red mt-0.5 shrink-0" />}
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-adinn-ink">
                {toast.duplicate ? "Already in Campaign Plan" : "Added to Plan"}
              </div>
              <div className="text-xs text-adinn-muted truncate">{u.title} · {u.city}, {u.area}</div>
              <div className="mt-2 flex items-center gap-3 text-xs font-medium">
                <button onClick={() => { dismissToast(); open(); }} className="text-adinn-ink hover:text-adinn-red">View Plan</button>
                <button onClick={dismissToast} className="text-adinn-muted hover:text-adinn-ink">Continue Browsing</button>
              </div>
            </div>
            <button onClick={dismissToast} aria-label="Dismiss" className="text-adinn-muted hover:text-adinn-ink shrink-0">
              <X size={14} strokeWidth={1.75} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
