"use client";
import { encodeListingIdForUrl, listingHref } from "../../lib/listingUrl";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useHashpackWallet } from "../../lib/hashpackWallet";
import { formatHbarWithUsd } from "../../lib/hbarUsd";
import { useHbarUsd } from "../../hooks/useHbarUsd";
import { formatPriceForDisplay } from "../../lib/formatPrice";
import { formatListingDate } from "../../lib/formatDate";
import { getApiUrl } from "../../lib/apiUrl";
import { AddressDisplay } from "../../components/AddressDisplay";
import { ConnectWalletButton } from "../../components/ConnectWalletButton";
import { Stepper } from "../../components/order/Stepper";
import type { OrderState } from "../../components/order/tokens";

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
  listing?: {
    id: string;
    title?: string | null;
    status?: string;
    imageUrl?: string | null;
    requireEscrow?: boolean;
    trackingNumber?: string | null;
    trackingCarrier?: string | null;
    shippedAt?: string | null;
    exchangeConfirmedAt?: string | null;
  } | null;
  auction?: { id: string; title?: string | null; status?: string; imageUrl?: string | null } | null;
};

type EscrowState = "AWAITING_SHIPMENT" | "AWAITING_CONFIRMATION" | "COMPLETE" | "REFUNDED";

type Tab = "bought" | "sold";

function escrowFromListingStatus(status?: string): EscrowState {
  const s = (status || "").toUpperCase();
  if (s === "LOCKED") return "AWAITING_SHIPMENT";
  if (s === "SHIPPED") return "AWAITING_CONFIRMATION";
  return "COMPLETE";
}

// Map the contract's 3 escrow states onto the design's stepper states.
// "delivered" is where the buyer's release CTA appears, matching the design.
function escrowToOrderState(s: EscrowState): OrderState {
  if (s === "COMPLETE") return "released";
  if (s === "AWAITING_CONFIRMATION") return "delivered";
  return "paid";
}

function nextStepCopy(role: "buyer" | "seller", s: EscrowState): string {
  if (s === "COMPLETE") return "Trade closed";
  if (s === "AWAITING_SHIPMENT") return role === "seller" ? "Ship the item" : "Seller to ship";
  if (s === "AWAITING_CONFIRMATION")
    return role === "buyer" ? "Tap release" : "Buyer to release";
  return "—";
}

type Step = {
  state: EscrowState;
  isEscrow: boolean;
  /** Short, role-aware status sentence. */
  headline: string;
  /** Longer description of what's happening or what to do. */
  detail: string;
  /** Optional CTA button. */
  cta?: { label: string; href: string };
  /** Pill color for the status badge. */
  tone: "complete" | "active" | "waiting" | "neutral";
};

function describeStep(row: PurchaseRow, state: EscrowState): Step {
  const isBuyer = row.role === "buyer";
  const isEscrow = !!row.listing?.requireEscrow;
  const ctaHref = row.listingId
    ? `/purchases/${encodeListingIdForUrl(row.listingId)}`
    : "/marketplace";
  const tracking = row.listing?.trackingNumber
    ? `${row.listing.trackingCarrier ?? "Carrier"} ${row.listing.trackingNumber}`
    : null;

  // Direct sale (no escrow) — settled the moment payment cleared.
  if (!isEscrow && state === "COMPLETE") {
    return {
      state,
      isEscrow: false,
      headline: isBuyer ? "Purchase complete" : "Sale complete",
      detail: isBuyer
        ? "Payment was sent directly to the seller. No escrow on this sale."
        : "Buyer paid directly. No escrow on this sale.",
      tone: "complete",
    };
  }

  if (state === "COMPLETE") {
    return {
      state,
      isEscrow: true,
      headline: isBuyer ? "Purchase complete" : "Sale complete",
      detail: isBuyer
        ? "Payment was released from escrow to the seller. You confirmed receipt."
        : "Funds released to you. The buyer confirmed receipt.",
      tone: "complete",
    };
  }

  if (state === "AWAITING_SHIPMENT") {
    return {
      state,
      isEscrow: true,
      headline: isBuyer ? "Waiting on seller to ship" : "Action needed: ship the item",
      detail: isBuyer
        ? "Your payment is locked in escrow. The seller has 7 days from purchase to ship and add tracking, or escrow auto-refunds."
        : "Buyer paid into escrow. Add a tracking number on the listing and confirm shipment to keep the timer from running out.",
      cta: isBuyer ? undefined : { label: "Add tracking", href: ctaHref },
      tone: isBuyer ? "waiting" : "active",
    };
  }

  if (state === "AWAITING_CONFIRMATION") {
    return {
      state,
      isEscrow: true,
      headline: isBuyer ? "Action needed: confirm receipt" : "Waiting on buyer confirmation",
      detail: isBuyer
        ? `Seller confirmed shipment${tracking ? ` (${tracking})` : ""}. Once the item arrives, click "Confirm receipt" on the listing to release payment. Escrow auto-releases after the timeout if you take no action.`
        : `You marked the item as shipped${tracking ? ` (${tracking})` : ""}. Funds release once the buyer confirms — or automatically after the escrow timeout.`,
      cta: isBuyer ? { label: "Confirm receipt", href: ctaHref } : undefined,
      tone: isBuyer ? "active" : "waiting",
    };
  }

  return {
    state,
    isEscrow,
    headline: "In progress",
    detail: "Waiting on the next step.",
    tone: "neutral",
  };
}

function StepBadge({ tone, children }: { tone: Step["tone"]; children: React.ReactNode }) {
  const map: Record<Step["tone"], string> = {
    complete: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
    active: "border-blue-400/40 bg-blue-400/10 text-blue-300",
    waiting: "border-amber-400/40 bg-amber-400/10 text-amber-200",
    neutral: "border-white/15 bg-white/5 text-silver",
  };
  return (
    <span
      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${map[tone]}`}
    >
      {children}
    </span>
  );
}

export default function PurchasesPage() {
  const { address } = useHashpackWallet();
  const usdRate = useHbarUsd();
  const [items, setItems] = useState<PurchaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [escrowStates, setEscrowStates] = useState<Record<string, EscrowState>>({});
  const [tab, setTab] = useState<Tab>("bought");

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

  // Pull authoritative escrow state from chain for any escrow-backed listing.
  useEffect(() => {
    if (items.length === 0) return;
    const ids = Array.from(new Set(items.map((x) => x.listingId).filter((x): x is string => !!x)));
    if (ids.length === 0) return;
    Promise.allSettled(
      ids.map((lid) =>
        fetch(`${getApiUrl()}/api/escrow/${encodeURIComponent(lid)}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((data) => ({ lid, data })),
      ),
    ).then((results) => {
      const next: Record<string, EscrowState> = {};
      for (const r of results) {
        if (r.status === "fulfilled" && r.value?.data?.state) {
          next[r.value.lid] = r.value.data.state as EscrowState;
        }
      }
      setEscrowStates(next);
    });
  }, [items]);

  const [bought, sold] = useMemo(
    () => [items.filter((x) => x.role === "buyer"), items.filter((x) => x.role === "seller")],
    [items],
  );

  const list = tab === "bought" ? bought : sold;

  const stepFor = (row: PurchaseRow): Step => {
    const onChain = row.listingId ? escrowStates[row.listingId] : undefined;
    const state = onChain ?? escrowFromListingStatus(row.listing?.status);
    return describeStep(row, state);
  };

  const activeOrders = items.filter((r) => {
    const onChain = r.listingId ? escrowStates[r.listingId] : undefined;
    const state = onChain ?? escrowFromListingStatus(r.listing?.status);
    return state !== "COMPLETE";
  });
  const needsAttention = activeOrders.filter((r) => {
    const onChain = r.listingId ? escrowStates[r.listingId] : undefined;
    const state = onChain ?? escrowFromListingStatus(r.listing?.status);
    return (
      (r.role === "buyer" && state === "AWAITING_CONFIRMATION") ||
      (r.role === "seller" && state === "AWAITING_SHIPMENT")
    );
  }).length;

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-[-0.01em] text-white">
            {activeOrders.length} active order{activeOrders.length === 1 ? "" : "s"}
          </h1>
          <p className="mt-1 text-xs text-silver">
            {items.length} total · {needsAttention} need{needsAttention === 1 ? "s" : ""} your
            attention
          </p>
        </div>

        {!address ? (
          <div className="glass-card rounded-xl p-6">
            <p className="mb-3 font-medium text-white">Connect your wallet to view purchases.</p>
            <ConnectWalletButton />
          </div>
        ) : (
          <>
            <div
              role="tablist"
              aria-label="Purchases"
              className="inline-flex rounded-lg border border-white/10 bg-white/5 p-1"
            >
              <button
                role="tab"
                aria-selected={tab === "bought"}
                onClick={() => setTab("bought")}
                className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
                  tab === "bought" ? "bg-white/15 text-white" : "text-silver hover:text-white"
                }`}
              >
                Bought
                {bought.length > 0 && (
                  <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-silver">
                    {bought.length}
                  </span>
                )}
              </button>
              <button
                role="tab"
                aria-selected={tab === "sold"}
                onClick={() => setTab("sold")}
                className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
                  tab === "sold" ? "bg-white/15 text-white" : "text-silver hover:text-white"
                }`}
              >
                Sold
                {sold.length > 0 && (
                  <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-silver">
                    {sold.length}
                  </span>
                )}
              </button>
            </div>

            {loading ? (
              <p className="text-silver">Loading…</p>
            ) : list.length === 0 ? (
              <div className="glass-card rounded-xl p-6 text-center">
                <p className="font-medium text-white">
                  {tab === "bought" ? "No purchases yet." : "No sales yet."}
                </p>
                <p className="mt-2 text-sm text-silver">
                  {tab === "bought" ? (
                    <>
                      Browse the marketplace to find something.{" "}
                      <Link href="/marketplace" className="text-chrome hover:text-white underline">
                        Marketplace
                      </Link>
                      .
                    </>
                  ) : (
                    <>
                      Create a listing to start selling.{" "}
                      <Link href="/create" className="text-chrome hover:text-white underline">
                        Create a listing
                      </Link>
                      .
                    </>
                  )}
                </p>
              </div>
            ) : (
              <ul className="space-y-3">
                {list.map((row) => {
                  const targetId = row.listingId || row.auctionId;
                  const title = row.listing?.title || row.auction?.title || targetId || row.id;
                  const thumb = row.listing?.imageUrl || row.auction?.imageUrl || null;
                  const step = stepFor(row);
                  const counterpartyAddr = row.role === "buyer" ? row.seller : row.buyer;
                  const detailHref = row.listingId
                    ? `/purchases/${encodeListingIdForUrl(row.listingId)}`
                    : targetId
                      ? listingHref(targetId)
                      : "/marketplace";
                  const orderState: OrderState = escrowToOrderState(step.state);
                  const next = nextStepCopy(row.role, step.state);
                  const showReleaseCta =
                    step.isEscrow &&
                    row.role === "buyer" &&
                    step.state === "AWAITING_CONFIRMATION";
                  const showShipCta =
                    step.isEscrow &&
                    row.role === "seller" &&
                    step.state === "AWAITING_SHIPMENT";

                  return (
                    <li
                      key={row.id}
                      className="rounded-glass-lg border border-white/10 bg-[#0e1422] p-[18px]"
                    >
                      {/* Header row: thumb + title + price + status pill */}
                      <div className="flex items-center gap-3.5">
                        <Link
                          href={detailHref}
                          className="relative h-[52px] w-[52px] shrink-0 overflow-hidden rounded-[10px] border border-white/10 bg-white/5"
                        >
                          {thumb ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={thumb}
                              alt={String(title)}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xl text-white/20">
                              □
                            </div>
                          )}
                        </Link>
                        <div className="min-w-0 flex-1">
                          <Link
                            href={detailHref}
                            className="block truncate text-sm font-bold text-white hover:text-chrome"
                          >
                            {title}
                          </Link>
                          <p className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[11px] text-silver">
                            <span>{row.role === "buyer" ? "from" : "to"}&nbsp;</span>
                            <AddressDisplay
                              address={counterpartyAddr}
                              className="text-silver"
                            />
                            {row.listingId && (
                              <>
                                <span className="text-white/30">·</span>
                                <span>
                                  #
                                  {row.listingId.length > 20
                                    ? `${row.listingId.slice(0, 10)}…`
                                    : row.listingId}
                                </span>
                              </>
                            )}
                            <span className="text-white/30">·</span>
                            <span>{formatListingDate(row.createdAt)}</span>
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-lg font-extrabold text-chrome">
                            {formatHbarWithUsd(
                              formatPriceForDisplay(row.amount || "0"),
                              usdRate,
                            )}
                          </div>
                          <div className="mt-1">
                            <StepBadge tone={step.tone}>
                              {step.state === "COMPLETE"
                                ? step.isEscrow
                                  ? "Released"
                                  : "Direct sale"
                                : step.state === "AWAITING_SHIPMENT"
                                  ? "Paid"
                                  : step.state === "AWAITING_CONFIRMATION"
                                    ? "Delivered"
                                    : "In progress"}
                            </StepBadge>
                          </div>
                        </div>
                      </div>

                      {/* 4-step stepper (only when escrow-backed) */}
                      {step.isEscrow && (
                        <div className="mt-4">
                          <Stepper state={orderState} />
                        </div>
                      )}

                      {/* Footer: next-step copy + role/state CTAs + Details */}
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[11px] text-silver">
                          Next: {next}
                        </span>
                        <span className="flex-1" />
                        {showReleaseCta && (
                          <Link
                            href={detailHref}
                            className="rounded-glass bg-[linear-gradient(110deg,#00b37a_0%,#00ffa3_50%,#00e5ff_100%)] px-4 py-2 text-xs font-bold text-black shadow-glow"
                          >
                            Release {formatPriceForDisplay(row.amount || "0")} ℏ
                          </Link>
                        )}
                        {showShipCta && (
                          <Link
                            href={detailHref}
                            className="rounded-glass bg-[linear-gradient(110deg,#00b37a_0%,#00ffa3_50%,#00e5ff_100%)] px-4 py-2 text-xs font-bold text-black"
                          >
                            Mark shipped
                          </Link>
                        )}
                        <Link
                          href={detailHref}
                          className="rounded-glass border border-white/10 px-3.5 py-2 text-xs text-silver hover:bg-white/5"
                        >
                          Details
                        </Link>
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
