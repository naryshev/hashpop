"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Fuse from "fuse.js";
import { ListingMedia } from "../../components/ListingMedia";
import { WishlistButton } from "../../components/WishlistButton";
import { formatPriceForDisplay } from "../../lib/formatPrice";
import { formatHbarWithUsd } from "../../lib/hbarUsd";
import { useHbarUsd } from "../../hooks/useHbarUsd";
import { getApiUrl } from "../../lib/apiUrl";
import { canonicalizeCategory } from "../../lib/categories";

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

type ListingItem = {
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

function normalizeListingStatus(status?: string): string {
  return String(status || "").trim().toUpperCase();
}

function isActiveStatus(status?: string): boolean {
  return normalizeListingStatus(status) === "LISTED";
}

function getStatusBadge(status?: string): { label: string; className: string } {
  const normalized = normalizeListingStatus(status);
  if (normalized === "LISTED") {
    return {
      label: "ACTIVE",
      className: "bg-emerald-500/20 border-emerald-400/40 text-emerald-200",
    };
  }
  if (normalized === "LOCKED") {
    return {
      label: "LOCKED",
      className: "bg-amber-500/20 border-amber-400/40 text-amber-200",
    };
  }
  if (normalized === "CANCELLED") {
    return {
      label: "CANCELLED",
      className: "bg-zinc-500/20 border-zinc-300/40 text-zinc-200",
    };
  }
  return {
    label: "SOLD",
    className: "bg-rose-500/20 border-rose-400/40 text-rose-200",
  };
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

function MarketplacePageContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q")?.trim() ?? "";
  const categoryQuery = canonicalizeCategory(searchParams.get("category")?.trim() ?? "");
  const minPriceQuery = searchParams.get("minPrice")?.trim() ?? "";
  const maxPriceQuery = searchParams.get("maxPrice")?.trim() ?? "";
  const postedWithinQuery = searchParams.get("postedWithin")?.trim() ?? "";
  const [items, setItems] = useState<ListingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [listingsError, setListingsError] = useState<string | null>(null);
  const usdRate = useHbarUsd();

  const filteredItems = useMemo(() => {
    let categoryMatched = items;
    if (categoryQuery) {
      const normalizedCategory = categoryQuery.toLowerCase();
      const strict = items.filter(
        (item) => canonicalizeCategory(item.category ?? "").toLowerCase() === normalizedCategory
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

  const fetchListings = useCallback(() => {
    setLoading(true);
    setListingsError(null);
    fetch(`${getApiUrl()}/api/listings`)
      .then((res) => {
        if (!res.ok) {
          return res.json().then((body: { error?: string }) => {
            throw new Error(body?.error || (res.status === 503 ? "Backend or database unavailable." : "Failed to load listings."));
          }).catch((e: Error) => {
            if (e instanceof SyntaxError) throw new Error(res.status === 503 ? "Backend or database unavailable." : "Failed to load listings.");
            throw e;
          });
        }
        return res.json();
      })
      .then((data: { listings?: any[] }) => {
        const list = (data.listings || []).map((l: any) => ({ ...l, itemType: "listing" as const }));
        setItems(list.sort((a, b) => {
          const aActive = isActiveStatus(a.status);
          const bActive = isActiveStatus(b.status);
          if (aActive !== bActive) return aActive ? -1 : 1;
          return new Date((b.createdAt as string) || 0).getTime() - new Date((a.createdAt as string) || 0).getTime();
        }));
      })
      .catch((e) => {
        setItems([]);
        setListingsError(e instanceof Error ? e.message : "Failed to load listings.");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  return (
    <main className="min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-white">Marketplace</h1>
          <Link href="/" className="text-sm text-chrome hover:text-white font-medium">Home</Link>
        </div>
        {loading ? (
          <p className="text-silver">Loading listings…</p>
        ) : listingsError ? (
          <p className="text-amber-400/90 text-sm">
            {listingsError} Ensure the backend is running and PostgreSQL is up (e.g. <code className="text-chrome">docker compose up -d db</code>).
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
            {/* Mobile: vertical list (temporary until richer inventory) */}
            <div className="sm:hidden space-y-3">
              {filteredItems.map((item) => (
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
                    <span className={`absolute top-2 left-2 rounded-full px-2 py-0.5 text-[10px] font-semibold border ${getStatusBadge(item.status).className}`}>
                      {getStatusBadge(item.status).label}
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
              ))}
            </div>
            {/* Desktop: grid */}
            <div className="hidden sm:grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
              {filteredItems.map((item) => (
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
                    <span className={`absolute top-2 left-2 rounded-full px-2 py-0.5 text-[10px] font-semibold border ${getStatusBadge(item.status).className}`}>
                      {getStatusBadge(item.status).label}
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
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}

export default function MarketplacePage() {
  return (
    <Suspense fallback={<main className="min-h-screen"><div className="max-w-6xl mx-auto px-4 sm:px-6 py-6"><p className="text-silver">Loading listings…</p></div></main>}>
      <MarketplacePageContent />
    </Suspense>
  );
}
