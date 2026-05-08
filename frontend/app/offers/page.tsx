"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useHashpackWallet } from "../../lib/hashpackWallet";
import { useHbarUsd } from "../../hooks/useHbarUsd";
import { formatHbarWithUsd } from "../../lib/hbarUsd";
import { formatPriceForDisplay } from "../../lib/formatPrice";
import { formatListingDate } from "../../lib/formatDate";
import { getApiUrl } from "../../lib/apiUrl";
import { listingIdToBytes32 } from "../../lib/bytes32";
import { marketplaceAbi, marketplaceAddress } from "../../lib/contracts";
import { useRobustContractWrite } from "../../hooks/useRobustContractWrite";
import { activeHederaChain } from "../../lib/hederaChains";
import { getTransactionErrorMessage } from "../../lib/transactionError";
import { AddressDisplay } from "../../components/AddressDisplay";
import { ConnectWalletButton } from "../../components/ConnectWalletButton";

type OfferRow = {
  id: string;
  listingId: string;
  buyer: string;
  amount: string;
  status: "ACTIVE" | "ACCEPTED" | "REJECTED" | "CANCELLED";
  txHash: string | null;
  createdAt: string;
  listing: {
    id: string;
    title: string | null;
    price: string;
    status: string;
    seller: string;
    imageUrl: string | null;
    mediaUrls: string[] | null;
  } | null;
};

type Tab = "received" | "sent";

function statusBadge(status: OfferRow["status"]) {
  switch (status) {
    case "ACTIVE":
      return "border-blue-400/40 bg-blue-400/10 text-blue-300";
    case "ACCEPTED":
      return "border-emerald-400/40 bg-emerald-400/10 text-emerald-300";
    case "REJECTED":
      return "border-rose-400/40 bg-rose-400/10 text-rose-300";
    case "CANCELLED":
    default:
      return "border-white/20 bg-white/5 text-white/60";
  }
}

function statusLabel(status: OfferRow["status"]) {
  switch (status) {
    case "ACTIVE":
      return "Pending";
    case "ACCEPTED":
      return "Accepted";
    case "REJECTED":
      return "Rejected";
    case "CANCELLED":
      return "Cancelled";
  }
}

function offerThumb(row: OfferRow): string | null {
  if (!row.listing) return null;
  if (row.listing.imageUrl) return row.listing.imageUrl;
  const arr = Array.isArray(row.listing.mediaUrls) ? row.listing.mediaUrls : null;
  return arr && arr[0] ? arr[0] : null;
}

export default function OffersPage() {
  const { address } = useHashpackWallet();
  const usdRate = useHbarUsd();
  const { send, isPending } = useRobustContractWrite();
  const chainId = activeHederaChain.id;

  const [tab, setTab] = useState<Tab>("received");
  const [received, setReceived] = useState<OfferRow[]>([]);
  const [sent, setSent] = useState<OfferRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<{ id: string; action: string } | null>(null);

  const refresh = useCallback(async () => {
    if (!address) {
      setReceived([]);
      setSent([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/user/${encodeURIComponent(address)}/offers`);
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { received?: OfferRow[]; sent?: OfferRow[] };
      setReceived(data.received ?? []);
      setSent(data.sent ?? []);
    } catch {
      setReceived([]);
      setSent([]);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const runAction = async (row: OfferRow, action: "accept" | "reject" | "cancel") => {
    setBusy({ id: row.id, action });
    setError(null);
    try {
      const idBytes = listingIdToBytes32(row.listingId);
      const fn =
        action === "accept" ? "acceptOffer" : action === "reject" ? "rejectOffer" : "cancelOffer";
      const args = action === "cancel" ? [idBytes] : [idBytes, row.buyer as `0x${string}`];
      const txHash = await send({
        address: marketplaceAddress,
        abi: marketplaceAbi,
        functionName: fn,
        args,
      });
      await fetch(`${getApiUrl()}/api/sync-offer-action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txHash, listingId: row.listingId, buyer: row.buyer, action }),
      }).catch(() => {});
      await refresh();
    } catch (e) {
      setError(getTransactionErrorMessage(e, { chainId }));
    } finally {
      setBusy(null);
    }
  };

  const counts = useMemo(
    () => ({
      receivedActive: received.filter((o) => o.status === "ACTIVE").length,
      sentActive: sent.filter((o) => o.status === "ACTIVE").length,
    }),
    [received, sent],
  );

  const list = tab === "received" ? received : sent;

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-white sm:text-2xl">Offers</h1>
          <Link href="/dashboard" className="text-sm font-medium text-chrome hover:text-white">
            My Hashpop
          </Link>
        </div>

        {!address ? (
          <div className="glass-card rounded-xl p-6">
            <p className="mb-3 font-medium text-white">Connect your wallet to view offers.</p>
            <ConnectWalletButton />
          </div>
        ) : (
          <>
            <div
              role="tablist"
              aria-label="Offers"
              className="inline-flex rounded-lg border border-white/10 bg-white/5 p-1"
            >
              <button
                role="tab"
                aria-selected={tab === "received"}
                onClick={() => setTab("received")}
                className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
                  tab === "received" ? "bg-white/15 text-white" : "text-silver hover:text-white"
                }`}
              >
                Offers
                {counts.receivedActive ? (
                  <span className="ml-2 rounded-full bg-blue-400/20 px-2 py-0.5 text-[10px] text-blue-200">
                    {counts.receivedActive}
                  </span>
                ) : null}
              </button>
              <button
                role="tab"
                aria-selected={tab === "sent"}
                onClick={() => setTab("sent")}
                className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
                  tab === "sent" ? "bg-white/15 text-white" : "text-silver hover:text-white"
                }`}
              >
                Offering
                {counts.sentActive ? (
                  <span className="ml-2 rounded-full bg-blue-400/20 px-2 py-0.5 text-[10px] text-blue-200">
                    {counts.sentActive}
                  </span>
                ) : null}
              </button>
            </div>

            <p className="text-xs text-silver/70">
              {tab === "received"
                ? "Offers buyers have placed on your listings. Accept to lock the sale (escrow), reject to refund the buyer."
                : "Offers you've placed on other listings. Funds stay locked in escrow until the seller responds; you can cancel an active offer at any time."}
            </p>

            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {error}
              </div>
            )}

            {loading ? (
              <p className="text-silver">Loading…</p>
            ) : list.length === 0 ? (
              <div className="glass-card rounded-xl p-6 text-center">
                <p className="font-medium text-white">
                  {tab === "received"
                    ? "No offers received yet."
                    : "You haven't placed any offers yet."}
                </p>
                <p className="mt-2 text-sm text-silver">
                  {tab === "received" ? (
                    <>
                      Active offers from buyers will appear here.{" "}
                      <Link href="/selling" className="text-chrome hover:text-white underline">
                        See your listings
                      </Link>
                      .
                    </>
                  ) : (
                    <>
                      Browse the marketplace and use the Offer button on any listing.{" "}
                      <Link href="/marketplace" className="text-chrome hover:text-white underline">
                        Marketplace
                      </Link>
                      .
                    </>
                  )}
                </p>
              </div>
            ) : (
              <ul className="space-y-3">
                {list.map((row) => {
                  const thumb = offerThumb(row);
                  const askingHbar = row.listing
                    ? formatPriceForDisplay(row.listing.price || "0")
                    : null;
                  const myAmount = formatPriceForDisplay(row.amount || "0");
                  const isActive = row.status === "ACTIVE";
                  const rowBusy = busy?.id === row.id;
                  const title = row.listing?.title || row.listingId.slice(0, 12) + "…";
                  return (
                    <li key={row.id} className="glass-card rounded-xl border border-white/10 p-4">
                      <div className="flex gap-4">
                        <Link
                          href={`/listing/${encodeURIComponent(row.listingId)}`}
                          className="relative aspect-square w-20 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-white/5"
                        >
                          {thumb ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={thumb} alt={title} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-2xl text-white/20">
                              □
                            </div>
                          )}
                        </Link>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <Link
                              href={`/listing/${encodeURIComponent(row.listingId)}`}
                              className="block truncate text-base font-semibold text-white hover:text-chrome"
                            >
                              {title}
                            </Link>
                            <span
                              className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${statusBadge(row.status)}`}
                            >
                              {statusLabel(row.status)}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-silver/70">
                            {tab === "received" ? "From " : "To "}
                            <AddressDisplay
                              address={tab === "received" ? row.buyer : row.listing?.seller || ""}
                              className="font-mono text-chrome"
                            />
                            <span className="mx-1.5 text-white/30">·</span>
                            {formatListingDate(row.createdAt)}
                          </p>
                          <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
                            <span className="text-white">
                              <span className="text-silver/70">
                                {tab === "received" ? "Offer:" : "Your offer:"}{" "}
                              </span>
                              <span className="font-semibold">
                                {formatHbarWithUsd(myAmount, usdRate)}
                              </span>
                            </span>
                            {askingHbar && (
                              <span className="text-silver/70">
                                Asking:{" "}
                                <span className="text-silver">
                                  {formatHbarWithUsd(askingHbar, usdRate)}
                                </span>
                              </span>
                            )}
                          </div>
                          {isActive && tab === "received" && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => void runAction(row, "accept")}
                                disabled={isPending || !!rowBusy}
                                className="rounded-glass border border-emerald-500/50 bg-emerald-500/15 px-3 py-1.5 text-sm font-semibold text-emerald-200 transition-colors hover:bg-emerald-500/25 disabled:opacity-50"
                              >
                                {rowBusy && busy?.action === "accept"
                                  ? "Confirm in wallet…"
                                  : "Accept"}
                              </button>
                              <button
                                type="button"
                                onClick={() => void runAction(row, "reject")}
                                disabled={isPending || !!rowBusy}
                                className="rounded-glass border border-rose-500/50 bg-rose-500/10 px-3 py-1.5 text-sm font-semibold text-rose-300 transition-colors hover:bg-rose-500/20 disabled:opacity-50"
                              >
                                {rowBusy && busy?.action === "reject"
                                  ? "Confirm in wallet…"
                                  : "Reject"}
                              </button>
                            </div>
                          )}
                          {isActive && tab === "sent" && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => void runAction(row, "cancel")}
                                disabled={isPending || !!rowBusy}
                                className="rounded-glass border border-white/20 bg-white/5 px-3 py-1.5 text-sm font-semibold text-silver transition-colors hover:bg-white/10 disabled:opacity-50"
                              >
                                {rowBusy ? "Confirm in wallet…" : "Cancel offer"}
                              </button>
                              <Link
                                href={`/listing/${encodeURIComponent(row.listingId)}`}
                                className="rounded-glass border border-white/15 px-3 py-1.5 text-sm text-silver hover:text-white"
                              >
                                View listing
                              </Link>
                            </div>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>
    </main>
  );
}
