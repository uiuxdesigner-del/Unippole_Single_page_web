"use client";

import { useState } from "react";

import {
  Mail,
  MessageCircle,
  Phone,
} from "lucide-react";

import {
  buildWhatsAppUrl,
  siteConfig,
} from "@/config/site";

interface FormState {
  name: string;
  company: string;
  email: string;
  phone: string;
  location: string;
  unipoleType: string;
  message: string;
  consent: boolean;
}

const emptyForm: FormState = {
  name: "",
  company: "",
  email: "",
  phone: "",
  location: "",
  unipoleType: "",
  message: "",
  consent: false,
};

type TextFieldKey = Exclude<
  keyof FormState,
  "consent" | "unipoleType"
>;

type FieldProps = {
  id: TextFieldKey;
  label: string;
  type?: "text" | "email" | "tel";
  value: string;
  placeholder?: string;
  required?: boolean;
  error?: string;
  onChange: (value: string) => void;
};

function UnderlineField({
  id,
  label,
  type = "text",
  value,
  placeholder,
  required = false,
  error,
  onChange,
}: FieldProps) {
  return (
    <label
      htmlFor={id}
      className="block"
    >
      <span className="block text-[12px] font-medium tracking-[-0.01em] text-white/78 sm:text-[13px]">
        {label}
        {required ? "*" : ""}
      </span>

      <input
        id={id}
        name={id}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) =>
          onChange(event.target.value)
        }
        className={[
          "mt-3 h-11 w-full border-0 border-b bg-transparent px-0",
          "text-[15px] text-white outline-none transition-colors duration-300",
          "placeholder:text-white/28",
          "focus:ring-0",
          error
            ? "border-[#e62c36]"
            : "border-white/24 focus:border-white/80",
        ].join(" ")}
      />

      <span className="mt-1.5 block min-h-4 text-[11px] text-[#ff7078]">
        {error ?? ""}
      </span>
    </label>
  );
}

export function EnquirySection() {
  const [form, setForm] =
    useState<FormState>(emptyForm);

  const [errors, setErrors] =
    useState<
      Partial<
        Record<keyof FormState, string>
      >
    >({});

  const update = <
    Key extends keyof FormState,
  >(
    key: Key,
    value: FormState[Key],
  ) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));

    setErrors((current) => {
      if (!current[key]) {
        return current;
      }

      const next = {
        ...current,
      };

      delete next[key];

      return next;
    });
  };

  const validate = () => {
    const nextErrors: Partial<
      Record<keyof FormState, string>
    > = {};

    if (!form.name.trim()) {
      nextErrors.name =
        "Please enter your name";
    }

    if (
      !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(
        form.email,
      )
    ) {
      nextErrors.email =
        "Enter a valid email address";
    }

    if (
      !/^[+\d\s\-()]{7,}$/.test(
        form.phone,
      )
    ) {
      nextErrors.phone =
        "Enter a valid phone number";
    }

    if (!form.location.trim()) {
      nextErrors.location =
        "Please enter the project location";
    }

    if (!form.unipoleType.trim()) {
      nextErrors.unipoleType =
        "Please select a unipole type";
    }

    if (!form.consent) {
      nextErrors.consent =
        "Consent is required";
    }

    setErrors(nextErrors);

    return (
      Object.keys(nextErrors).length ===
      0
    );
  };

  const onSubmit = (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (!validate()) {
      return;
    }

    const message = [
      "New Unipole Project Enquiry — ADINN UNIPOLE",
      `Name: ${form.name}`,
      form.company &&
        `Company / Business: ${form.company}`,
      `Email: ${form.email}`,
      `Phone: ${form.phone}`,
      `Project Location: ${form.location}`,
      `Unipole Type: ${form.unipoleType}`,
      form.message &&
        `\nSite / Project Details:\n${form.message}`,
    ]
      .filter(Boolean)
      .join("\n");

    window.open(
      buildWhatsAppUrl(message),
      "_blank",
      "noopener,noreferrer",
    );
  };

  return (
    <section
      id="contact"
      className="relative isolate overflow-hidden bg-[#111111] py-20 text-white md:py-24 lg:py-28"
      aria-labelledby="enquiry-title"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(circle at 25% 32%, rgba(255,255,255,0.045), transparent 34%), radial-gradient(circle at 78% 68%, rgba(255,255,255,0.03), transparent 38%), linear-gradient(120deg, #151515 0%, #101010 46%, #181818 100%)",
        }}
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.08]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='.45'/%3E%3C/svg%3E\")",
        }}
      />

      <div className="container-x">
        <div className="border-t border-white/16 pt-6 md:pt-8">
          <span className="text-[11px] font-medium uppercase tracking-[0.28em] text-white/50">
            Build with ADINN
          </span>

          <h2
            id="enquiry-title"
            className="mt-4 max-w-[1450px] text-[clamp(3.1rem,7.6vw,8.5rem)] font-semibold uppercase leading-[0.86] tracking-[-0.06em] text-[#f1f0ea]"
          >
            Build your landmark
          </h2>
        </div>

        <div className="mt-14 grid gap-14 lg:mt-18 lg:grid-cols-[0.72fr_1.28fr] lg:gap-20 xl:gap-28">
          <div>
            <p className="max-w-[430px] text-[clamp(1.65rem,2.7vw,3rem)] leading-[1.12] tracking-[-0.04em] text-[#f1f0ea]">
              <span className="mr-2 inline-block h-px w-7 translate-y-[-0.32em] bg-white/80 sm:w-9" />
              Planning a new unipole for your
              property or business? Share your
              site details and our team will guide
              you from survey to installation.
            </p>

            <p className="mt-7 max-w-[450px] text-sm leading-7 text-white/55 sm:text-[15px]">
              We support site assessment, soil
              analysis, structural planning,
              fabrication, lighting and complete
              on-site installation.
            </p>

            <div className="mt-10 space-y-4 text-sm text-white/70 sm:text-base">
              <a
                href={`tel:${siteConfig.phone}`}
                className="flex w-fit items-center gap-3 transition-colors duration-300 hover:text-white"
              >
                <Phone
                  size={17}
                  strokeWidth={1.6}
                />

                {siteConfig.phone}
              </a>

              <a
                href={`mailto:${siteConfig.email}`}
                className="flex w-fit items-center gap-3 transition-colors duration-300 hover:text-white"
              >
                <Mail
                  size={17}
                  strokeWidth={1.6}
                />

                {siteConfig.email}
              </a>

              <a
                href={buildWhatsAppUrl(
                  "Hello ADINN, I would like to discuss a new unipole project.",
                )}
                target="_blank"
                rel="noreferrer"
                className="flex w-fit items-center gap-3 transition-colors duration-300 hover:text-white"
              >
                <MessageCircle
                  size={17}
                  strokeWidth={1.6}
                />

                WhatsApp us
              </a>
            </div>
          </div>

          <form
            onSubmit={onSubmit}
            noValidate
            className="grid gap-x-5 gap-y-3 sm:grid-cols-2"
          >
            <UnderlineField
              id="name"
              label="Full name"
              required
              value={form.name}
              error={errors.name}
              onChange={(value) =>
                update("name", value)
              }
            />

            <UnderlineField
              id="company"
              label="Company / Business name"
              value={form.company}
              onChange={(value) =>
                update("company", value)
              }
            />

            <UnderlineField
              id="email"
              label="Email"
              type="email"
              required
              value={form.email}
              error={errors.email}
              onChange={(value) =>
                update("email", value)
              }
            />

            <UnderlineField
              id="phone"
              label="Phone number"
              type="tel"
              required
              value={form.phone}
              error={errors.phone}
              onChange={(value) =>
                update("phone", value)
              }
            />

            <UnderlineField
              id="location"
              label="Project location"
              required
              value={form.location}
              placeholder="City, area or site address"
              error={errors.location}
              onChange={(value) =>
                update("location", value)
              }
            />

            <label
              htmlFor="unipoleType"
              className="block"
            >
              <span className="block text-[12px] font-medium tracking-[-0.01em] text-white/78 sm:text-[13px]">
                Type of unipole*
              </span>

              <select
                id="unipoleType"
                name="unipoleType"
                value={form.unipoleType}
                onChange={(event) =>
                  update(
                    "unipoleType",
                    event.target.value,
                  )
                }
                className={[
                  "mt-3 h-11 w-full border-0 border-b bg-transparent px-0",
                  "text-[15px] outline-none transition-colors duration-300",
                  "focus:ring-0",
                  errors.unipoleType
                    ? "border-[#e62c36]"
                    : "border-white/24 focus:border-white/80",
                  form.unipoleType
                    ? "text-white"
                    : "text-white/35",
                ].join(" ")}
              >
                <option
                  value=""
                  className="bg-[#151515] text-white"
                >
                  Select type
                </option>

                <option
                  value="Standard Unipole"
                  className="bg-[#151515] text-white"
                >
                  Standard Unipole
                </option>

                <option
                  value="LED Unipole"
                  className="bg-[#151515] text-white"
                >
                  LED Unipole
                </option>

                <option
                  value="Special Signage"
                  className="bg-[#151515] text-white"
                >
                  Special Signage
                </option>
              </select>

              <span className="mt-1.5 block min-h-4 text-[11px] text-[#ff7078]">
                {errors.unipoleType ?? ""}
              </span>
            </label>

            <label
              htmlFor="message"
              className="block sm:col-span-2"
            >
              <span className="block text-[12px] font-medium tracking-[-0.01em] text-white/78 sm:text-[13px]">
                Site / Project details
              </span>

              <textarea
                id="message"
                name="message"
                value={form.message}
                placeholder="Tell us about the site, available space, preferred size, lighting requirement or any other details."
                onChange={(event) =>
                  update(
                    "message",
                    event.target.value,
                  )
                }
                className="mt-3 min-h-[130px] w-full resize-none border-0 border-b border-white/24 bg-transparent px-0 py-3 text-[15px] text-white outline-none transition-colors duration-300 placeholder:text-white/28 focus:border-white/80 focus:ring-0"
              />
            </label>

            <label className="mt-4 flex items-start gap-3 text-[12px] leading-5 text-white/64 sm:col-span-2 sm:text-[13px]">
              <input
                type="checkbox"
                checked={form.consent}
                onChange={(event) =>
                  update(
                    "consent",
                    event.target.checked,
                  )
                }
                className="mt-1 h-4 w-4 shrink-0 appearance-none border border-white/70 bg-transparent checked:border-white checked:bg-white"
              />

              <span>
                I agree to be contacted by ADINN
                regarding this unipole project
                enquiry.

                {errors.consent && (
                  <span className="mt-1 block text-[11px] text-[#ff7078]">
                    {errors.consent}
                  </span>
                )}
              </span>
            </label>

            <button
              type="submit"
              className="mt-5 inline-flex h-14 items-center justify-center border border-white/70 px-8 text-sm font-medium text-white transition-all duration-300 hover:bg-white hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 sm:col-span-2 sm:max-w-[430px]"
            >
              Request Site Assessment
            </button>

            <p className="text-[11px] leading-5 text-white/40 sm:col-span-2">
              Opens WhatsApp with your project
              details prefilled.
            </p>
          </form>
        </div>
      </div>
    </section>
  );
}