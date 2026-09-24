"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, MapPin } from "lucide-react";
import type { ListingType } from "../lib/marketplaceFilters";
import { cn } from "../lib/utils";

/** Scale shown in the Browse Rail lock. Expands only when a listing costs more. */
export const RAIL_PRICE_CEILING = 500;

/** Same condition values the mobile filter sheet writes to `condition`. */
export const RAIL_CONDITIONS = ["Like new", "Used", "Refurbished", "For parts or repair"] as const;

const TYPES: { id: ListingType; label: string }[] = [
  { id: "all", label: "All" },
  { id: "physical", label: "Physical" },
  { id: "digital", label: "Digital" },
];

export function priceBoundsToParams(
  min: number,
  max: number,
  ceiling: number,
): { minPrice: string; maxPrice: string } {
  const lo = Math.max(0, Math.min(min, max, ceiling));
  const hi = Math.max(lo, Math.min(Math.max(min, max), ceiling));
  return {
    minPrice: lo <= 0 ? "" : String(lo),
    maxPrice: hi >= ceiling ? "" : String(hi),
  };
}

function clampPrice(value: string, fallback: number, ceiling: number): number {
  if (value.trim() === "") return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(ceiling, n));
}

function FieldLabel({ children }: { children: string }) {
  return <p className="text-[13px] font-medium text-white/90">{children}</p>;
}

function RailSelect({
  label,
  value,
  onChange,
  children,
  icon,
  testId,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  icon?: React.ReactNode;
  testId: string;
}) {
  return (
    <div className="relative">
      {icon ? (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/70">
          {icon}
        </span>
      ) : null}
      <select
        data-testid={testId}
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-11 w-full appearance-none rounded-xl border border-white/10 bg-white/[0.04] pr-9 text-sm text-white",
          "focus:border-[#00ffa3]/50 focus:outline-none",
          icon ? "pl-9" : "pl-3",
        )}
      >
        {children}
      </select>
      <ChevronDown
        size={16}
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/55"
      />
    </div>
  );
}

function PriceRange({
  minPrice,
  maxPrice,
  ceiling,
  onPrice,
}: {
  minPrice: string;
  maxPrice: string;
  ceiling: number;
  onPrice: (min: string, max: string) => void;
}) {
  const propMin = clampPrice(minPrice, 0, ceiling);
  const propMax = clampPrice(maxPrice, ceiling, ceiling);
  const [minValue, setMinValue] = useState(propMin);
  const [maxValue, setMaxValue] = useState(Math.max(propMin, propMax));

  useEffect(() => {
    setMinValue(propMin);
    setMaxValue(Math.max(propMin, propMax));
  }, [propMin, propMax]);

  const commit = (nextMin: number, nextMax: number) => {
    const bounds = priceBoundsToParams(nextMin, nextMax, ceiling);
    onPrice(bounds.minPrice, bounds.maxPrice);
  };

  const minPct = ceiling === 0 ? 0 : (minValue / ceiling) * 100;
  const maxPct = ceiling === 0 ? 100 : (maxValue / ceiling) * 100;

  return (
    <div>
      <div className="relative h-6">
        <div className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/15" />
        <div
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-[#00ffa3]"
          style={{ left: `${minPct}%`, right: `${100 - maxPct}%` }}
        />
        <input
          type="range"
          data-testid="rail-min-price"
          aria-label="Minimum price"
          min={0}
          max={ceiling}
          step={1}
          value={minValue}
          onChange={(e) => {
            const next = Math.min(Number(e.target.value), maxValue);
            setMinValue(next);
            commit(next, maxValue);
          }}
          className="hashpop-dual-range"
          style={{ zIndex: minValue > ceiling - maxValue ? 5 : 3 }}
        />
        <input
          type="range"
          data-testid="rail-max-price"
          aria-label="Maximum price"
          min={0}
          max={ceiling}
          step={1}
          value={maxValue}
          onChange={(e) => {
            const next = Math.max(Number(e.target.value), minValue);
            setMaxValue(next);
            commit(minValue, next);
          }}
          className="hashpop-dual-range is-max"
          style={{ zIndex: 4 }}
        />
      </div>
      <p data-testid="rail-price-label" className="mt-1 text-[13px] text-[#d7fff0]">
        {minValue} ℏ — {maxValue} ℏ
      </p>
    </div>
  );
}

/**
 * Browse Rail fields: type, location, ℏ price, condition. No categories.
 * Changes apply immediately through the callbacks (same URL params as mobile).
 */
export function MarketplaceBrowseRail({
  type,
  location,
  condition,
  minPrice,
  maxPrice,
  cities,
  priceCeiling = RAIL_PRICE_CEILING,
  onType,
  onLocation,
  onCondition,
  onPrice,
  onClear,
  className,
}: {
  type: ListingType;
  location: string;
  condition: string;
  minPrice: string;
  maxPrice: string;
  cities: string[];
  priceCeiling?: number;
  onType: (type: ListingType) => void;
  onLocation: (location: string) => void;
  onCondition: (condition: string) => void;
  onPrice: (min: string, max: string) => void;
  onClear: () => void;
  className?: string;
}) {
  const locations = location && !cities.includes(location) ? [location, ...cities] : cities;
  const filtersActive =
    type !== "all" || location !== "" || condition !== "" || minPrice !== "" || maxPrice !== "";

  return (
    <div
      data-testid="marketplace-browse-rail"
      className={cn("rounded-2xl border border-white/10 bg-[#0e1624]/90 p-4", className)}
    >
      <FieldLabel>Type</FieldLabel>
      <div className="mt-2 flex items-center gap-1" role="group" aria-label="Type">
        {TYPES.map((listingType) => {
          const active = type === listingType.id;
          return (
            <button
              key={listingType.id}
              type="button"
              data-testid={`rail-type-${listingType.id}`}
              aria-pressed={active}
              onClick={() => onType(listingType.id)}
              className={cn(
                "h-8 rounded-full px-2.5 text-[13px] font-medium",
                active
                  ? "border border-[#00ffa3] text-[#00ffa3] shadow-[0_0_16px_rgba(0,255,163,0.28)]"
                  : "text-white/75 hover:text-white",
              )}
            >
              {listingType.label}
            </button>
          );
        })}
      </div>

      <div className="mt-5">
        <FieldLabel>Location</FieldLabel>
        <div className="mt-2">
          <RailSelect
            label="Location"
            testId="rail-location"
            value={location}
            onChange={onLocation}
            icon={<MapPin size={16} aria-hidden />}
          >
            <option value="">Anywhere</option>
            {locations.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </RailSelect>
        </div>
      </div>

      <div className="mt-5">
        <FieldLabel>Price Range</FieldLabel>
        <div className="mt-3">
          <PriceRange
            minPrice={minPrice}
            maxPrice={maxPrice}
            ceiling={priceCeiling}
            onPrice={onPrice}
          />
        </div>
      </div>

      <div className="mt-5">
        <FieldLabel>Condition</FieldLabel>
        <div className="mt-2">
          <RailSelect
            label="Condition"
            testId="rail-condition"
            value={condition}
            onChange={onCondition}
          >
            <option value="">Any Condition</option>
            {RAIL_CONDITIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </RailSelect>
        </div>
      </div>

      <button
        type="button"
        data-testid="browse-rail-clear"
        onClick={onClear}
        disabled={!filtersActive}
        className={cn(
          "mt-5 text-sm font-medium",
          filtersActive ? "text-[#00ffa3] hover:text-white" : "text-white/35",
        )}
      >
        Clear
      </button>
    </div>
  );
}

/** Tablet (768–1023) stand-in for the rail. Same fields, no categories. */
export function MarketplaceFilterDrawer({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children?: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!mounted || !open) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[120] lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Filters"
      data-testid="marketplace-filter-drawer"
    >
      <button
        type="button"
        aria-label="Close filters"
        className="absolute inset-0 bg-black/55"
        onClick={onClose}
      />
      <aside className="absolute bottom-0 right-0 top-0 flex w-[min(100%,320px)] flex-col overflow-y-auto border-l border-white/10 bg-[#0b111b] p-4 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">Filters</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 hover:bg-white/5 hover:text-white"
          >
            ×
          </button>
        </div>
        {children}
      </aside>
    </div>,
    document.body,
  );
}
