"use client";

import { siteConfig, buildWhatsAppUrl } from "@/config/site";
import { Instagram, Linkedin, Facebook, Mail, Phone, MessageCircle } from "lucide-react";
import { scrollToHash } from "@/hooks/useLenis";

export function FooterSection() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-adinn-border bg-adinn-warm">
      <div className="container-x py-16 grid gap-10 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-sm bg-adinn-red text-white font-bold">A</span>
            <span className="text-lg font-semibold text-adinn-ink">ADINN <span className="text-adinn-muted font-normal">| UNIPOLE</span></span>
          </div>
          <p className="mt-4 text-sm text-adinn-ink-2 max-w-md leading-relaxed">
            {siteConfig.product} by {siteConfig.company}. Curated large-format outdoor advertising
            across major Indian cities — designed to keep your brand visible.
          </p>
          <div className="mt-6 flex items-center gap-3">
            <a href={siteConfig.social.instagram} aria-label="Instagram" className="h-9 w-9 grid place-items-center rounded-md border border-adinn-border text-adinn-ink-2 hover:text-adinn-ink hover:bg-white"><Instagram size={16} strokeWidth={1.75} /></a>
            <a href={siteConfig.social.linkedin} aria-label="LinkedIn" className="h-9 w-9 grid place-items-center rounded-md border border-adinn-border text-adinn-ink-2 hover:text-adinn-ink hover:bg-white"><Linkedin size={16} strokeWidth={1.75} /></a>
            <a href={siteConfig.social.facebook} aria-label="Facebook" className="h-9 w-9 grid place-items-center rounded-md border border-adinn-border text-adinn-ink-2 hover:text-adinn-ink hover:bg-white"><Facebook size={16} strokeWidth={1.75} /></a>
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-widest text-adinn-muted mb-4">Explore</div>
          <ul className="space-y-2.5 text-sm">
            {siteConfig.nav.map((n) => (
              <li key={n.href}>
                <a href={n.href} onClick={(e) => { e.preventDefault(); scrollToHash(n.href); }} className="text-adinn-ink-2 hover:text-adinn-ink">{n.label}</a>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="text-xs uppercase tracking-widest text-adinn-muted mb-4">Contact</div>
          <ul className="space-y-2.5 text-sm">
            <li><a href={`tel:${siteConfig.phone}`} className="inline-flex items-center gap-2 text-adinn-ink-2 hover:text-adinn-ink"><Phone size={14} strokeWidth={1.75} />{siteConfig.phone}</a></li>
            <li><a href={`mailto:${siteConfig.email}`} className="inline-flex items-center gap-2 text-adinn-ink-2 hover:text-adinn-ink"><Mail size={14} strokeWidth={1.75} />{siteConfig.email}</a></li>
            <li><a href={buildWhatsAppUrl("Hello ADINN")} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-adinn-ink-2 hover:text-adinn-ink"><MessageCircle size={14} strokeWidth={1.75} />WhatsApp</a></li>
            <li className="text-adinn-muted">{siteConfig.address}</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-adinn-border">
        <div className="container-x py-6 flex flex-wrap items-center justify-between gap-4 text-xs text-adinn-muted">
          <div>© {year} {siteConfig.company}. All rights reserved.</div>
          <div className="flex items-center gap-5">
            <a href="#" className="hover:text-adinn-ink">Privacy</a>
            <a href="#" className="hover:text-adinn-ink">Terms</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
