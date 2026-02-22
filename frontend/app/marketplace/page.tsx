"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ListingMedia } from "../../components/ListingMedia";
import { WishlistButton } from "../../components/WishlistButton";
import { formatPriceForDisplay } from "../../lib/formatPrice";
import { formatHbarWithUsd } from "../../lib/hbarUsd";
import { useHbarUsd } from "../../hooks/useHbarUsd";
import { getApiUrl } from "../../lib/apiUrl";

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

type ListingItem = { id: string; price?: string; title?: string | null; seller?: string; imageUrl?: string | null; mediaUrls?: string[]; createdAt?: string; itemType: "listing" };

export default function MarketplacePage() {
  const [items, setItems] = useState<ListingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const usdRate = useHbarUsd();

  const fetchListings = useCallback(() => {
    setLoading(true);
    fetch(`${getApiUrl()}/api/listings`)
      .then((res) => res.json())
      .then((data: { listings?: any[] }) => {
        const list = (data.listings || []).map((l: any) => ({ ...l, itemType: "listing" as const }));
        setItems(list.sort((a, b) => new Date((b.createdAt as string) || 0).getTime() - new Date((a.createdAt as string) || 0).getTime()));
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  useEffect(() => {
    const onFocus = () => fetchListings();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
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
        ) : items.length === 0 ? (
          <p className="text-silver">No listings found. Create one to get started!</p>
        ) : (
          <>
            {/* Mobile: compact carousel */}
            <div className="sm:hidden -mx-4 overflow-x-auto overflow-y-hidden scroll-smooth snap-x snap-mandatory scrollbar-hide">
              <div className="flex gap-3 px-4 pb-2" style={{ minWidth: "min-content" }}>
                {items.map((item) => (
                  <Link
                    key={`${item.itemType}-${item.id}`}
                    href={`/listing/${encodeURIComponent(item.id)}`}
                    className="flex-shrink-0 w-[140px] snap-start glass-card overflow-hidden transition-all duration-200 active:border-white/20"
                  >
                    <ListingMedia
                      listing={item}
                      className="w-full rounded-t-lg object-cover"
                      aspectRatio="square"
                      navigation="arrows"
                      cardSize
                      compactHeight="88px"
                    />
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
              {items.map((item) => (
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
