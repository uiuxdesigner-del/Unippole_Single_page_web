"use client";

import { useState } from "react";
import { BrandButton } from "@/components/ui/BrandButton";
import { siteConfig, buildWhatsAppUrl } from "@/config/site";
import { useCampaignPlan } from "@/context/CampaignPlanContext";
import { MessageCircle, Mail, Phone } from "lucide-react";

interface FormState {
  name: string; company: string; email: string; phone: string; city: string;
  requirement: string; startDate: string; duration: string; message: string; consent: boolean;
}

const empty: FormState = {
  name: "", company: "", email: "", phone: "", city: "", requirement: "",
  startDate: "", duration: "", message: "", consent: false,
};

export function EnquirySection() {
  const [form, setForm] = useState<FormState>(empty);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const { items, resolve } = useCampaignPlan();

  const update = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((s) => ({ ...s, [k]: v }));

  const validate = () => {
    const e: typeof errors = {};
    if (!form.name.trim()) e.name = "Please enter your name";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) e.email = "Enter a valid email";
    if (!/^[+\d\s\-()]{7,}$/.test(form.phone)) e.phone = "Enter a valid phone";
    if (!form.city.trim()) e.city = "Enter city";
    if (!form.requirement.trim()) e.requirement = "Tell us your requirement";
    if (!form.consent) e.consent = "Consent is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const plan = items.map((i) => resolve(i.siteId)).filter(Boolean)
      .map((u) => `• ${u!.mediaCode} — ${u!.title} (${u!.city})`).join("\n");
    const msg = [
      `New Campaign Enquiry — ADINN UNIPOLE`,
      `Name: ${form.name}`,
      form.company && `Company: ${form.company}`,
      `Email: ${form.email}`,
      `Phone: ${form.phone}`,
      `City: ${form.city}`,
      `Requirement: ${form.requirement}`,
      form.startDate && `Start Date: ${form.startDate}`,
      form.duration && `Duration: ${form.duration}`,
      plan && `\nSelected Locations:\n${plan}`,
      form.message && `\nMessage: ${form.message}`,
    ].filter(Boolean).join("\n");
    window.open(buildWhatsAppUrl(msg), "_blank");
  };

  const err = (k: keyof FormState) => errors[k] && <span className="mt-1 block text-xs text-adinn-red">{errors[k]}</span>;
  const inp = "w-full h-11 rounded-md border border-adinn-border bg-white px-3 text-sm text-adinn-ink focus:outline-none focus:ring-2 focus:ring-adinn-ink/20";
  const lab = "block text-xs uppercase tracking-widest text-adinn-muted mb-1.5";

  return (
    <section id="contact" className="py-20 md:py-28 bg-white">
      <div className="container-x grid gap-12 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
        <div>
          <span className="text-xs uppercase tracking-[0.25em] text-adinn-red font-medium">Enquiry</span>
          <h2 className="mt-3 text-h2 text-adinn-ink">
            Request a campaign proposal.
          </h2>
          <p className="mt-4 text-adinn-ink-2 max-w-md leading-relaxed">
            Share your requirement and shortlisted sites. Our team will get back with a tailored
            proposal, pricing and site visit options.
          </p>
          <div className="mt-8 space-y-3 text-sm">
            <a href={`tel:${siteConfig.phone}`} className="flex items-center gap-3 text-adinn-ink hover:text-adinn-red"><Phone size={16} strokeWidth={1.75} />{siteConfig.phone}</a>
            <a href={`mailto:${siteConfig.email}`} className="flex items-center gap-3 text-adinn-ink hover:text-adinn-red"><Mail size={16} strokeWidth={1.75} />{siteConfig.email}</a>
            <a href={buildWhatsAppUrl("Hello ADINN, I would like to enquire about UNIPOLE advertising.")} target="_blank" rel="noreferrer"
              className="flex items-center gap-3 text-adinn-ink hover:text-adinn-red"><MessageCircle size={16} strokeWidth={1.75} />WhatsApp us</a>
          </div>
          {items.length > 0 && (
            <div className="mt-8 rounded-lg border border-adinn-border bg-adinn-warm p-4">
              <div className="text-xs uppercase tracking-widest text-adinn-muted">Selected locations</div>
              <div className="mt-1 text-sm font-medium text-adinn-ink">{items.length} site{items.length === 1 ? "" : "s"} in your campaign plan</div>
            </div>
          )}
        </div>
        <form onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
          <label><span className={lab}>Full Name*</span><input className={inp} value={form.name} onChange={(e) => update("name", e.target.value)} />{err("name")}</label>
          <label><span className={lab}>Company</span><input className={inp} value={form.company} onChange={(e) => update("company", e.target.value)} /></label>
          <label><span className={lab}>Email*</span><input type="email" className={inp} value={form.email} onChange={(e) => update("email", e.target.value)} />{err("email")}</label>
          <label><span className={lab}>Phone*</span><input type="tel" className={inp} value={form.phone} onChange={(e) => update("phone", e.target.value)} />{err("phone")}</label>
          <label><span className={lab}>City*</span><input className={inp} value={form.city} onChange={(e) => update("city", e.target.value)} />{err("city")}</label>
          <label><span className={lab}>Duration</span><input className={inp} placeholder="e.g. 30 days" value={form.duration} onChange={(e) => update("duration", e.target.value)} /></label>
          <label><span className={lab}>Campaign Requirement*</span><input className={inp} placeholder="Brand, category, objective" value={form.requirement} onChange={(e) => update("requirement", e.target.value)} />{err("requirement")}</label>
          <label><span className={lab}>Preferred Start Date</span><input type="date" className={inp} value={form.startDate} onChange={(e) => update("startDate", e.target.value)} /></label>
          <label className="sm:col-span-2"><span className={lab}>Message</span>
            <textarea className={`${inp} h-28 py-2.5 resize-none`} value={form.message} onChange={(e) => update("message", e.target.value)} />
          </label>
          <label className="sm:col-span-2 flex items-start gap-3 text-sm text-adinn-ink-2">
            <input type="checkbox" className="mt-1" checked={form.consent} onChange={(e) => update("consent", e.target.checked)} />
            <span>I agree to be contacted by ADINN about my enquiry. {err("consent")}</span>
          </label>
          <div className="sm:col-span-2 flex flex-wrap items-center gap-3 pt-2">
            <BrandButton type="submit" size="lg">Request Campaign Proposal</BrandButton>
            <span className="text-xs text-adinn-muted">Opens WhatsApp with your details prefilled.</span>
          </div>
        </form>
      </div>
    </section>
  );
}
