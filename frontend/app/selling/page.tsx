"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useHashpackWallet } from "../../lib/hashpackWallet";
import { getApiUrl } from "../../lib/apiUrl";
import { formatPriceForDisplay } from "../../lib/formatPrice";
import { formatHbarWithUsd } from "../../lib/hbarUsd";
import { useHbarUsd } from "../../hooks/useHbarUsd";
import { formatListingDate } from "../../lib/formatDate";
import { useCancelListing } from "../../hooks/useCancelListing";

export default function SellingPage() {
  const { address } = useHashpackWallet();
  const usdRate = useHbarUsd();
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<any[]>([]);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const { cancel, isPending: cancelPending, isSuccess: cancelSuccess, hash: cancelTxHash } = useCancelListing();

  const fetchListings = useCallback(() => {
    if (!address) return;
    fetch(`${getApiUrl()}/api/user/${address}/listings`)
      .then((res) => res.ok ? res.json() : Promise.reject())
      .then((data: { active?: any[] }) => {
        setActive(data.active ?? []);
      })
      .catch(() => {
        setActive([]);
      })
      .finally(() => setLoading(false));
  }, [address]);

  useEffect(() => {
    if (!address) {
      setActive([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchListings();
  }, [address, fetchListings]);

  useEffect(() => {
    if (!cancelSuccess || !cancelTxHash) return;
    fetch(`${getApiUrl()}/api/sync-cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ txHash: cancelTxHash }),
    }).catch(() => {});
    setCancellingId(null);
    fetchListings();
  }, [cancelSuccess, cancelTxHash, fetchListings]);

  return (
    <main className="min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <h1 className="text-xl sm:text-2xl font-bold text-white">Selling</h1>
        {!address ? (
            <p className="text-silver">Connect your wallet to view your listings.</p>
          ) : loading ? (
            <p className="text-silver">Loading…</p>
          ) : (
            <div className="space-y-6">
              <section>
                <h2 className="text-lg font-semibold text-white mb-3">Active</h2>
                {active.length === 0 ? (
                  <p className="text-silver">No active listings.</p>
                ) : (
                  <div className="glass-card overflow-hidden rounded-xl">
                    <ul className="divide-y divide-white/5">
                      {active.map((row) => (
                        <li key={row.id} className="p-3 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <Link href={`/listing/${encodeURIComponent(row.id)}`} className="text-white hover:text-chrome font-medium truncate block">
                              {row.title || row.id}
                            </Link>
                            <p className="text-xs text-silver mt-0.5">{formatListingDate(row.createdAt)}</p>
                          </div>
                          <div className="shrink-0 flex items-center gap-2">
                            <span className="text-chrome">{formatHbarWithUsd(formatPriceForDisplay(row.price || "0"), usdRate)}</span>
                            <Link
                              href={`/listing/${encodeURIComponent(row.id)}`}
                              className="btn-frost-cta px-3 py-1.5 text-xs border-white/20"
                            >
                              Configure
                            </Link>
                            <button
                              type="button"
                              onClick={() => {
                                const confirmed = window.confirm("This will delete all record of this item.");
                                if (!confirmed) return;
                                setCancellingId(row.id);
                                void cancel(row.id);
                              }}
                              disabled={cancelPending}
                              className="btn-frost px-3 py-1.5 text-xs border-rose-500/50 text-rose-300 hover:bg-rose-500/20 disabled:opacity-60"
                            >
                              {cancelPending && cancellingId === row.id ? "Confirm in wallet" : "Delete"}
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            </div>
          )}
      </div>
    </main>
  );
}
