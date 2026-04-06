"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useHashpackWallet } from "../../lib/hashpackWallet";
import { getApiUrl } from "../../lib/apiUrl";
import { formatPriceForDisplay } from "../../lib/formatPrice";
import { formatHbarWithUsd } from "../../lib/hbarUsd";
import { useHbarUsd } from "../../hooks/useHbarUsd";

export default function WatchlistPage() {
  const { address } = useHashpackWallet();
  const usdRate = useHbarUsd();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<
    { itemId: string; itemType: string; title?: string; price?: string; reservePrice?: string }[]
  >([]);

  useEffect(() => {
    if (!address) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`${getApiUrl()}/api/wishlist?address=${encodeURIComponent(address)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: { items?: { itemId: string; itemType: string }[] }) => {
        const rows = data.items ?? [];
        return Promise.all(
          rows
            .filter((w) => w.itemType === "listing")
            .map((w) =>
              fetch(`${getApiUrl()}/api/listing/${encodeURIComponent(w.itemId)}`)
                .then((r) => (r.ok ? r.json() : null))
                .then((d) => ({ itemId: w.itemId, itemType: "listing", ...(d?.listing ?? {}) })),
            ),
        );
      })
      .then((rows) => setItems(rows))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [address]);

  return (
    <main className="min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <h1 className="text-xl sm:text-2xl font-bold text-white">Watchlist</h1>
        {!address ? (
          <p className="text-silver">Connect your wallet to view your watchlist.</p>
        ) : loading ? (
          <p className="text-silver">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-silver">No saved items yet.</p>
        ) : (
          <div className="glass-card overflow-hidden rounded-xl">
            <ul className="divide-y divide-white/5">
              {items.map((w) => (
                <li
                  key={w.itemId}
                  className="flex items-center justify-between p-3 hover:bg-white/5"
                >
                  <Link
                    href={`/listing/${encodeURIComponent(w.itemId)}`}
                    className="text-white hover:text-chrome font-medium truncate"
                  >
                    {w.title || w.itemId}
                  </Link>
                  <span className="text-chrome text-sm ml-3">
                    {formatHbarWithUsd(
                      formatPriceForDisplay(w.price || w.reservePrice || "0"),
                      usdRate,
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </main>
  );
}
