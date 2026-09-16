"use client";

import { cn } from "@/lib/utils";
import { dockBadgeIsPill, formatDockBadgeCount } from "@/lib/dockBadge";

export type DockBadgeSize = "dock" | "compact";

export type DockBadgeProps = {
  count?: number;
  className?: string;
  /** `dock` = 24px TabBar icons; `compact` = 16–20px desktop header icons. */
  size?: DockBadgeSize;
};

/**
 * Mint dock badge. Hide at 0. Cap at `9+`.
 * Dock: top-trailing on a 24px icon (~top -2 / right -4), min 16×16.
 * Compact: tighter on 16–20px header icons (~top -1 / right -2), min 14×14.
 */
export function DockBadge({ count = 0, className, size = "dock" }: DockBadgeProps) {
  const label = formatDockBadgeCount(count);
  if (!label) return null;
  const pill = dockBadgeIsPill(label);
  const compact = size === "compact";
  return (
    <span
      data-dock-badge=""
      data-dock-badge-size={size}
      aria-hidden
      className={cn(
        "pointer-events-none absolute flex items-center justify-center rounded-full bg-[#00ffa3] font-bold tabular-nums leading-none text-[#0a0e14]",
        compact
          ? "h-3.5 min-h-3.5 min-w-3.5 -top-px -right-0.5 text-[8px]"
          : "h-4 min-h-4 min-w-4 -top-0.5 -right-1 text-[9px]",
        pill ? (compact ? "px-0.5" : "px-1") : null,
        className,
      )}
    >
      {label}
    </span>
  );
}
