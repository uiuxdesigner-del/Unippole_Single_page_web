"use client";

import { useState } from "react";
import type {
  FormEvent,
  HTMLInputAutoCompleteAttribute,
} from "react";

import {
  Check,
  Mail,
  MessageCircle,
  Phone,
} from "lucide-react";

import {
  buildWhatsAppUrl,
  siteConfig,
} from "@/config/site";

const API_URL =
  "https://adinndigital.com/api/adinnunipole/index_adinnunipole.php";

const ADMIN_EMAIL =
  "uiuxdesigner@adinn.co.in";

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

type SubmitStatus =
  | {
      type: "success" | "error";
      message: string;
    }
  | null;

type ApiResponse = {
  success?: boolean;
  status?: string;
  message?: string;
};

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
  inputMode?: "text" | "email" | "tel" | "numeric";
  autoComplete?: HTMLInputAutoCompleteAttribute;
  value: string;
  placeholder?: string;
  required?: boolean;
  error?: string;
  disabled?: boolean;
  maxLength?: number;
  prefix?: string;
  onBlur?: () => void;
  onChange: (value: string) => void;
};

function sanitizeName(value: string) {
  return value
    .replace(/[^\p{L}\p{M}\s.'-]/gu, "")
    .replace(/\s{2,}/g, " ")
    .slice(0, 80);
}

function sanitizeEmail(value: string) {
  return value
    .replace(/\s/g, "")
    .slice(0, 120);
}

function sanitizePhone(value: string) {
  let digits = value.replace(/\D/g, "");

  // When a complete +91 number is pasted, remove the country code.
  if (
    digits.length > 10 &&
    digits.startsWith("91")
  ) {
    digits = digits.slice(2);
  }

  // When a number with a leading zero is pasted, remove the zero.
  if (
    digits.length > 10 &&
    digits.startsWith("0")
  ) {
    digits = digits.slice(1);
  }

  return digits.slice(0, 10);
}

function sanitizeStandardText(
  value: string,
  maxLength: number,
) {
  return value
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .slice(0, maxLength);
}

function UnderlineField({
  id,
  label,
  type = "text",
  inputMode = "text",
  autoComplete,
  value,
  placeholder,
  required = false,
  error,
  disabled = false,
  maxLength,
  prefix,
  onBlur,
  onChange,
}: FieldProps) {
  return (
    <label htmlFor={id} className="block">
      <span className="block text-xs font-medium tracking-tight text-white/75 sm:text-[13px]">
        {label}
        {required ? "*" : ""}
      </span>

      <div className="relative mt-2">
        {prefix && (
          <span className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 text-sm text-white sm:text-[15px]">
            {prefix}
          </span>
        )}

        <input
          id={id}
          name={id}
          type={type}
          inputMode={inputMode}
          autoComplete={autoComplete}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          maxLength={maxLength}
          onBlur={onBlur}
          onChange={(event) =>
            onChange(event.target.value)
          }
          className={[
            "h-11 w-full border-0 border-b bg-transparent px-0",
            "text-sm text-white outline-none transition-colors duration-300 sm:text-[15px]",
            "placeholder:text-white/30 focus:ring-0",
            "disabled:cursor-not-allowed disabled:opacity-60",
            prefix ? "pl-9" : "",
            error
              ? "border-red-500"
              : "border-white/25 focus:border-white/80",
          ].join(" ")}
        />
      </div>

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

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [submitStatus, setSubmitStatus] =
    useState<SubmitStatus>(null);

  const getFieldError = (
    key: keyof FormState,
    currentForm: FormState = form,
  ): string | undefined => {
    switch (key) {
      case "name": {
        const name =
          currentForm.name.trim();

        if (!name) {
          return "Please enter your name";
        }

        if (name.length < 2) {
          return "Name must contain at least 2 letters";
        }

        if (
          !/^[\p{L}\p{M}\s.'-]+$/u.test(
            name,
          )
        ) {
          return "Name can contain letters only";
        }

        return undefined;
      }

      case "email": {
        const email =
          currentForm.email.trim();

        if (!email) {
          return "Please enter your email address";
        }

        if (
          !/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(
            email,
          )
        ) {
          return "Enter a valid email address";
        }

        return undefined;
      }

      case "phone": {
        const phone =
          currentForm.phone.trim();

        if (!phone) {
          return "Please enter your phone number";
        }

        if (!/^\d{10}$/.test(phone)) {
          return "Enter a valid 10 digit phone number";
        }

        return undefined;
      }

      case "location": {
        const location =
          currentForm.location.trim();

        if (!location) {
          return "Please enter the project location";
        }

        if (location.length < 3) {
          return "Enter a valid project location";
        }

        return undefined;
      }

      case "unipoleType": {
        if (
          !currentForm.unipoleType.trim()
        ) {
          return "Please select a unipole type";
        }

        return undefined;
      }

      case "consent": {
        if (!currentForm.consent) {
          return "Consent is required";
        }

        return undefined;
      }

      default:
        return undefined;
    }
  };

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

    setSubmitStatus(null);

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

  const validateField = (
    key: keyof FormState,
  ) => {
    const fieldError =
      getFieldError(key);

    setErrors((current) => {
      const next = {
        ...current,
      };

      if (fieldError) {
        next[key] = fieldError;
      } else {
        delete next[key];
      }

      return next;
    });
  };

  const validate = () => {
    const requiredFields: Array<
      keyof FormState
    > = [
      "name",
      "email",
      "phone",
      "location",
      "unipoleType",
      "consent",
    ];

    const nextErrors: Partial<
      Record<keyof FormState, string>
    > = {};

    requiredFields.forEach((field) => {
      const fieldError =
        getFieldError(field);

      if (fieldError) {
        nextErrors[field] =
          fieldError;
      }
    });

    setErrors(nextErrors);

    return (
      Object.keys(nextErrors).length ===
      0
    );
  };

  const onSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setSubmitStatus(null);

    if (!validate()) {
      return;
    }

    const payload = {
      mailtype: "unipoleEnquiry",
      name: form.name.trim(),
      company: form.company.trim(),
      email: form.email
        .trim()
        .toLowerCase(),

      // Only the 10-digit number is sent.
      // The visible +91 prefix is not included.
      phone: form.phone.trim(),

      location: form.location.trim(),
      unipoleType:
        form.unipoleType.trim(),
      message: form.message.trim(),
      consent: form.consent,
      adminEmail: ADMIN_EMAIL,
    };

    try {
      setIsSubmitting(true);

      const response = await fetch(
        API_URL,
        {
          method: "POST",
          headers: {
            Accept:
              "application/json",
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify(
            payload,
          ),
        },
      );

      const responseText =
        await response.text();

      let result: ApiResponse = {};

      if (responseText) {
        try {
          result = JSON.parse(
            responseText,
          ) as ApiResponse;
        } catch {
          result = {
            message: responseText,
          };
        }
      }

      const responseStatus =
        result.status
          ?.trim()
          .toLowerCase();

      const requestFailed =
        !response.ok ||
        result.success === false ||
        responseStatus === "error" ||
        responseStatus === "failed" ||
        responseStatus === "failure";

      if (requestFailed) {
        throw new Error(
          result.message ||
            "Unable to submit your enquiry. Please try again.",
        );
      }

      setSubmitStatus({
        type: "success",
        message:
          result.message ||
          "Thank you! Your unipole enquiry has been submitted successfully.",
      });

      setForm(emptyForm);
      setErrors({});
    } catch (error) {
      setSubmitStatus({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Something went wrong. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
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

            <form
              onSubmit={onSubmit}
              noValidate
              className="grid self-start gap-x-6 gap-y-5 sm:grid-cols-2 sm:gap-y-6 lg:pt-4 xl:gap-x-8 xl:gap-y-7"
            >
              <UnderlineField
                id="name"
                label="Full name"
                required
                inputMode="text"
                autoComplete="name"
                maxLength={80}
                disabled={isSubmitting}
                value={form.name}
                error={errors.name}
                onBlur={() =>
                  validateField("name")
                }
                onChange={(value) =>
                  update(
                    "name",
                    sanitizeName(value),
                  )
                }
              />

              <UnderlineField
                id="company"
                label="Company / Business name"
                inputMode="text"
                autoComplete="organization"
                maxLength={120}
                disabled={isSubmitting}
                value={form.company}
                onChange={(value) =>
                  update(
                    "company",
                    sanitizeStandardText(
                      value,
                      120,
                    ),
                  )
                }
              />

              <UnderlineField
                id="email"
                label="Email"
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                maxLength={120}
                disabled={isSubmitting}
                value={form.email}
                error={errors.email}
                onBlur={() =>
                  validateField("email")
                }
                onChange={(value) =>
                  update(
                    "email",
                    sanitizeEmail(value),
                  )
                }
              />

              <UnderlineField
                id="phone"
                label="Phone number"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                required
                prefix="+91"
                disabled={isSubmitting}
                value={form.phone}
                error={errors.phone}
                onBlur={() =>
                  validateField("phone")
                }
                onChange={(value) =>
                  update(
                    "phone",
                    sanitizePhone(value),
                  )
                }
              />

              <UnderlineField
                id="location"
                label="Project location"
                inputMode="text"
                autoComplete="street-address"
                required
                maxLength={160}
                disabled={isSubmitting}
                value={form.location}
                placeholder="City, area or site address"
                error={errors.location}
                onBlur={() =>
                  validateField("location")
                }
                onChange={(value) =>
                  update(
                    "location",
                    sanitizeStandardText(
                      value,
                      160,
                    ),
                  )
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
                  disabled={isSubmitting}
                  onBlur={() =>
                    validateField(
                      "unipoleType",
                    )
                  }
                  onChange={(event) =>
                    update(
                      "unipoleType",
                      event.target.value,
                    )
                  }
                  className={[
                    "mt-2 h-10 w-full border-0 border-b bg-transparent px-0",
                    "text-sm outline-none transition-colors duration-300 sm:text-[15px]",
                    "focus:ring-0 disabled:cursor-not-allowed disabled:opacity-60",
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
                  disabled={isSubmitting}
                  maxLength={1500}
                  placeholder="Tell us about the site, available space, preferred size, lighting requirement or any other details."
                  onChange={(event) =>
                    update(
                      "message",
                      sanitizeStandardText(
                        event.target.value,
                        1500,
                      ),
                    )
                  }
                  className="mt-2 min-h-[118px] w-full resize-none border-0 border-b border-white/25 bg-transparent px-0 py-3 text-sm text-white outline-none transition-colors duration-300 placeholder:text-white/30 focus:border-white/80 focus:ring-0 disabled:cursor-not-allowed disabled:opacity-60 sm:text-[15px]"
                />
              </label>

              <label className="mt-4 flex items-start gap-3 text-[11px] leading-5 text-white/60 sm:col-span-2 sm:text-xs">
                <span className="relative mt-1 h-4 w-4 shrink-0">
                  <input
                    type="checkbox"
                    checked={form.consent}
                    disabled={isSubmitting}
                    onChange={(event) =>
                      update(
                        "consent",
                        event.target.checked,
                      )
                    }
                    className="peer absolute inset-0 h-4 w-4 cursor-pointer appearance-none border border-white/70 bg-transparent checked:border-white checked:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                  />

                  <Check
                    size={12}
                    strokeWidth={3}
                    aria-hidden="true"
                    className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-black opacity-0 transition-opacity peer-checked:opacity-100"
                  />
                </span>

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
                disabled={isSubmitting}
                className="mt-5 inline-flex h-12 items-center justify-center border border-white/70 px-7 text-sm font-medium text-white transition-all duration-300 hover:bg-white hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-2 sm:max-w-[360px]"
              >
                {isSubmitting
                  ? "Submitting..."
                  : "Request Site Assessment"}
              </button>

              <div
                aria-live="polite"
                className="text-[11px] leading-5 sm:col-span-2"
              >
                {submitStatus ? (
                  <p
                    role={
                      submitStatus.type ===
                      "error"
                        ? "alert"
                        : "status"
                    }
                    className={
                      submitStatus.type ===
                      "success"
                        ? "text-emerald-400"
                        : "text-red-400"
                    }
                  >
                    {submitStatus.message}
                  </p>
                ) : (
                  <p className="text-white/40">
                    Your enquiry will be sent directly
                    to the ADINN team.
                  </p>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}

export default EnquirySection;