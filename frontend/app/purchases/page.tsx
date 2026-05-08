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
import { ConnectWalletButton } from "../../components/ConnectWalletButton";

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
  const listingHref = row.listingId
    ? `/listing/${encodeURIComponent(row.listingId)}`
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
      cta: isBuyer ? undefined : { label: "Add tracking", href: listingHref },
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
      cta: isBuyer ? { label: "Confirm receipt", href: listingHref } : undefined,
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

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-white sm:text-2xl">Purchases</h1>
            <p className="mt-1 text-xs text-silver/70">
              Track your buys and sales through every escrow step.
            </p>
          </div>
          <Link href="/dashboard" className="text-sm font-medium text-chrome hover:text-white">
            My Hashpop
          </Link>
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
                  return (
                    <li key={row.id} className="glass-card rounded-xl border border-white/10 p-4">
                      <div className="flex gap-4">
                        <Link
                          href={
                            targetId ? `/listing/${encodeURIComponent(targetId)}` : "/marketplace"
                          }
                          className="relative aspect-square w-20 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-white/5"
                        >
                          {thumb ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={thumb}
                              alt={String(title)}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-2xl text-white/20">
                              □
                            </div>
                          )}
                        </Link>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <Link
                              href={
                                targetId
                                  ? `/listing/${encodeURIComponent(targetId)}`
                                  : "/marketplace"
                              }
                              className="block truncate text-base font-semibold text-white hover:text-chrome"
                            >
                              {title}
                            </Link>
                            <StepBadge tone={step.tone}>
                              {step.state === "COMPLETE"
                                ? step.isEscrow
                                  ? "Complete"
                                  : "Direct sale"
                                : step.state === "AWAITING_SHIPMENT"
                                  ? "Awaiting shipment"
                                  : step.state === "AWAITING_CONFIRMATION"
                                    ? "Awaiting confirmation"
                                    : "In progress"}
                            </StepBadge>
                          </div>
                          <p className="mt-0.5 text-xs text-silver/70">
                            {row.role === "buyer" ? "Seller " : "Buyer "}
                            <AddressDisplay
                              address={counterpartyAddr}
                              className="font-mono text-chrome"
                            />
                            <span className="mx-1.5 text-white/30">·</span>
                            {formatListingDate(row.createdAt)}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-white">
                            {formatHbarWithUsd(formatPriceForDisplay(row.amount || "0"), usdRate)}
                          </p>
                        </div>
                      </div>

                      {/* Step description + CTA */}
                      <div
                        className={`mt-3 rounded-lg border px-3 py-2 ${
                          step.tone === "active"
                            ? "border-blue-400/40 bg-blue-400/5"
                            : step.tone === "waiting"
                              ? "border-amber-400/30 bg-amber-400/5"
                              : step.tone === "complete"
                                ? "border-emerald-400/30 bg-emerald-400/5"
                                : "border-white/10 bg-white/5"
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p
                              className={`text-sm font-semibold ${
                                step.tone === "active"
                                  ? "text-blue-200"
                                  : step.tone === "waiting"
                                    ? "text-amber-200"
                                    : step.tone === "complete"
                                      ? "text-emerald-200"
                                      : "text-white"
                              }`}
                            >
                              {step.headline}
                            </p>
                            <p className="mt-0.5 text-xs text-silver/80">{step.detail}</p>
                          </div>
                          {step.cta && (
                            <Link
                              href={step.cta.href}
                              className="shrink-0 rounded-glass border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/15"
                            >
                              {step.cta.label}
                            </Link>
                          )}
                        </div>
                      </div>

                      {/* Progress stepper — only for escrow-backed transactions. */}
                      {step.isEscrow && (
                        <div className="mt-2">
                          <TransactionProgress escrowState={step.state} compact />
                        </div>
                      )}
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
