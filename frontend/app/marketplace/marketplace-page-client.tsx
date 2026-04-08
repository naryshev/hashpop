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

function formatListingId(id: string): string {
  if (!id || !id.startsWith("0x") || id.length !== 66) return id;
  try {
    const hex = id.slice(2).replace(/0+$/, "");
    if (hex.length % 2) return id;
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
    const str = new TextDecoder().decode(bytes);
    return /^[\x20-\x7e]+$/.test(str) ? str : `${id.slice(0, 10)}…`;
  } catch {
    return `${id.slice(0, 10)}…`;
  }
}

function normalizeListingStatus(status?: string): string {
  return String(status || "")
    .trim()
    .toUpperCase();
}

function getStatusBadge(
  status?: string,
  onChainConfirmed?: boolean,
): { label: string; className: string; pulseDot?: boolean } {
  const normalized = normalizeListingStatus(status);
  if (normalized === "LISTED") {
    if (onChainConfirmed === false) {
      return {
        label: "PENDING",
        className: "bg-amber-400 border-amber-300 text-black",
      };
    }
    return {
      label: "ACTIVE",
      className: "bg-[#00ffa3] border-[#00ffa3] text-black",
      pulseDot: true,
    };
  }
  if (normalized === "LOCKED") {
    return {
      label: "LOCKED",
      className: "bg-orange-400 border-orange-300 text-black",
    };
  }
  if (normalized === "CANCELLED") {
    return {
      label: "CANCELLED",
      className: "bg-zinc-600 border-zinc-500 text-white",
    };
  }
  return {
    label: "SOLD",
    className: "bg-rose-500 border-rose-400 text-white",
  };
}

function formatSellerDisplay(seller?: string): string {
  if (!seller) return "";
  if (/^\d+\.\d+\.\d+$/.test(seller)) return seller;
  if (seller.startsWith("0x") && seller.length > 12)
    return `${seller.slice(0, 6)}…${seller.slice(-4)}`;
  return seller;
}

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
  onChainConfirmed?: boolean;
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
  const items = initialItems;
  const listingsError = initialError;
  const usdRate = useHbarUsd();

  const filteredItems = useMemo(() => {
    let categoryMatched = items;
    if (categoryQuery) {
      const normalizedCategory = categoryQuery.toLowerCase();
      const strict = items.filter(
        (item) => canonicalizeCategory(item.category ?? "").toLowerCase() === normalizedCategory,
      );
      if (strict.length > 0) {
        categoryMatched = strict;
      } else {
        const catFuse = new Fuse(items, {
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
  }, [items, query, categoryQuery, minPriceQuery, maxPriceQuery, postedWithinQuery]);

  return (
    <main className="min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-white">Marketplace</h1>
            {isConnected ? (
              <span className="inline-flex items-center gap-1 h-6 px-2.5 text-[11px] font-medium border border-[#00ffa3]/40 bg-[#00ffa3]/10 text-[#00ffa3] shadow-[0_0_8px_rgba(0,255,163,0.2)]">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#00ffa3] shadow-[0_0_4px_rgba(0,255,163,0.8)]" />
                Authenticated
              </span>
            ) : (
              <StatusBadge status="error" className="h-6 px-2.5 text-[11px]">
                Connect
              </StatusBadge>
            )}
          </div>
          <Link href="/create" className="text-sm text-chrome hover:text-white font-medium">
            Create Listing
          </Link>
        </div>
        {(() => {
          const activeFilters: string[] = [];
          if (query) activeFilters.push(`"${query}"`);
          if (categoryQuery) activeFilters.push(categoryQuery);
          if (minPriceQuery && maxPriceQuery)
            activeFilters.push(`${minPriceQuery}–${maxPriceQuery} HBAR`);
          else if (minPriceQuery) activeFilters.push(`\u2265 ${minPriceQuery} HBAR`);
          else if (maxPriceQuery) activeFilters.push(`\u2264 ${maxPriceQuery} HBAR`);
          if (postedWithinQuery) {
            const labelMap: Record<string, string> = {
              "1d": "Last day", "1w": "Last week", "1m": "Last month",
              "3m": "Last 3 months", "6m": "Last 6 months", "1y": "Last year", "2y": "Last 2 years",
            };
            activeFilters.push(labelMap[postedWithinQuery] ?? postedWithinQuery);
          }
          if (!activeFilters.length) return null;
          return (
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-sm text-silver">
                {activeFilters.join(" · ")}
                <span className="text-chrome font-medium ml-1">
                  · {filteredItems.length} result{filteredItems.length !== 1 ? "s" : ""}
                </span>
              </span>
            </div>
          );
        })()}
        {listingsError ? (
          <p className="text-amber-400/90 text-sm">
            {listingsError} Ensure the backend is running and PostgreSQL is up (e.g.{" "}
            <code className="text-chrome">docker compose up -d db</code>).
          </p>
        ) : filteredItems.length === 0 ? (
          <p className="text-silver">
            {query && categoryQuery
              ? `No listings matched "${query}" in ${categoryQuery}.`
              : query
                ? `No listings matched "${query}".`
                : categoryQuery
                  ? `No listings found in ${categoryQuery}.`
                  : minPriceQuery || maxPriceQuery || postedWithinQuery
                    ? "No listings matched your advanced filters."
                    : "No listings found. Create one to get started!"}
          </p>
        ) : (
          <>
            <div className="sm:hidden space-y-3">
              {filteredItems.map((item) => (
                <Link
                  key={`${item.itemType}-${item.id}`}
                  href={`/listing/${encodeURIComponent(item.id)}`}
                  className="block glass-card overflow-hidden transition-all duration-200 active:border-white/20"
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
                      className={`absolute top-2 left-2 rounded-full inline-flex items-center gap-1.5 border px-2 py-0.5 text-[10px] font-semibold ${getStatusBadge(item.status, item.onChainConfirmed).className}`}
                    >
                      {getStatusBadge(item.status, item.onChainConfirmed).pulseDot ? (
                        <span className="inline-flex h-2 w-2 rounded-full bg-green-400 animate-pulse shadow-[0_0_0_0_rgba(74,222,128,0.7)]" />
                      ) : null}
                      {getStatusBadge(item.status, item.onChainConfirmed).label}
                    </span>
                  </div>
                  <div className="p-3">
                    <h2 className="text-sm font-semibold text-white line-clamp-2 leading-tight">
                      {item.title || formatListingId(item.id) || "Untitled"}
                    </h2>
                    {item.seller && (
                      <p className="text-silver/50 text-[10px] mt-1 font-mono truncate">
                        {formatSellerDisplay(item.seller)}
                      </p>
                    )}
                    <p className="text-chrome font-semibold mt-1.5">
                      {formatHbarWithUsd(formatPriceForDisplay(item.price || "0"), usdRate)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
            <div className="hidden sm:grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredItems.map((item) => (
                <Link
                  key={`${item.itemType}-${item.id}`}
                  href={`/listing/${encodeURIComponent(item.id)}`}
                  className="glass-card overflow-hidden transition-all duration-200 hover:border-white/20 hover:shadow-glow"
                >
                  <div className="relative bg-white/5">
                    <ListingMedia
                      listing={item}
                      className="w-full"
                      aspectRatio="square"
                      navigation="arrows"
                      cardSize
                      compactHeight="220px"
                    />
                    <div className="absolute top-2 right-2">
                      <WishlistButton itemId={item.id} itemType={item.itemType} compact />
                    </div>
                    <span
                      className={`absolute top-2 left-2 rounded-full inline-flex items-center gap-1.5 border px-2 py-0.5 text-[10px] font-semibold ${getStatusBadge(item.status, item.onChainConfirmed).className}`}
                    >
                      {getStatusBadge(item.status, item.onChainConfirmed).pulseDot ? (
                        <span className="inline-flex h-2 w-2 rounded-full bg-green-400 animate-pulse shadow-[0_0_0_0_rgba(74,222,128,0.7)]" />
                      ) : null}
                      {getStatusBadge(item.status, item.onChainConfirmed).label}
                    </span>
                  </div>
                  <div className="p-4">
                    <h2 className="text-base font-semibold text-white line-clamp-2 leading-snug">
                      {item.title || formatListingId(item.id) || "Untitled"}
                    </h2>
                    {item.seller && (
                      <p className="text-silver/50 text-[11px] mt-1 font-mono truncate">
                        {formatSellerDisplay(item.seller)}
                      </p>
                    )}
                    <p className="text-chrome font-semibold mt-2 text-lg">
                      {formatHbarWithUsd(formatPriceForDisplay(item.price || "0"), usdRate)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
