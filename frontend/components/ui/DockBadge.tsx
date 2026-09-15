"use client";

import { cn } from "@/lib/utils";
import { dockBadgeIsPill, formatDockBadgeCount } from "@/lib/dockBadge";

export type DockBadgeProps = {
  count?: number;
  className?: string;
};

/**
 * Mint dock badge. Hide at 0. Cap at `9+`. Sits top-trailing on a 24px icon
 * (~top -2 / right -4).
 */
export function DockBadge({ count = 0, className }: DockBadgeProps) {
  const label = formatDockBadgeCount(count);
  if (!label) return null;
  const pill = dockBadgeIsPill(label);
  return (
    <span
      data-dock-badge=""
      aria-hidden
      className={cn(
        "pointer-events-none absolute -top-0.5 -right-1 flex h-4 min-h-4 min-w-4 items-center justify-center bg-[#00ffa3] text-[9px] font-bold tabular-nums leading-none text-[#0a0e14]",
        pill ? "rounded-full px-1" : "rounded-full",
        className,
      )}
    >
      {label}
    </span>
  );
}
