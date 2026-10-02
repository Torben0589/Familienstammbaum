"use client";

import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger";
}

export function Button({ variant = "primary", className, children, ...rest }: ButtonProps) {
  const base =
    variant === "primary"
      ? "glow-button"
      : variant === "danger"
      ? "inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-2.5 font-medium text-white bg-gradient-to-br from-rose-400 to-rose-600 shadow-glow hover:shadow-glow-lg transition-shadow active:scale-[0.98]"
      : "glow-button-secondary";

  return (
    <button className={cn(base, className)} {...rest}>
      {children}
    </button>
  );
}
