"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatPriceForDisplay } from "../../lib/formatPrice";
import { formatHbarWithUsd } from "../../lib/hbarUsd";
import { useHbarUsd } from "../../hooks/useHbarUsd";
import { formatListingDate } from "../../lib/formatDate";
import { useHashpackWallet } from "../../lib/hashpackWallet";
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

export default function DashboardPage() {
  const { address, accountId, disconnect } = useHashpackWallet();
  const [mounted, setMounted] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [activeListings, setActiveListings] = useState<any[]>([]);
  const [wishlistItems, setWishlistItems] = useState<
    { itemId: string; itemType: string; title?: string; price?: string; reservePrice?: string }[]
  >([]);
  const [purchaseCount, setPurchaseCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const usdRate = useHbarUsd();

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    let cancelled = false;
    setStats(null);
    setActiveListings([]);
    setWishlistItems([]);
    setPurchaseCount(0);
    if (!address) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([
      fetch(`${getApiUrl()}/api/user/${address}`)
        .then((res) => res.json())
        .then((d) => {
          if (!cancelled) setStats(d);
        })
        .catch(() => {
          if (!cancelled) setStats(null);
        }),
      fetch(`${getApiUrl()}/api/user/${address}/listings`)
        .then((res) => res.json())
        .then((data: { active?: any[] }) => {
          if (cancelled) return;
          setActiveListings(data.active ?? []);
        })
        .catch(() => {
          if (cancelled) return;
          setActiveListings([]);
        }),
      fetch(`${getApiUrl()}/api/wishlist?address=${encodeURIComponent(address)}`)
        .then((res) => (res.ok ? res.json() : Promise.reject()))
        .then((data: { items?: { itemId: string; itemType: string }[] }) => {
          const items = data.items ?? [];
          Promise.all(
            items
              .filter((w) => w.itemType === "listing")
              .map((w) =>
                fetch(`${getApiUrl()}/api/listing/${encodeURIComponent(w.itemId)}`)
                  .then((r) => (r.ok ? r.json() : null))
                  .then((d) => ({
                    itemId: w.itemId,
                    itemType: "listing" as const,
                    ...(d?.listing ?? {}),
                  })),
              ),
          ).then((rows) => {
            if (!cancelled) setWishlistItems(rows);
          });
        })
        .catch(() => {
          if (!cancelled) setWishlistItems([]);
        }),
      fetch(`${getApiUrl()}/api/user/${address}/purchases`)
        .then((res) => (res.ok ? res.json() : Promise.reject(res)))
        .then((data: { purchases?: any[] }) => {
          if (!cancelled) setPurchaseCount((data.purchases ?? []).length);
        })
        .catch(() => {
          if (!cancelled) setPurchaseCount(0);
        }),
    ]).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [address]);

  return (
    <main className="min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-bold text-white">{accountId || "My Hashpop"}</h1>
          {address && (
            <Link
              href={`/profile/${encodeURIComponent(address)}`}
              className="text-sm text-chrome hover:text-white font-medium"
            >
              ★ {Number(stats?.ratingAverage ?? 0).toFixed(1)}
            </Link>
          )}
        </div>

        <div className="space-y-8" suppressHydrationWarning>
          {!mounted ? (
            <p className="text-silver">Loading…</p>
          ) : !address ? (
            <p className="text-silver">Please connect your wallet to see your dashboard.</p>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="glass-card p-4 rounded-xl">
                  <p className="text-sm text-silver">Sales</p>
                  <p className="text-2xl font-semibold text-white mt-1">{stats?.totalSales ?? 0}</p>
                </div>
                <div className="glass-card p-4 rounded-xl">
                  <p className="text-sm text-silver">Listings</p>
                  <p className="text-2xl font-semibold text-white mt-1">
                    {stats?.activeListings ?? 0}
                  </p>
                </div>
                <div className="glass-card p-4 rounded-xl">
                  <p className="text-sm text-silver">Purchases</p>
                  <p className="text-2xl font-semibold text-white mt-1">{purchaseCount}</p>
                  <Link
                    href="/purchases"
                    className="text-xs text-chrome hover:text-white mt-1 inline-block"
                  >
                    View history
                  </Link>
                </div>
              </div>

              <section>
                <h2 className="text-lg font-semibold text-white mb-3">Current Listings</h2>
                {loading ? (
                  <p className="text-silver">Loading…</p>
                ) : activeListings.length === 0 ? (
                  <p className="text-silver">
                    No active listings.{" "}
                    <Link href="/create" className="text-chrome hover:text-white underline">
                      Create one
                    </Link>
                    .
                  </p>
                ) : (
                  <div className="glass-card overflow-hidden rounded-xl">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b border-white/10">
                            <th className="p-3 text-silver text-sm font-medium">Listing</th>
                            <th className="p-3 text-silver text-sm font-medium">Type</th>
                            <th className="p-3 text-silver text-sm font-medium">Price</th>
                            <th className="p-3 text-silver text-sm font-medium">Date</th>
                            <th className="p-3 text-silver text-sm font-medium">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeListings.map((row) => (
                            <tr
                              key={`${row.itemType || "listing"}-${row.id}`}
                              className="border-b border-white/5 hover:bg-white/5"
                            >
                              <td className="p-3">
                                <Link
                                  href={`/listing/${encodeURIComponent(row.id)}`}
                                  className="text-white hover:text-chrome font-medium"
                                >
                                  {row.title ||
                                    formatListingId(row.id) ||
                                    row.id.slice(0, 10) + "…"}
                                </Link>
                              </td>
                              <td className="p-3 text-silver text-sm">Buy now</td>
                              <td className="p-3 text-chrome">
                                {formatHbarWithUsd(
                                  formatPriceForDisplay(row.price || row.reservePrice || "0"),
                                  usdRate,
                                )}
                              </td>
                              <td className="p-3 text-silver text-sm">
                                {formatListingDate(row.createdAt)}
                              </td>
                              <td className="p-3">
                                <Link
                                  href={`/listing/${encodeURIComponent(row.id)}`}
                                  className="text-chrome hover:text-white text-sm"
                                >
                                  View
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </section>

              <section>
                <h2 className="text-lg font-semibold text-white mb-3">Watchlist</h2>
                {loading ? (
                  <p className="text-silver">Loading…</p>
                ) : wishlistItems.length === 0 ? (
                  <p className="text-silver">
                    No watchlist items. Add listings from the marketplace with the ♡ or + Add to
                    wishlist button.
                  </p>
                ) : (
                  <div className="glass-card overflow-hidden rounded-xl">
                    <ul className="divide-y divide-white/5">
                      {wishlistItems.map((w) => (
                        <li
                          key={w.itemId}
                          className="flex items-center justify-between p-3 hover:bg-white/5"
                        >
                          <Link
                            href={`/listing/${encodeURIComponent(w.itemId)}`}
                            className="text-white hover:text-chrome font-medium flex-1 min-w-0 truncate"
                          >
                            {w.title || formatListingId(w.itemId) || w.itemId.slice(0, 10) + "…"}
                          </Link>
                          <span className="text-chrome text-sm shrink-0 ml-2">
                            {formatHbarWithUsd(
                              formatPriceForDisplay(w.price || w.reservePrice || "0"),
                              usdRate,
                            )}
                          </span>
                          <Link
                            href={`/listing/${encodeURIComponent(w.itemId)}`}
                            className="text-chrome hover:text-white text-sm shrink-0 ml-2"
                          >
                            View
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    void disconnect();
                  }}
                  className="inline-flex items-center rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-silver transition hover:border-white/30 hover:text-white"
                >
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
