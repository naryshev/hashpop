"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useHashpackWallet } from "../../lib/hashpackWallet";
import { formatHbarWithUsd } from "../../lib/hbarUsd";
import { useHbarUsd } from "../../hooks/useHbarUsd";
import { formatPriceForDisplay } from "../../lib/formatPrice";
import { formatListingDate } from "../../lib/formatDate";
import { TransactionProgress } from "../../components/TransactionProgress";
import { getApiUrl } from "../../lib/apiUrl";
import { AddressDisplay } from "../../components/AddressDisplay";
import { getTransactionExplorerUrl } from "../../lib/explorer";
import { activeHederaChain } from "../../lib/hederaChains";

type PurchaseRow = {
  id: string;
  listingId?: string | null;
  auctionId?: string | null;
  buyer: string;
  seller: string;
  amount: string;
  txHash?: string | null;
  createdAt: string;
  role: "buyer" | "seller";
  listing?: { id: string; title?: string | null; status?: string; imageUrl?: string | null } | null;
  auction?: { id: string; title?: string | null; status?: string; imageUrl?: string | null } | null;
};

type EscrowInfo = {
  state: string;
};

function escrowStateFromListingStatus(status?: string): string {
  const s = (status || "").toUpperCase();
  if (s === "LOCKED") return "AWAITING_SHIPMENT";
  if (s === "SHIPPED") return "AWAITING_CONFIRMATION";
  if (s === "SOLD" || s === "COMPLETE") return "COMPLETE";
  return "COMPLETE";
}

export default function PurchasesPage() {
  const { address } = useHashpackWallet();
  const usdRate = useHbarUsd();
  const [items, setItems] = useState<PurchaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [escrowStates, setEscrowStates] = useState<Record<string, EscrowInfo>>({});

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

  // Fetch escrow state for each purchase that has a listing
  useEffect(() => {
    if (items.length === 0) return;
    const listingIds = items.map((x) => x.listingId).filter((id): id is string => !!id);
    const unique = [...new Set(listingIds)];
    if (unique.length === 0) return;

    Promise.allSettled(
      unique.map((lid) =>
        fetch(`${getApiUrl()}/api/escrow/${encodeURIComponent(lid)}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((data) => ({ lid, data })),
      ),
    ).then((results) => {
      const states: Record<string, EscrowInfo> = {};
      for (const result of results) {
        if (result.status === "fulfilled" && result.value?.data) {
          states[result.value.lid] = { state: result.value.data.state };
        }
      }
      setEscrowStates(states);
    });
  }, [items]);

  const [asBuyer, asSeller] = useMemo(() => {
    return [items.filter((x) => x.role === "buyer"), items.filter((x) => x.role === "seller")];
  }, [items]);

  function getEscrowState(row: PurchaseRow): string {
    if (row.listingId && escrowStates[row.listingId]) {
      return escrowStates[row.listingId].state;
    }
    return escrowStateFromListingStatus(row.listing?.status);
  }

  function TransactionRow({ row }: { row: PurchaseRow }) {
    const targetId = row.listingId || row.auctionId;
    const title = row.listing?.title || row.auction?.title || targetId || row.id;
    const state = getEscrowState(row);
    const isComplete = state === "COMPLETE";

    return (
      <li className="p-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0 flex-1">
            <Link
              href={targetId ? `/listing/${encodeURIComponent(targetId)}` : "/marketplace"}
              className="text-white hover:text-chrome font-medium truncate block"
            >
              {title}
            </Link>
            <p className="text-xs text-silver mt-0.5">{formatListingDate(row.createdAt)}</p>
          </div>
          <div className="text-right shrink-0">
            <span className="text-chrome font-semibold">
              {formatHbarWithUsd(formatPriceForDisplay(row.amount || "0"), usdRate)}
            </span>
            <span
              className={`block text-[10px] font-medium mt-0.5 ${
                isComplete ? "text-emerald-400" : "text-amber-300"
              }`}
            >
              {isComplete ? "Completed" : "In Progress"}
            </span>
          </div>
        </div>
        <TransactionProgress escrowState={state} compact />
      </li>
    );
  }

  return (
    <main className="min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-bold text-white">Transaction History</h1>
          <Link href="/dashboard" className="text-sm text-chrome hover:text-white font-medium">
            Dashboard
          </Link>
        </div>

        <div className="space-y-6">
          {!address ? (
            <p className="text-silver">Connect your wallet to view transaction history.</p>
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
                      {asBuyer.map((row) => (
                        <TransactionRow key={row.id} row={row} />
                      ))}
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
                      {asSeller.map((row) => (
                        <TransactionRow key={row.id} row={row} />
                      ))}
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
