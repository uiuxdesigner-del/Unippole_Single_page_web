"use client";

import { useState } from "react";
import type { FormEvent } from "react";

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
      <span className="block text-xs font-medium tracking-tight text-white/75 sm:text-[13px]">
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
          "mt-2 h-11 w-full border-0 border-b bg-transparent px-0",
          "text-sm text-white outline-none transition-colors duration-300 sm:text-[15px]",
          "placeholder:text-white/30 focus:ring-0",
          error
            ? "border-red-500"
            : "border-white/25 focus:border-white/80",
        ].join(" ")}
      />

      <span className="mt-1 block min-h-4 text-[11px] text-red-400">
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
    event: FormEvent<HTMLFormElement>,
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
      className="relative isolate overflow-hidden bg-gradient-to-br from-[#151515] via-[#101010] to-[#181818] py-16 text-white sm:py-20 lg:min-h-[760px] lg:py-20 xl:min-h-[820px] xl:py-24"
      aria-labelledby="enquiry-title"
    >
      <div className="container-x">
        <div className="border-t border-white/15 pt-8 lg:pt-10">
          <div className="grid items-start gap-14 lg:grid-cols-[0.82fr_1.18fr] lg:gap-20 xl:gap-28">
            {/* Left content */}
            <div className="max-w-[620px]">
              <span className="text-[10px] font-medium uppercase tracking-[0.24em] text-white/50 sm:text-[11px]">
                Build with ADINN
              </span>

              <h2
                id="enquiry-title"
                className="mt-3 max-w-[620px] text-[clamp(3rem,5vw,6rem)] font-semibold uppercase leading-[0.88] tracking-[-0.055em] text-[#f1f0ea]"
              >
                Build your landmark
              </h2>

              <p className="mt-10 max-w-[430px] text-[clamp(1.35rem,1.8vw,1.9rem)] leading-[1.22] tracking-[-0.03em] text-[#f1f0ea] sm:mt-12">
                Planning a new unipole? Share your
                site details, and our team will guide
                you from survey to installation.
              </p>

              <div className="mt-10 space-y-4 text-sm text-white/70 sm:text-[15px]">
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

            {/* Right form */}
            <form
              onSubmit={onSubmit}
              noValidate
              className="grid self-start gap-x-6 gap-y-5 sm:grid-cols-2 sm:gap-y-6 lg:pt-4 xl:gap-x-8 xl:gap-y-7"
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
                <span className="block text-xs font-medium tracking-tight text-white/75 sm:text-[13px]">
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
                    "mt-2 h-10 w-full border-0 border-b bg-transparent px-0",
                    "text-sm outline-none transition-colors duration-300 sm:text-[15px]",
                    "focus:ring-0",
                    errors.unipoleType
                      ? "border-red-500"
                      : "border-white/25 focus:border-white/80",
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

                <span className="mt-1 block min-h-4 text-[11px] text-red-400">
                  {errors.unipoleType ?? ""}
                </span>
              </label>

              <label
                htmlFor="message"
                className="block sm:col-span-2"
              >
                <span className="block text-xs font-medium tracking-tight text-white/75 sm:text-[13px]">
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
                  className="mt-2 min-h-[118px] w-full resize-none border-0 border-b border-white/25 bg-transparent px-0 py-3 text-sm text-white outline-none transition-colors duration-300 placeholder:text-white/30 focus:border-white/80 focus:ring-0 sm:text-[15px]"
                />
              </label>

              <label className="mt-4 flex items-start gap-3 text-[11px] leading-5 text-white/60 sm:col-span-2 sm:text-xs">
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
                    <span className="mt-1 block text-[11px] text-red-400">
                      {errors.consent}
                    </span>
                  )}
                </span>
              </label>

              <button
                type="submit"
                className="mt-5 inline-flex h-12 items-center justify-center border border-white/70 px-7 text-sm font-medium text-white transition-all duration-300 hover:bg-white hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 sm:col-span-2 sm:max-w-[360px]"
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
      </div>
    </section>
  );
}