"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Funnel } from "lucide-react";
import type { SortMode } from "../lib/marketplaceFilters";
import { cn } from "../lib/utils";

const SORTS: { id: SortMode; label: string }[] = [
  { id: "recent", label: "Recent" },
  { id: "trending", label: "Trending" },
  { id: "price-asc", label: "Price ↑" },
  { id: "price-desc", label: "Price ↓" },
];

function useDismiss(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);
  return ref;
}

/**
 * Desktop results row. Filter button is the collapsed rail at 768–1023.
 * Sort sits on the right. The marketplace is grid-only.
 */
export function MarketplaceDesktopToolbar({
  resultCount,
  sortMode,
  filterCount,
  onSort,
  onOpenFilters,
}: {
  resultCount: number;
  sortMode: SortMode;
  filterCount: number;
  onSort: (sort: SortMode) => void;
  onOpenFilters: () => void;
}) {
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useDismiss(sortOpen, () => setSortOpen(false));

  return (
    <div
      data-testid="marketplace-desktop-toolbar"
      className="mb-4 hidden items-center gap-3 md:flex"
    >
      <button
        type="button"
        data-testid="marketplace-desktop-filter"
        onClick={onOpenFilters}
        className={cn(
          "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border bg-white/[0.06] px-3.5 text-sm font-semibold text-[#00ffa3] backdrop-blur-md lg:hidden",
          filterCount > 0 ? "border-[#00ffa3]" : "border-[#00ffa3]/40",
        )}
      >
        <Funnel size={16} aria-hidden />
        {filterCount > 0 ? `Filter · ${filterCount}` : "Filter"}
      </button>
      <p data-testid="marketplace-result-count" className="text-sm text-white/70">
        {resultCount.toLocaleString()} result{resultCount === 1 ? "" : "s"}
      </p>
      <div className="ml-auto flex items-center gap-1">
        <div className="relative" ref={sortRef}>
          <button
            type="button"
            data-testid="marketplace-sort-trigger"
            aria-expanded={sortOpen}
            aria-haspopup="listbox"
            onClick={() => {
              setSortOpen((open) => !open);
            }}
            className="inline-flex h-9 items-center gap-1 rounded-full px-2.5 text-sm font-medium text-white/80 hover:bg-white/5 hover:text-white"
          >
            Sort
            <ChevronDown size={14} className={sortOpen ? "rotate-180" : ""} />
          </button>
          {sortOpen && (
            <div className="absolute right-0 top-full z-40 mt-1 w-36 rounded-xl border border-white/10 bg-[#0a0a0a] p-1.5 shadow-2xl">
              {SORTS.map((sort) => (
                <button
                  key={sort.id}
                  type="button"
                  data-testid={`desktop-sort-${sort.id}`}
                  onClick={() => {
                    setSortOpen(false);
                    onSort(sort.id);
                  }}
                  className={cn(
                    "block w-full rounded-lg px-3 py-1.5 text-left text-xs",
                    sortMode === sort.id
                      ? "bg-[#00ffa3]/10 text-[#00ffa3]"
                      : "text-white hover:bg-white/5",
                  )}
                >
                  {sort.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
