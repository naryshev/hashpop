"use client";

import { type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { listingCta, material } from "@/lib/materials";

export type ButtonVariant = "filled" | "gray" | "destructive";

/**
 * Shared control. `filled` matches Purchase / confirm-sheet footer.
 * Labels are sentence case at the call site — no tracking shout.
 */
export function Button({
  variant = "filled",
  className,
  type = "button",
  ...props
}: { variant?: ButtonVariant } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={cn(
        variant === "filled" && listingCta.filled,
        variant === "gray" &&
          cn(
            material.regular,
            "flex h-12 w-full items-center justify-center rounded-control text-[15px] font-medium text-fg hover:bg-white/[0.12]",
          ),
        variant === "destructive" &&
          "flex h-[52px] w-full items-center justify-center rounded-control border border-danger/50 bg-danger/10 text-[15px] font-bold text-rose-300 hover:bg-danger/15 disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
      {...props}
    />
  );
}
