"use client";

import { cn } from "../lib/utils";
import { material } from "../lib/materials";
import { formatPriceForDisplay } from "../lib/formatPrice";
import type { ListingVariant } from "../lib/listingVariants";

export function ListingVariantPicker({
  variants,
  selectedId,
  onSelect,
}: {
  variants: ListingVariant[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (variants.length === 0) return null;
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-white/50">Options</h3>
      <div className="flex flex-col gap-2">
        {variants.map((v) => {
          const active = v.id === selectedId;
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => onSelect(v.id)}
              aria-pressed={active}
              className={cn(
                material.regular,
                "flex w-full items-center justify-between gap-3 rounded-[14px] px-3.5 py-3 text-left transition-colors",
                active
                  ? "border-[#00ffa3]/50 bg-[#00ffa3]/10 text-chrome"
                  : "text-white hover:bg-white/[0.08]",
              )}
            >
              <span className="min-w-0 truncate text-sm font-semibold">{v.label}</span>
              <span className="shrink-0 font-mono text-sm">{formatPriceForDisplay(v.price)} ℏ</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
