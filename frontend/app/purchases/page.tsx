"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useHashpackWallet } from "../../lib/hashpackWallet";
import { formatHbarWithUsd } from "../../lib/hbarUsd";
import { useHbarUsd } from "../../hooks/useHbarUsd";
import { formatPriceForDisplay } from "../../lib/formatPrice";
import { formatListingDate } from "../../lib/formatDate";
import { getApiUrl } from "../../lib/apiUrl";

type PurchaseRow = {
  id: string;
  listingId?: string | null;
  auctionId?: string | null;
  buyer: string;
  seller: string;
  amount: string;
  createdAt: string;
  role: "buyer" | "seller";
  listing?: { id: string; title?: string | null; status?: string; imageUrl?: string | null } | null;
  auction?: { id: string; title?: string | null; status?: string; imageUrl?: string | null } | null;
};

export default function PurchasesPage() {
  const { address } = useHashpackWallet();
  const usdRate = useHbarUsd();
  const [items, setItems] = useState<PurchaseRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!address) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`${getApiUrl()}/api/user/${address}/purchases`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data: { purchases?: PurchaseRow[] }) => setItems(data.purchases ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [address]);

  const [asBuyer, asSeller] = useMemo(() => {
    return [
      items.filter((x) => x.role === "buyer"),
      items.filter((x) => x.role === "seller"),
    ];
  }, [items]);

  return (
    <main className="min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-bold text-white">Purchase History</h1>
          <Link href="/dashboard" className="text-sm text-chrome hover:text-white font-medium">Dashboard</Link>
        </div>

        <div className="space-y-6">
            {!address ? (
              <p className="text-silver">Connect your wallet to view purchase history.</p>
            ) : loading ? (
              <p className="text-silver">Loading…</p>
            ) : (
              <>
            <section>
              <h2 className="text-lg font-semibold text-white mb-3">Bought</h2>
              {asBuyer.length === 0 ? (
                <p className="text-silver">No purchases yet.</p>
              ) : (
                <div className="glass-card overflow-hidden rounded-xl">
                  <ul className="divide-y divide-white/5">
                    {asBuyer.map((row) => {
                      const targetId = row.listingId || row.auctionId;
                      const title = row.listing?.title || row.auction?.title || targetId || row.id;
                      return (
                        <li key={row.id} className="p-3 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <Link href={targetId ? `/listing/${encodeURIComponent(targetId)}` : "/marketplace"} className="text-white hover:text-chrome font-medium truncate block">
                              {title}
                            </Link>
                            <p className="text-xs text-silver mt-0.5">
                              {formatListingDate(row.createdAt)} · Status: {row.listing?.status || row.auction?.status || "N/A"}
                            </p>
                          </div>
                          <span className="text-chrome shrink-0">{formatHbarWithUsd(formatPriceForDisplay(row.amount || "0"), usdRate)}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-3">Sold</h2>
              {asSeller.length === 0 ? (
                <p className="text-silver">No completed sales yet.</p>
              ) : (
                <div className="glass-card overflow-hidden rounded-xl">
                  <ul className="divide-y divide-white/5">
                    {asSeller.map((row) => {
                      const targetId = row.listingId || row.auctionId;
                      const title = row.listing?.title || row.auction?.title || targetId || row.id;
                      return (
                        <li key={row.id} className="p-3 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <Link href={targetId ? `/listing/${encodeURIComponent(targetId)}` : "/marketplace"} className="text-white hover:text-chrome font-medium truncate block">
                              {title}
                            </Link>
                            <p className="text-xs text-silver mt-0.5">
                              {formatListingDate(row.createdAt)} · Status: {row.listing?.status || row.auction?.status || "N/A"}
                            </p>
                          </div>
                          <span className="text-chrome shrink-0">{formatHbarWithUsd(formatPriceForDisplay(row.amount || "0"), usdRate)}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </section>
              </>
            )}
        </div>
      </div>
    </main>
  );
}

