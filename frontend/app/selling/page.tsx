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
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string; onChainConfirmed: boolean } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const {
    cancel,
    isPending: cancelPending,
    isSuccess: cancelSuccess,
    hash: cancelTxHash,
    error: cancelHookError,
  } = useCancelListing();
  const [canForceCancel, setCanForceCancel] = useState(false);
  const [forceDeleting, setForceDeleting] = useState(false);

  const fetchListings = useCallback(() => {
    if (!address) return;
    fetch(`${getApiUrl()}/api/user/${address}/listings`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
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
    if (!cancelSuccess) return;
    if (cancelTxHash) {
      fetch(`${getApiUrl()}/api/sync-cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txHash: cancelTxHash }),
      }).catch(() => {});
    }
    setCancellingId(null);
    setCanForceCancel(false);
    setDeleteTarget(null);
    fetchListings();
  }, [cancelSuccess, cancelTxHash, fetchListings]);

  const handleForceCancel = useCallback(async () => {
    if (!deleteTarget || forceDeleting) return;
    setDeleteError(null);
    setForceDeleting(true);
    try {
      const res = await fetch(
        `${getApiUrl()}/api/listing/${encodeURIComponent(deleteTarget.id)}/cancel-offchain`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address, force: true }),
        },
      );
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      setCanForceCancel(false);
      setCancellingId(null);
      setDeleteTarget(null);
      setDeleteError(null);
      fetchListings();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Force cancel failed.");
    } finally {
      setForceDeleting(false);
    }
  }, [deleteTarget, forceDeleting, address, fetchListings]);

  return (
    <main className="min-h-screen">
      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="glass-card p-6 w-full max-w-sm space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full border border-rose-500/40 bg-rose-500/10 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <h2 className="text-base font-semibold text-white">Delete listing?</h2>
                <p className="text-sm text-silver mt-1 line-clamp-1">{deleteTarget.title}</p>
                <p className="text-sm text-silver mt-1">
                  {deleteTarget.onChainConfirmed
                    ? "This will cancel the listing on-chain. You'll need to approve the transaction in your wallet."
                    : "This listing was never confirmed on-chain and will be removed directly — no wallet approval needed."}
                </p>
              </div>
            </div>
            {(deleteError || cancelHookError) && (
              <p className="text-sm text-rose-300 border border-rose-500/30 bg-rose-500/5 px-3 py-2">
                {cancelHookError?.message || deleteError}
              </p>
            )}
            {canForceCancel && (
              <p className="text-xs text-silver/70 border border-white/10 bg-white/5 px-3 py-2">
                The on-chain transaction did not go through. You can try again or remove the listing from your account without a blockchain transaction.
              </p>
            )}
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => { setDeleteTarget(null); setDeleteError(null); setCanForceCancel(false); }}
                disabled={cancelPending || forceDeleting}
                className="btn-frost flex-1 border-white/20 disabled:opacity-50"
              >
                Cancel
              </button>
              {canForceCancel ? (
                <>
                  <button
                    type="button"
                    onClick={() => { setCanForceCancel(false); setDeleteError(null); }}
                    disabled={forceDeleting}
                    className="flex-1 rounded-glass border border-white/20 bg-white/5 px-4 py-2 font-semibold text-silver transition-all hover:bg-white/10 disabled:opacity-50"
                  >
                    Try again
                  </button>
                  <button
                    type="button"
                    onClick={handleForceCancel}
                    disabled={forceDeleting}
                    className="flex-1 rounded-glass border border-rose-500/50 bg-rose-500/10 px-4 py-2 font-semibold text-rose-300 transition-all hover:bg-rose-500/20 hover:border-rose-400/70 disabled:opacity-50"
                  >
                    {forceDeleting ? "Removing…" : "Remove from account"}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={async () => {
                    setDeleteError(null);
                    setCancellingId(deleteTarget.id);
                    if (!deleteTarget.onChainConfirmed) {
                      try {
                        const res = await fetch(
                          `${getApiUrl()}/api/listing/${encodeURIComponent(deleteTarget.id)}/cancel-offchain`,
                          {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ address }),
                          },
                        );
                        if (!res.ok) throw new Error((await res.json()).error || "Failed");
                        setCancellingId(null);
                        setDeleteTarget(null);
                        fetchListings();
                      } catch (err) {
                        setDeleteError(err instanceof Error ? err.message : "Delete failed.");
                        setCancellingId(null);
                      }
                      return;
                    }
                    const ok = await cancel(deleteTarget.id);
                    if (!ok) {
                      setDeleteError("Transaction failed or was rejected.");
                      setCanForceCancel(true);
                      setCancellingId(null);
                    }
                  }}
                  disabled={cancelPending || forceDeleting}
                  className="flex-1 rounded-glass border border-rose-500/50 bg-rose-500/10 px-4 py-2 font-semibold text-rose-300 transition-all hover:bg-rose-500/20 hover:border-rose-400/70 disabled:opacity-50"
                >
                  {cancelPending && cancellingId === deleteTarget.id ? "Confirm in wallet…" : "Delete listing"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

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
                <p className="text-silver">
                  No active listings.{" "}
                  <Link href="/create" className="text-chrome hover:text-white underline">
                    Create one
                  </Link>
                  .
                </p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {active.map((row) => {
                    const thumb =
                      row.imageUrl ||
                      (Array.isArray(row.mediaUrls) && row.mediaUrls[0]) ||
                      null;
                    const statusColor =
                      row.status === "LOCKED"
                        ? "text-amber-400 border-amber-500/40 bg-amber-500/10"
                        : row.status === "SOLD"
                        ? "text-rose-400 border-rose-500/40 bg-rose-500/10"
                        : "text-[#00ffa3] border-[#00ffa3]/30 bg-[#00ffa3]/5";
                    const statusLabel =
                      row.status === "LOCKED"
                        ? "In Escrow"
                        : row.status === "SOLD"
                        ? "Sold"
                        : "Active";
                    return (
                      <div key={row.id} className="glass-card flex flex-col overflow-hidden">
                        {/* Thumbnail */}
                        <Link href={`/listing/${encodeURIComponent(row.id)}`} className="relative aspect-[4/3] w-full bg-white/5 overflow-hidden block group">
                          {thumb ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={thumb}
                              alt={row.title || ""}
                              className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <span className="text-white/20 text-4xl select-none">□</span>
                            </div>
                          )}
                          <span className={`absolute top-2 right-2 text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 border ${statusColor}`}>
                            {statusLabel}
                          </span>
                        </Link>

                        {/* Info */}
                        <div className="flex flex-col flex-1 p-4 gap-1">
                          <Link
                            href={`/listing/${encodeURIComponent(row.id)}`}
                            className="text-white font-semibold text-sm leading-snug line-clamp-2 hover:text-chrome transition-colors"
                          >
                            {row.title || row.id}
                          </Link>
                          <p className="text-chrome font-semibold text-sm mt-1">
                            {formatHbarWithUsd(formatPriceForDisplay(row.price || "0"), usdRate)}
                          </p>
                          <p className="text-silver/50 text-xs">{formatListingDate(row.createdAt)}</p>

                          {/* Actions */}
                          <div className="flex gap-2 mt-3 pt-3 border-t border-white/[0.06]">
                            <Link
                              href={`/listing/${encodeURIComponent(row.id)}`}
                              className="btn-frost-cta flex-1 text-center text-xs py-1.5"
                            >
                              Configure
                            </Link>
                            {row.status !== "LOCKED" && row.status !== "SOLD" && (
                              <button
                                type="button"
                                onClick={() => {
                                  setDeleteError(null);
                                  setDeleteTarget({ id: row.id, title: row.title || row.id, onChainConfirmed: !!row.onChainConfirmed });
                                }}
                                disabled={cancelPending}
                                className="flex-1 rounded-glass border border-rose-500/50 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 hover:border-rose-400/70 disabled:opacity-50 transition-all"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
