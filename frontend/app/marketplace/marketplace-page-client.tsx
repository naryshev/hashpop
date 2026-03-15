"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Fuse from "fuse.js";
import { ListingMedia } from "../../components/ListingMedia";
import { WishlistButton } from "../../components/WishlistButton";
import { StatusBadge } from "../../components/ui/status-badge-beautiful-accessible-status-indicators";
import { formatPriceForDisplay } from "../../lib/formatPrice";
import { formatHbarWithUsd } from "../../lib/hbarUsd";
import { useHbarUsd } from "../../hooks/useHbarUsd";
import { canonicalizeCategory } from "../../lib/categories";
import { useHashpackWallet } from "../../lib/hashpackWallet";
import { formatListingId, getStatusBadge } from "../../lib/listingFormat";

function parsePostedWithinDays(value: string): number | null {
  if (!value) return null;
  const daysMap: Record<string, number> = {
    "1d": 1,
    "1w": 7,
    "1m": 30,
    "3m": 90,
    "6m": 180,
    "1y": 365,
    "2y": 730,
  };
  return daysMap[value] ?? null;
}

function getEmptyMessage(
  query: string,
  category: string,
  minPrice: string,
  maxPrice: string,
  postedWithin: string,
): string {
  if (query && category) return `No listings matched "${query}" in ${category}.`;
  if (query) return `No listings matched "${query}".`;
  if (category) return `No listings found in ${category}.`;
  if (minPrice || maxPrice || postedWithin) return "No listings matched your advanced filters.";
  return "No listings found. Create one to get started!";
}

export type ListingItem = {
  id: string;
  price?: string;
  title?: string | null;
  subtitle?: string | null;
  description?: string | null;
  category?: string | null;
  seller?: string;
  imageUrl?: string | null;
  mediaUrls?: string[];
  createdAt?: string;
  status?: string;
  itemType: "listing";
};

export default function MarketplacePageClient({
  initialItems,
  initialError,
}: {
  initialItems: ListingItem[];
  initialError: string | null;
}) {
  const { isConnected } = useHashpackWallet();
  const searchParams = useSearchParams();
  const query = searchParams.get("q")?.trim() ?? "";
  const categoryQuery = canonicalizeCategory(searchParams.get("category")?.trim() ?? "");
  const minPriceQuery = searchParams.get("minPrice")?.trim() ?? "";
  const maxPriceQuery = searchParams.get("maxPrice")?.trim() ?? "";
  const postedWithinQuery = searchParams.get("postedWithin")?.trim() ?? "";
  const usdRate = useHbarUsd();

  const filteredItems = useMemo(() => {
    let categoryMatched = initialItems;
    if (categoryQuery) {
      const normalizedCategory = categoryQuery.toLowerCase();
      const strict = initialItems.filter(
        (item) => canonicalizeCategory(item.category ?? "").toLowerCase() === normalizedCategory
      );
      if (strict.length > 0) {
        categoryMatched = strict;
      } else {
        const catFuse = new Fuse(initialItems, {
          includeScore: true,
          threshold: 0.3,
          ignoreLocation: true,
          keys: [{ name: "category", weight: 1 }],
        });
        categoryMatched = catFuse.search(categoryQuery).map((r) => r.item);
      }
    }

    let queryMatched = categoryMatched;
    if (query) {
      const fuse = new Fuse(categoryMatched, {
        includeScore: true,
        threshold: 0.38,
        ignoreLocation: true,
        keys: [
          { name: "title", weight: 0.5 },
          { name: "subtitle", weight: 0.15 },
          { name: "description", weight: 0.2 },
          { name: "category", weight: 0.15 },
        ],
      });
      queryMatched = fuse.search(query).map((r) => r.item);
    }

    const minPrice = minPriceQuery !== "" ? Number(minPriceQuery) : null;
    const maxPrice = maxPriceQuery !== "" ? Number(maxPriceQuery) : null;
    const min = minPrice != null && !Number.isNaN(minPrice) ? minPrice : null;
    const max = maxPrice != null && !Number.isNaN(maxPrice) ? maxPrice : null;
    const postedDays = parsePostedWithinDays(postedWithinQuery);
    const now = Date.now();
    const maxAgeMs = postedDays ? postedDays * 24 * 60 * 60 * 1000 : null;

    return queryMatched.filter((item) => {
      const hbar = Number(formatPriceForDisplay(item.price || "0"));
      if (min != null && (Number.isNaN(hbar) || hbar < min)) return false;
      if (max != null && (Number.isNaN(hbar) || hbar > max)) return false;
      if (maxAgeMs != null) {
        const createdMs = new Date(item.createdAt || 0).getTime();
        if (!createdMs || Number.isNaN(createdMs)) return false;
        if (now - createdMs > maxAgeMs) return false;
      }
      return true;
    });
  }, [initialItems, query, categoryQuery, minPriceQuery, maxPriceQuery, postedWithinQuery]);

  return (
    <main className="min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-white">Marketplace</h1>
            <StatusBadge status={isConnected ? "success" : "error"} className="h-6 px-2.5 text-[11px]">
              {isConnected ? "Authenticated" : "Connect"}
            </StatusBadge>
          </div>
          <Link href="/create" className="text-sm text-chrome hover:text-white font-medium">
            Create Listing
          </Link>
        </div>
        {initialError ? (
          <p className="text-amber-400/90 text-sm">
            {initialError} Ensure the backend is running and PostgreSQL is up (e.g. <code className="text-chrome">docker compose up -d db</code>).
          </p>
        ) : filteredItems.length === 0 ? (
          <p className="text-silver">{getEmptyMessage(query, categoryQuery, minPriceQuery, maxPriceQuery, postedWithinQuery)}</p>
        ) : (
          <>
            <div className="sm:hidden space-y-3">
              {filteredItems.map((item) => {
                const badge = getStatusBadge(item.status);
                return (
                <Link
                  key={`${item.itemType}-${item.id}`}
                  href={`/listing/${encodeURIComponent(item.id)}`}
                  className="block glass-card overflow-hidden transition-all duration-200 active:border-white/20 rounded-xl"
                >
                  <div className="relative bg-white/5">
                    <ListingMedia
                      listing={item}
                      className="w-full"
                      aspectRatio="square"
                      navigation="arrows"
                      cardSize
                      compactHeight="160px"
                    />
                    <span
                      className={`absolute top-2 left-2 rounded-full inline-flex items-center gap-1.5 border px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}
                    >
                      {badge.pulseDot ? (
                        <span className="inline-flex h-2 w-2 rounded-full bg-green-400 animate-pulse shadow-[0_0_0_0_rgba(74,222,128,0.7)]" />
                      ) : null}
                      {badge.label}
                    </span>
                  </div>
                  <div className="p-3">
                    <h2 className="text-sm font-medium text-white line-clamp-2 leading-tight">
                      {item.title || formatListingId(item.id) || "Untitled"}
                    </h2>
                    <p className="text-chrome font-semibold mt-1">
                      {formatHbarWithUsd(formatPriceForDisplay(item.price || "0"), usdRate)}
                    </p>
                  </div>
                </Link>
                );
              })}
            </div>
            <div className="hidden sm:grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
              {filteredItems.map((item) => {
                const badge = getStatusBadge(item.status);
                return (
                <Link
                  key={`${item.itemType}-${item.id}`}
                  href={`/listing/${encodeURIComponent(item.id)}`}
                  className="glass-card overflow-hidden transition-all duration-200 hover:border-white/20 hover:shadow-glow rounded-xl"
                >
                  <div className="relative bg-white/5">
                    <ListingMedia
                      listing={item}
                      className="w-full"
                      aspectRatio="square"
                      navigation="arrows"
                      cardSize
                      compactHeight="160px"
                    />
                    <div className="absolute top-2 right-2">
                      <WishlistButton itemId={item.id} itemType={item.itemType} compact />
                    </div>
                    <span
                      className={`absolute top-2 left-2 rounded-full inline-flex items-center gap-1.5 border px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}
                    >
                      {badge.pulseDot ? (
                        <span className="inline-flex h-2 w-2 rounded-full bg-green-400 animate-pulse shadow-[0_0_0_0_rgba(74,222,128,0.7)]" />
                      ) : null}
                      {badge.label}
                    </span>
                  </div>
                  <div className="p-3">
                    <h2 className="text-sm font-medium text-white line-clamp-2 leading-tight min-h-[2.5rem]">
                      {item.title || formatListingId(item.id) || "Untitled"}
                    </h2>
                    <p className="text-chrome font-semibold mt-1">
                      {formatHbarWithUsd(formatPriceForDisplay(item.price || "0"), usdRate)}
                    </p>
                  </div>
                </Link>
                );
              })}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
