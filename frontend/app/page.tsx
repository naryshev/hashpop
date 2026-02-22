"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ListingMedia } from "../components/ListingMedia";
import { formatPriceForDisplay } from "../lib/formatPrice";
import { formatHbarWithUsd } from "../lib/hbarUsd";
import { useHbarUsd } from "../hooks/useHbarUsd";
import { WishlistButton } from "../components/WishlistButton";
import { getApiUrl } from "../lib/apiUrl";

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

export default function Home() {
  const [listings, setListings] = useState<any[]>([]);
  const usdRate = useHbarUsd();

  const fetchListings = useCallback(() => {
    fetch(`${getApiUrl()}/api/listings`)
      .then((res) => res.json())
      .then((data: { listings?: any[] }) => {
        const list = (data.listings || []).map((l: any) => ({ ...l, itemType: "listing" as const }));
        setListings(list.sort((a, b) => new Date((b.createdAt as string) || 0).getTime() - new Date((a.createdAt as string) || 0).getTime()).slice(0, 6));
      })
      .catch(() => setListings([]));
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
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl sm:text-2xl font-bold text-white">Latest listings</h2>
            <Link href="/marketplace" className="text-sm text-chrome hover:text-white font-medium">
              See all
            </Link>
          </div>

          {listings.length === 0 ? (
            <p className="text-silver py-8">
              No listings yet. <Link href="/marketplace" className="text-chrome hover:text-white underline">View marketplace</Link> or <Link href="/create" className="text-chrome hover:text-white underline">create one</Link>.
            </p>
          ) : (
            <>
              {/* Mobile: compact carousel with heart */}
              <div className="sm:hidden -mx-4 overflow-x-auto overflow-y-hidden scroll-smooth snap-x snap-mandatory scrollbar-hide">
                <div className="flex gap-3 px-4 pb-2" style={{ minWidth: "min-content" }}>
                  {listings.map((item: any) => (
                    <Link
                      key={`${item.itemType || "listing"}-${item.id}`}
                      href={`/listing/${encodeURIComponent(item.id)}`}
                      className="flex-shrink-0 w-[140px] snap-start glass-card overflow-hidden transition-all duration-200 active:border-white/20 relative"
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
                        <div className="absolute top-2 right-2">
                          <WishlistButton itemId={item.id} itemType={item.itemType || "listing"} compact />
                        </div>
                      </div>
                      <div className="p-2 min-h-0">
                        <h2 className="text-sm font-medium text-white truncate leading-tight">
                          {item.title || formatListingId(item.id) || "Untitled"}
                        </h2>
                        <p className="text-chrome text-xs font-medium mt-0.5">
                          {formatHbarWithUsd(formatPriceForDisplay(item.price || item.reservePrice || "0"), usdRate)}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Desktop: grid with heart on each card (eBay-style) */}
              <div className="hidden sm:grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
                {listings.map((item: any) => (
                  <Link
                    key={`${item.itemType || "listing"}-${item.id}`}
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
                        <WishlistButton itemId={item.id} itemType={item.itemType || "listing"} compact />
                      </div>
                    </div>
                    <div className="p-3">
                      <h2 className="text-sm font-medium text-white line-clamp-2 leading-tight min-h-[2.5rem]">
                        {item.title || formatListingId(item.id) || "Untitled"}
                      </h2>
                      <p className="text-chrome font-semibold mt-1">
                        {formatHbarWithUsd(formatPriceForDisplay(item.price || item.reservePrice || "0"), usdRate)}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
