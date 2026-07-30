"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md" | "lg";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variantMap: Record<Variant, string> = {
  primary: "bg-adinn-red text-white hover:bg-adinn-red-hover focus-visible:ring-adinn-red/40",
  secondary: "bg-white text-adinn-ink border border-adinn-border hover:bg-adinn-soft focus-visible:ring-adinn-ink/20",
  ghost: "bg-transparent text-adinn-ink hover:bg-adinn-soft focus-visible:ring-adinn-ink/20",
};
const sizeMap: Record<Size, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-6 text-base",
};

export const BrandButton = forwardRef<HTMLButtonElement, Props>(function BrandButton(
  { variant = "primary", size = "md", className, ...rest }, ref,
) {
  return (
    <button
      ref={ref}
      {...rest}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:opacity-50 disabled:cursor-not-allowed",
        variantMap[variant], sizeMap[size], className,
      )}
    />
  );
});