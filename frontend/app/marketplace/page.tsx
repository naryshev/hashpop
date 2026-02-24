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

function isSoldStatus(status?: string): boolean {
  return !!status && status !== "LISTED";
}

function MarketplacePageContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q")?.trim() ?? "";
  const categoryQuery = canonicalizeCategory(searchParams.get("category")?.trim() ?? "");
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

    if (!query) return categoryMatched;
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
    return fuse.search(query).map((r) => r.item);
  }, [items, query, categoryQuery]);

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
          const aSold = isSoldStatus(a.status);
          const bSold = isSoldStatus(b.status);
          if (aSold !== bSold) return aSold ? 1 : -1;
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
                  : "No listings found. Create one to get started!"}
          </p>
        ) : (
          <>
            {/* Mobile: compact carousel */}
            <div className="sm:hidden -mx-4 overflow-x-auto overflow-y-hidden scroll-smooth snap-x snap-mandatory scrollbar-hide">
              <div className="flex gap-3 px-4 pb-2" style={{ minWidth: "min-content" }}>
                {filteredItems.map((item) => (
                  <Link
                    key={`${item.itemType}-${item.id}`}
                    href={`/listing/${encodeURIComponent(item.id)}`}
                    className="flex-shrink-0 w-[140px] snap-start glass-card overflow-hidden transition-all duration-200 active:border-white/20"
                  >
                    <div className="relative">
                      <ListingMedia
                        listing={item}
                        className="w-full rounded-t-lg object-cover"
                        aspectRatio="square"
                        navigation="arrows"
                        cardSize
                        compactHeight="88px"
                      />
                      <span className={`absolute top-2 left-2 rounded-full px-2 py-0.5 text-[10px] font-semibold border ${isSoldStatus(item.status) ? "bg-rose-500/20 border-rose-400/40 text-rose-200" : "bg-emerald-500/20 border-emerald-400/40 text-emerald-200"}`}>
                        {isSoldStatus(item.status) ? "SOLD" : "ACTIVE"}
                      </span>
                    </div>
                    <div className="p-2 min-h-0">
                      <h2 className="text-sm font-medium text-white truncate leading-tight">
                        {item.title || formatListingId(item.id) || "Untitled"}
                      </h2>
                      <p className="text-chrome text-xs font-medium mt-0.5">
                        {formatHbarWithUsd(formatPriceForDisplay(item.price || "0"), usdRate)}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
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
                    <span className={`absolute top-2 left-2 rounded-full px-2 py-0.5 text-[10px] font-semibold border ${isSoldStatus(item.status) ? "bg-rose-500/20 border-rose-400/40 text-rose-200" : "bg-emerald-500/20 border-emerald-400/40 text-emerald-200"}`}>
                      {isSoldStatus(item.status) ? "SOLD" : "ACTIVE"}
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
