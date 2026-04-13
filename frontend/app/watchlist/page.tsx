"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useHashpackWallet } from "../../lib/hashpackWallet";
import { ConnectWalletButton } from "../../components/ConnectWalletButton";
import { getApiUrl } from "../../lib/apiUrl";
import { formatPriceForDisplay } from "../../lib/formatPrice";
import { formatHbarWithUsd } from "../../lib/hbarUsd";
import { useHbarUsd } from "../../hooks/useHbarUsd";
import { ListingMedia } from "../../components/ListingMedia";
import { WishlistButton } from "../../components/WishlistButton";

type WatchItem = {
  itemId: string;
  itemType: string;
  title?: string | null;
  price?: string;
  reservePrice?: string;
  status?: string;
  onChainConfirmed?: boolean;
  imageUrl?: string | null;
  mediaUrls?: string[] | null;
  seller?: string;
  watchlistCount?: number;
};

function formatSellerDisplay(seller?: string): string {
  if (!seller) return "";
  if (/^\d+\.\d+\.\d+$/.test(seller)) return seller;
  if (seller.startsWith("0x") && seller.length > 12)
    return `${seller.slice(0, 6)}…${seller.slice(-4)}`;
  return seller;
}

function getStatusStyle(status?: string): { label: string; className: string; pulse?: boolean } {
  const s = String(status || "").trim().toUpperCase();
  if (s === "LISTED")
    return { label: "ACTIVE", className: "bg-[#00ffa3] border-[#00ffa3] text-black", pulse: true };
  if (s === "LOCKED") return { label: "LOCKED", className: "bg-orange-400 border-orange-300 text-black" };
  if (s === "CANCELLED") return { label: "CANCELLED", className: "bg-zinc-600 border-zinc-500 text-white" };
  return { label: "SOLD", className: "bg-rose-500 border-rose-400 text-white" };
}

export default function WatchlistPage() {
  const { address } = useHashpackWallet();
  const usdRate = useHbarUsd();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<WatchItem[]>([]);

  useEffect(() => {
    if (!address) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([
      fetch(`${getApiUrl()}/api/wishlist?address=${encodeURIComponent(address)}`)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((data: { items?: { itemId: string; itemType: string }[] }) => data.items ?? []),
      fetch(`${getApiUrl()}/api/wishlist/counts`)
        .then((r) => (r.ok ? r.json() : { counts: {} }))
        .then((d: { counts?: Record<string, number> }) => d.counts ?? {}),
    ])
      .then(([rows, counts]) =>
        Promise.all(
          rows
            .filter((w) => w.itemType === "listing")
            .map((w) =>
              fetch(`${getApiUrl()}/api/listing/${encodeURIComponent(w.itemId)}`)
                .then((r) => (r.ok ? r.json() : null))
                .then((d) => ({
                  itemId: w.itemId,
                  itemType: "listing",
                  ...(d?.listing ?? {}),
                  watchlistCount: counts[w.itemId] ?? 0,
                })),
            ),
        ),
      )
      .then((rows) => setItems(rows))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [address]);

  return (
    <main className="min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <h1 className="text-xl sm:text-2xl font-bold text-white mb-6">Watchlist</h1>
        {!address ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-silver">Connect your wallet to view your watchlist.</p>
            <ConnectWalletButton className="btn-frost-cta disabled:opacity-50" />
          </div>
        ) : loading ? (
          <p className="text-silver">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-silver">No saved items yet.</p>
        ) : (
          <>
            {/* Mobile */}
            <div className="sm:hidden space-y-3">
              {items.map((item) => {
                const badge = getStatusStyle(item.status);
                return (
                  <Link
                    key={item.itemId}
                    href={`/listing/${encodeURIComponent(item.itemId)}`}
                    className="block glass-card overflow-hidden transition-all duration-200 active:border-white/20"
                  >
                    <div className="relative bg-white/5">
                      <ListingMedia
                        listing={{ imageUrl: item.imageUrl, mediaUrls: item.mediaUrls ?? undefined }}
                        className="w-full"
                        aspectRatio="square"
                        navigation="arrows"
                        cardSize
                        compactHeight="160px"
                      />
                      <span className={`absolute top-2 left-2 rounded-full inline-flex items-center gap-1.5 border px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}>
                        {badge.pulse && <span className="inline-flex h-2 w-2 rounded-full bg-green-400 animate-pulse" />}
                        {badge.label}
                      </span>
                    </div>
                    <div className="p-3">
                      <h2 className="text-sm font-semibold text-white line-clamp-2 leading-tight">
                        {item.title || item.itemId}
                      </h2>
                      {item.seller && (
                        <p className="text-silver/50 text-[10px] mt-1 font-mono truncate">
                          {formatSellerDisplay(item.seller)}
                        </p>
                      )}
                      <div className="flex items-center justify-between mt-1.5">
                        <p className="text-chrome font-semibold">
                          {formatHbarWithUsd(formatPriceForDisplay(item.price || item.reservePrice || "0"), usdRate)}
                        </p>
                        {(item.watchlistCount ?? 0) > 0 && (
                          <span className="text-[10px] text-silver/50 flex items-center gap-0.5">♡ {item.watchlistCount}</span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Desktop grid */}
            <div className="hidden sm:grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {items.map((item) => {
                const badge = getStatusStyle(item.status);
                return (
                  <Link
                    key={item.itemId}
                    href={`/listing/${encodeURIComponent(item.itemId)}`}
                    className="glass-card overflow-hidden transition-all duration-200 hover:border-white/20 hover:shadow-glow"
                  >
                    <div className="relative bg-white/5">
                      <ListingMedia
                        listing={{ imageUrl: item.imageUrl, mediaUrls: item.mediaUrls ?? undefined }}
                        className="w-full"
                        aspectRatio="square"
                        navigation="arrows"
                        cardSize
                        compactHeight="220px"
                      />
                      <div className="absolute top-2 right-2">
                        <WishlistButton itemId={item.itemId} itemType="listing" compact />
                      </div>
                      <span className={`absolute top-2 left-2 rounded-full inline-flex items-center gap-1.5 border px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}>
                        {badge.pulse && <span className="inline-flex h-2 w-2 rounded-full bg-green-400 animate-pulse" />}
                        {badge.label}
                      </span>
                    </div>
                    <div className="p-4">
                      <h2 className="text-base font-semibold text-white line-clamp-2 leading-snug">
                        {item.title || item.itemId}
                      </h2>
                      {item.seller && (
                        <p className="text-silver/50 text-[11px] mt-1 font-mono truncate">
                          {formatSellerDisplay(item.seller)}
                        </p>
                      )}
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-chrome font-semibold text-lg">
                          {formatHbarWithUsd(formatPriceForDisplay(item.price || item.reservePrice || "0"), usdRate)}
                        </p>
                        {(item.watchlistCount ?? 0) > 0 && (
                          <span className="text-xs text-silver/50 flex items-center gap-1">♡ {item.watchlistCount}</span>
                        )}
                      </div>
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
