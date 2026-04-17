"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useHashpackWallet } from "../../lib/hashpackWallet";
import { getApiUrl } from "../../lib/apiUrl";
import { formatPriceForDisplay } from "../../lib/formatPrice";
import { formatHbarWithUsd } from "../../lib/hbarUsd";
import { useHbarUsd } from "../../hooks/useHbarUsd";
import { ConnectWalletButton } from "../../components/ConnectWalletButton";
import { BackToHashpop } from "../../components/BackToHashpop";
import { AddressDisplay } from "../../components/AddressDisplay";

type Offer = {
  id: string;
  fromAddress: string;
  toAddress: string;
  offerAmount: string | null;
  offerStatus: string | null;
  createdAt: string;
  listingId: string | null;
  listing: {
    id: string;
    title: string | null;
    imageUrl: string | null;
    price: string;
    seller: string;
    status: string;
  } | null;
};

type PurchaseRow = {
  id: string;
  listingId?: string | null;
  buyer: string;
  seller: string;
  amount: string;
  txHash?: string | null;
  createdAt: string;
  role: "buyer" | "seller";
  listing?: { id: string; title?: string | null; status?: string; imageUrl?: string | null } | null;
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function listingStatus(status?: string): { label: string; color: string } {
  const s = (status || "").toUpperCase();
  if (s === "LOCKED") return { label: "In Escrow", color: "text-amber-300" };
  if (s === "SHIPPED") return { label: "Shipped", color: "text-blue-300" };
  if (s === "SOLD" || s === "COMPLETE") return { label: "Complete", color: "text-[#00ffa3]" };
  return { label: "Active", color: "text-silver/60" };
}

export default function AlertsPage() {
  const { address } = useHashpackWallet();
  const usdRate = useHbarUsd();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [loadingOffers, setLoadingOffers] = useState(false);
  const [loadingPurchases, setLoadingPurchases] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;

    setLoadingOffers(true);
    fetch(`${getApiUrl()}/api/messages/offers?address=${encodeURIComponent(address.toLowerCase())}`)
      .then((r) => (r.ok ? r.json() : { offers: [] }))
      .then((d: { offers?: Offer[] }) => setOffers(d.offers ?? []))
      .catch(() => setOffers([]))
      .finally(() => setLoadingOffers(false));

    setLoadingPurchases(true);
    fetch(`${getApiUrl()}/api/user/${encodeURIComponent(address)}/purchases`)
      .then((r) => (r.ok ? r.json() : { purchases: [] }))
      .then((d: { purchases?: PurchaseRow[] }) => setPurchases(d.purchases ?? []))
      .catch(() => setPurchases([]))
      .finally(() => setLoadingPurchases(false));
  }, [address]);

  const respondToOffer = async (offerId: string, action: "accepted" | "declined") => {
    if (!address || respondingId) return;
    setRespondingId(offerId);
    try {
      await fetch(`${getApiUrl()}/api/messages/${offerId}/offer-response`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, action }),
      });
      setOffers((prev) =>
        prev.map((o) => (o.id === offerId ? { ...o, offerStatus: action } : o))
      );
    } finally {
      setRespondingId(null);
    }
  };

  const receivedOffers = offers.filter((o) => o.toAddress.toLowerCase() === address?.toLowerCase());
  const pendingOffers = receivedOffers.filter((o) => !o.offerStatus || o.offerStatus === "pending");
  const recentPurchases = purchases.slice(0, 6);

  const totalAlerts = pendingOffers.length;

  return (
    <main className="min-h-screen slide-in-right">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-8">
        <div>
          <BackToHashpop />
          <div className="flex items-center gap-2 mt-1">
            <h1 className="text-xl font-bold text-white">Alerts</h1>
            {totalAlerts > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#00ffa3] px-1.5 text-[11px] font-bold text-black">
                {totalAlerts}
              </span>
            )}
          </div>
        </div>

        {!address ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-silver">Connect your wallet to view alerts.</p>
            <ConnectWalletButton className="btn-frost-cta disabled:opacity-50" />
          </div>
        ) : (
          <div className="space-y-8">

            {/* Received offers — actionable */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-silver uppercase tracking-wide">
                  Offers received
                  {pendingOffers.length > 0 && (
                    <span className="ml-2 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-[#00ffa3] text-black text-[10px] font-bold">
                      {pendingOffers.length}
                    </span>
                  )}
                </h2>
                <Link href="/offers" className="text-xs text-chrome hover:text-white">
                  See all
                </Link>
              </div>

              {loadingOffers ? (
                <p className="text-silver/60 text-sm">Loading…</p>
              ) : receivedOffers.length === 0 ? (
                <p className="text-silver/60 text-sm py-1">No offers received yet.</p>
              ) : (
                <div className="space-y-3">
                  {receivedOffers.slice(0, 5).map((offer) => {
                    const isPending = !offer.offerStatus || offer.offerStatus === "pending";
                    const threadUrl = offer.listingId
                      ? `/messages?openThread=${encodeURIComponent(offer.fromAddress)}&listingId=${encodeURIComponent(offer.listingId)}`
                      : `/messages?openThread=${encodeURIComponent(offer.fromAddress)}`;
                    return (
                      <div key={offer.id} className="glass-card rounded-xl overflow-hidden">
                        {offer.listing && (
                          <Link
                            href={`/listing/${encodeURIComponent(offer.listingId!)}`}
                            className="flex items-center gap-3 px-4 pt-3 pb-2.5 border-b border-white/5 hover:bg-white/5 transition-colors"
                          >
                            {offer.listing.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={offer.listing.imageUrl}
                                alt={offer.listing.title ?? ""}
                                className="h-10 w-10 rounded-lg object-cover shrink-0"
                              />
                            ) : (
                              <div className="h-10 w-10 rounded-lg bg-white/10 shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-white truncate">
                                {offer.listing.title ?? "Listing"}
                              </p>
                              <p className="text-xs text-silver/50">
                                {formatPriceForDisplay(offer.listing.price)} HBAR asking
                              </p>
                            </div>
                          </Link>
                        )}
                        <div className="px-4 py-3 flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-base font-bold text-white">
                              {offer.offerAmount} HBAR
                            </p>
                            <p className="text-xs text-silver/50 mt-0.5">
                              From{" "}
                              <AddressDisplay address={offer.fromAddress} showAvatar className="inline-flex" />
                              {" · "}{relativeTime(offer.createdAt)}
                            </p>
                          </div>
                          {!isPending && (
                            <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                              offer.offerStatus === "accepted"
                                ? "bg-[#00ffa3]/15 text-[#00ffa3]"
                                : "bg-rose-500/15 text-rose-400"
                            }`}>
                              {offer.offerStatus}
                            </span>
                          )}
                          <Link
                            href={threadUrl}
                            className="shrink-0 text-xs text-chrome hover:text-white border border-white/15 rounded-lg px-3 py-1.5 transition-colors"
                          >
                            View
                          </Link>
                        </div>
                        {isPending && (
                          <div className="flex border-t border-white/10">
                            <button
                              type="button"
                              onClick={() => respondToOffer(offer.id, "declined")}
                              disabled={!!respondingId}
                              className="flex-1 py-2.5 text-sm font-semibold text-silver hover:text-white border-r border-white/10 transition-colors disabled:opacity-50"
                            >
                              Decline
                            </button>
                            <button
                              type="button"
                              onClick={() => respondToOffer(offer.id, "accepted")}
                              disabled={!!respondingId}
                              className="flex-1 py-2.5 text-sm font-semibold text-[#00ffa3] hover:bg-[#00ffa3]/10 transition-colors disabled:opacity-50"
                            >
                              {respondingId === offer.id ? "…" : "Accept"}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Recent transaction activity */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-silver uppercase tracking-wide">
                  Recent activity
                </h2>
                <Link href="/purchases" className="text-xs text-chrome hover:text-white">
                  See all
                </Link>
              </div>

              {loadingPurchases ? (
                <p className="text-silver/60 text-sm">Loading…</p>
              ) : recentPurchases.length === 0 ? (
                <p className="text-silver/60 text-sm py-1">No recent transactions.</p>
              ) : (
                <div className="glass-card rounded-xl divide-y divide-white/5 overflow-hidden">
                  {recentPurchases.map((row) => {
                    const targetId = row.listingId;
                    const title = row.listing?.title || targetId || row.id;
                    const { label, color } = listingStatus(row.listing?.status);
                    return (
                      <Link
                        key={row.id}
                        href={targetId ? `/listing/${encodeURIComponent(targetId)}` : "/purchases"}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors"
                      >
                        {row.listing?.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={row.listing.imageUrl}
                            alt=""
                            className="h-10 w-10 rounded-lg object-cover shrink-0"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-lg bg-white/[0.08] shrink-0 flex items-center justify-center">
                            <svg className="w-4 h-4 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
                            </svg>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">{title}</p>
                          <p className="text-xs text-silver/50 mt-0.5">
                            {row.role === "buyer" ? "Bought" : "Sold"} · {relativeTime(row.createdAt)}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold text-chrome">
                            {formatHbarWithUsd(formatPriceForDisplay(row.amount || "0"), usdRate)}
                          </p>
                          <p className={`text-[10px] font-medium mt-0.5 ${color}`}>{label}</p>
                        </div>
                      </Link>
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
