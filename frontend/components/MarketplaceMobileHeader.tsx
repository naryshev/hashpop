"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Funnel, Search as SearchIcon, SlidersHorizontal } from "lucide-react";
import { cn } from "../lib/utils";
import { MarketplaceBrandHeader } from "./MarketplaceBrandHeader";
import { Sheet } from "./ui/Sheet";

const FILTER_DETENTS = ["medium", "large"] as const;

/** Sheet portals to document.body, so gate it to viewports below 768px. */
function useMobileSheet() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      setIsMobile(true);
      return;
    }
    const query = window.matchMedia("(max-width: 767px)");
    const apply = () => setIsMobile(query.matches);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);
  return isMobile;
}

/**
 * Marketplace chrome below 768px. Brand row is the shared marketplace header.
 * Sliders open Sort; Filter opens the sheet. Cart and Messages reuse the brand
 * row only — search and Filter stay on this route.
 */
export function MarketplaceMobileHeader({
  searchValue,
  onSearchChange,
  onSearchSubmit,
  filterOpen,
  onOpenFilters,
  onCloseFilters,
  filterCount,
  resultCount,
  onClearFilters,
  onShowResults,
  filterSheet,
  sortOpen,
  onOpenSort,
  onCloseSort,
  sortSheet,
}: {
  searchValue: string;
  onSearchChange: (value: string) => void;
  onSearchSubmit: (event: FormEvent) => void;
  filterOpen: boolean;
  onOpenFilters: () => void;
  onCloseFilters: () => void;
  filterCount: number;
  resultCount: number;
  onClearFilters: () => void;
  onShowResults: () => void;
  filterSheet: ReactNode;
  sortOpen: boolean;
  onOpenSort: () => void;
  onCloseSort: () => void;
  sortSheet: ReactNode;
}) {
  const mobileSheet = useMobileSheet();
  const filtersActive = filterCount > 0;
  return (
    <div
      data-testid="marketplace-mobile-header"
      className="mb-3 pt-[calc(env(safe-area-inset-top)+12px)] md:hidden"
    >
      <MarketplaceBrandHeader />

      <div className="mt-3 flex h-11 items-center gap-2">
        <form onSubmit={onSearchSubmit} className="min-w-0 flex-1">
          <div
            data-testid="marketplace-search-field"
            className="flex h-11 items-center rounded-[22px] border border-white/10 bg-white/[0.06] pl-[14px] backdrop-blur-md"
          >
            <SearchIcon size={20} className="shrink-0 text-white/60" aria-hidden />
            <input
              type="text"
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search Hashpop…"
              aria-label="Search Hashpop"
              className="min-w-0 flex-1 bg-transparent px-2 text-[16px] text-white placeholder:text-white/50 focus:outline-none"
            />
            <button
              type="button"
              data-testid="marketplace-sort-button"
              onClick={onOpenSort}
              aria-label="Sort"
              className="flex h-11 w-11 shrink-0 items-center justify-end pr-[14px] text-[#00ffa3]"
            >
              <SlidersHorizontal size={20} aria-hidden />
            </button>
          </div>
        </form>
        <button
          type="button"
          data-testid="marketplace-filter-button"
          onClick={onOpenFilters}
          className={cn(
            "inline-flex h-11 shrink-0 items-center gap-1.5 rounded-[22px] border bg-white/[0.06] px-[14px] text-[15px] font-semibold text-[#00ffa3] backdrop-blur-md",
            filtersActive ? "border-[#00ffa3]" : "border-[#00ffa3]/40",
          )}
        >
          <Funnel size={18} aria-hidden />
          {filtersActive ? `Filter · ${filterCount}` : "Filter"}
        </button>
      </div>

      <Sheet
        open={filterOpen && mobileSheet}
        onClose={onCloseFilters}
        detent="medium"
        detents={[...FILTER_DETENTS]}
        title="Filters"
        ariaLabel="Filters"
        footer={
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              data-testid="filter-clear"
              onClick={onClearFilters}
              className="text-[15px] font-medium text-white/80"
            >
              Clear
            </button>
            <button
              type="button"
              data-testid="filter-show"
              onClick={onShowResults}
              className="btn-mint rounded-full px-4 py-2.5 text-[15px] font-semibold"
            >
              Show {resultCount} results
            </button>
          </div>
        }
      >
        {filterSheet}
      </Sheet>

      <Sheet
        open={sortOpen && mobileSheet}
        onClose={onCloseSort}
        detent="medium"
        title="Sort"
        ariaLabel="Sort"
      >
        {sortSheet}
      </Sheet>
    </div>
  );
}
