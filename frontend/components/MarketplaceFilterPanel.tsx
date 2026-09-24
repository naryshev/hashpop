"use client";

import type { AdvancedFilterDraft, ListingType, SortMode } from "../lib/marketplaceFilters";

const SORTS: { id: SortMode; label: string }[] = [
  { id: "recent", label: "Recent" },
  { id: "trending", label: "Trending" },
  { id: "price-asc", label: "Price ↑" },
  { id: "price-desc", label: "Price ↓" },
];

const TYPES: ListingType[] = ["all", "physical", "digital"];

/**
 * Shared sort + filter controls. Desktop keeps this inside the search dropdown.
 * Mobile extends it with listing type and category (the old pill rows) inside
 * the same panel, opened as a sheet.
 */
export function MarketplaceFilterPanel({
  browse,
  sortMode,
  type,
  category,
  categories,
  cities,
  draft,
  onDraft,
  onSort,
  onType,
  onCategory,
  onReset,
  onApply,
}: {
  browse: boolean;
  sortMode: SortMode;
  type: ListingType;
  category: string;
  categories: string[];
  cities: string[];
  draft: AdvancedFilterDraft;
  onDraft: (draft: AdvancedFilterDraft) => void;
  onSort: (sort: SortMode) => void;
  onType: (type: ListingType) => void;
  onCategory: (category: string) => void;
  onReset: () => void;
  onApply: () => void;
}) {
  return (
    <div data-testid="marketplace-filter-panel">
      {browse && (
        <>
          <p className="text-xs font-semibold uppercase tracking-widest text-silver">Type</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {TYPES.map((listingType) => {
              const active = type === listingType;
              return (
                <button
                  key={listingType}
                  type="button"
                  data-testid={`listing-type-${listingType}`}
                  onClick={() => onType(listingType)}
                  className={`rounded-full border px-3 py-1 text-xs capitalize transition-colors ${
                    active
                      ? "border-[#00ffa3]/40 bg-[#00ffa3]/10 text-[#00ffa3]"
                      : "border-white/10 text-silver hover:border-white/20 hover:text-white"
                  }`}
                >
                  {listingType}
                </button>
              );
            })}
          </div>
          <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-silver">
            Category
          </p>
          <div className="mt-2 flex max-h-36 flex-wrap gap-1.5 overflow-y-auto">
            {categories.map((name) => {
              const active = category === name;
              return (
                <button
                  key={name}
                  type="button"
                  data-testid={`listing-category-${name}`}
                  onClick={() => onCategory(name)}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                    active
                      ? "border-[#00ffa3]/40 bg-[#00ffa3]/10 text-[#00ffa3]"
                      : "border-white/10 text-silver hover:border-white/20 hover:text-white"
                  }`}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </>
      )}
      <p
        className={`${browse ? "mt-4" : ""} text-xs font-semibold uppercase tracking-widest text-silver`}
      >
        Sort
      </p>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        {SORTS.map((sort) => {
          const active = sortMode === sort.id;
          return (
            <button
              key={sort.id}
              type="button"
              data-testid={`sort-${sort.id}`}
              onClick={() => onSort(sort.id)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                active
                  ? "border-[#00ffa3]/40 bg-[#00ffa3]/10 text-[#00ffa3]"
                  : "border-white/10 text-silver hover:border-white/20 hover:text-white"
              }`}
            >
              {sort.label}
            </button>
          );
        })}
      </div>
      <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-silver">Filters</p>
      <div className="mt-2 space-y-3">
        <div>
          <span className="mb-1 block text-xs text-silver/70">Location</span>
          <select
            value={draft.location}
            onChange={(e) => onDraft({ ...draft, location: e.target.value })}
            className="input-frost w-full py-1.5 text-sm"
            aria-label="Location"
          >
            <option value="">All locations</option>
            {cities.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        </div>
        <div>
          <span className="mb-1 block text-xs text-silver/70">Price (HBAR)</span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              step="any"
              value={draft.minPrice}
              onChange={(e) => onDraft({ ...draft, minPrice: e.target.value })}
              placeholder="Min"
              aria-label="Minimum price"
              data-testid="filter-min-price"
              className="input-frost w-full py-1.5 text-sm"
            />
            <span className="shrink-0 text-xs text-silver/40">to</span>
            <input
              type="number"
              min="0"
              step="any"
              value={draft.maxPrice}
              onChange={(e) => onDraft({ ...draft, maxPrice: e.target.value })}
              placeholder="Max"
              aria-label="Maximum price"
              data-testid="filter-max-price"
              className="input-frost w-full py-1.5 text-sm"
            />
          </div>
        </div>
        <div>
          <span className="mb-1 block text-xs text-silver/70">Date listed</span>
          <select
            value={draft.postedWithin}
            onChange={(e) => onDraft({ ...draft, postedWithin: e.target.value })}
            className="input-frost w-full py-1.5 text-sm"
            aria-label="Date listed"
          >
            <option value="">Any time</option>
            <option value="1d">Last 24 hours</option>
            <option value="1w">Last week</option>
            <option value="1m">Last month</option>
            <option value="3m">Last 3 months</option>
            <option value="6m">Last 6 months</option>
            <option value="1y">Last year</option>
          </select>
        </div>
        <div>
          <span className="mb-1 block text-xs text-silver/70">Condition</span>
          <select
            value={draft.condition}
            onChange={(e) => onDraft({ ...draft, condition: e.target.value })}
            className="input-frost w-full py-1.5 text-sm"
            aria-label="Condition"
          >
            <option value="">Any condition</option>
            <option value="Like new">Like new</option>
            <option value="Used">Used</option>
            <option value="Refurbished">Refurbished</option>
            <option value="For parts or repair">For parts or repair</option>
          </select>
        </div>
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            data-testid="filter-reset"
            onClick={onReset}
            className="flex-1 rounded-lg border border-white/15 py-1.5 text-xs text-silver transition-colors hover:text-white"
          >
            Reset
          </button>
          <button
            type="button"
            data-testid="filter-apply"
            onClick={onApply}
            className="btn-frost-cta flex-1 py-1.5 text-xs"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
