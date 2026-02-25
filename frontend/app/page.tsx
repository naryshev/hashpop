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

export default function Home() {
  const [listings, setListings] = useState<any[]>([]);
  const [listingsError, setListingsError] = useState<string | null>(null);
  const usdRate = useHbarUsd();

  const fetchListings = useCallback(() => {
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
        setListings(list.sort((a, b) => {
          const aActive = isActiveStatus(a.status);
          const bActive = isActiveStatus(b.status);
          if (aActive !== bActive) return aActive ? -1 : 1;
          return new Date((b.createdAt as string) || 0).getTime() - new Date((a.createdAt as string) || 0).getTime();
        }).slice(0, 6));
      })
      .catch((e) => {
        setListings([]);
        setListingsError(e instanceof Error ? e.message : "Failed to load listings.");
      });
  }, []);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  return (
    <main className="min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <section className="rounded-2xl border border-white/15 bg-gradient-to-br from-[#5865F2]/25 via-[#0d1222] to-[#0f4f76]/35 p-6 sm:p-8">
          <p className="text-xs uppercase tracking-[0.2em] text-indigo-200/90">Hashpop Marketplace</p>
          <h1 className="mt-2 text-2xl sm:text-3xl font-bold text-white">Discover the latest listings</h1>
          <p className="mt-3 max-w-2xl text-silver">
            Browse active drops, trending collectibles, and fresh listings from the Hashpop community.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/marketplace" className="btn-frost-cta">
              Explore marketplace
            </Link>
            <Link href="/create" className="btn-frost border-white/20">
              Create listing
            </Link>
          </div>
        </section>

        <section className="glass-card rounded-2xl border border-white/10 p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl sm:text-2xl font-bold text-white">Latest listings</h2>
            <Link href="/marketplace" className="text-sm text-chrome hover:text-white font-medium">
              See all
            </Link>
          </div>

          {listingsError ? (
            <p className="text-amber-400/90 py-8 text-sm">
              {listingsError} Ensure the backend is running and PostgreSQL is up (e.g. <code className="text-chrome">docker compose up -d db</code>).
            </p>
          ) : listings.length === 0 ? (
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
                        <span className={`absolute top-2 left-2 rounded-full px-2 py-0.5 text-[10px] font-semibold border ${getStatusBadge(item.status).className}`}>
                          {getStatusBadge(item.status).label}
                        </span>
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
                      <span className={`absolute top-2 left-2 rounded-full px-2 py-0.5 text-[10px] font-semibold border ${getStatusBadge(item.status).className}`}>
                        {getStatusBadge(item.status).label}
                      </span>
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
