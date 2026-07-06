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
import { RateCounterpartyModal } from "../../components/RateCounterpartyModal";
import { OpenDisputeModal } from "../../components/OpenDisputeModal";
import { carrierTrackingUrl } from "../../lib/trackingUrl";
import {
  EscrowView,
  orderStatusLine,
  phaseFor,
  type OrderPhase,
} from "../../lib/orderStatus";

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
    disputeStatus?: string | null;
  } | null;
  auction?: { id: string; title?: string | null; status?: string; imageUrl?: string | null } | null;
};

type Tab = "bought" | "sold";

function phaseFromListingStatus(status?: string): OrderPhase {
  const s = (status || "").toUpperCase();
  if (s === "LOCKED") return "paid";
  if (s === "SHIPPED") return "shipped";
  if (s === "REFUNDED") return "refunded";
  return "complete";
}

type Step = {
  phase: OrderPhase;
  isEscrow: boolean;
  /** Single status line, e.g. "Paid · seller has until Jul 13 to ship". */
  label: string;
  detail: string;
  /** Optional CTA button. */
  cta?: { label: string; href: string };
  tone: "complete" | "active" | "waiting" | "refunded" | "disputed";
};

function describeStep(row: PurchaseRow, view: EscrowView | null | undefined): Step {
  const isBuyer = row.role === "buyer";
  const isEscrow = !!row.listing?.requireEscrow;
  const phase = view
    ? phaseFor(view.state, view.disputed)
    : phaseFromListingStatus(row.listing?.status);
  const ctaHref = row.listingId
    ? `/purchases/${encodeListingIdForUrl(row.listingId)}`
    : "/marketplace";

  const status = orderStatusLine({
    phase,
    role: isBuyer ? "buyer" : "seller",
    timeoutAt: view?.timeoutAt,
    isEscrow,
  });

  let cta: Step["cta"];
  if (phase === "paid" && !isBuyer) cta = { label: "Add tracking", href: ctaHref };
  if (phase === "shipped" && isBuyer) cta = { label: "View order", href: ctaHref };

  return { phase, isEscrow, label: status.label, detail: status.detail, cta, tone: status.tone };
}

function StepBadge({ tone, children }: { tone: Step["tone"]; children: React.ReactNode }) {
  const map: Record<Step["tone"], string> = {
    complete: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
    active: "border-blue-400/40 bg-blue-400/10 text-blue-300",
    waiting: "border-amber-400/40 bg-amber-400/10 text-amber-200",
    refunded: "border-rose-400/40 bg-rose-400/10 text-rose-200",
    disputed: "border-rose-400/40 bg-rose-400/10 text-rose-300",
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
  const [escrowViews, setEscrowViews] = useState<Record<string, EscrowView>>({});
  const [tab, setTab] = useState<Tab>("bought");
  const [ratedSales, setRatedSales] = useState<Set<string>>(new Set());
  const [rating, setRating] = useState<{
    saleId: string;
    ratedAddress: string;
    role: "seller" | "buyer";
  } | null>(null);
  const [dispute, setDispute] = useState<{ listingId: string; title: string } | null>(null);
  const [disputedIds, setDisputedIds] = useState<Set<string>>(new Set());

  const ratedKey = address ? `hashpop.rated.${address.toLowerCase()}` : null;
  useEffect(() => {
    if (!ratedKey) return;
    try {
      const raw = window.localStorage.getItem(ratedKey);
      if (raw) setRatedSales(new Set(JSON.parse(raw) as string[]));
    } catch {
      // ignore
    }
  }, [ratedKey]);

  const markRated = (saleId: string) => {
    setRatedSales((prev) => {
      const next = new Set(prev).add(saleId);
      if (ratedKey) {
        try {
          window.localStorage.setItem(ratedKey, JSON.stringify(Array.from(next)));
        } catch {
          // ignore
        }
      }
      return next;
    });
  };

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
      const next: Record<string, EscrowView> = {};
      for (const r of results) {
        if (r.status === "fulfilled" && r.value?.data?.state) {
          next[r.value.lid] = r.value.data as EscrowView;
        }
      }
      setEscrowViews(next);
    });
  }, [items]);

  const [bought, sold] = useMemo(
    () => [items.filter((x) => x.role === "buyer"), items.filter((x) => x.role === "seller")],
    [items],
  );

  const list = tab === "bought" ? bought : sold;

  const stepFor = (row: PurchaseRow): Step => {
    const view = row.listingId ? escrowViews[row.listingId] : undefined;
    return describeStep(row, view);
  };

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6">
        <p className="text-xs text-silver/70">
          Buys and sales at a glance — escrow settles itself on the dates shown.
        </p>

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
                  const disputed =
                    row.listing?.disputeStatus === "OPEN" ||
                    (!!row.listingId && disputedIds.has(row.listingId));
                  const canDispute =
                    step.isEscrow &&
                    !disputed &&
                    (step.phase === "paid" || step.phase === "shipped") &&
                    !!row.listingId;
                  // Per-order detail screen (matches Mobile Order & Escrow design handoff).
                  const detailHref = row.listingId
                    ? `/purchases/${encodeListingIdForUrl(row.listingId)}`
                    : targetId
                      ? listingHref(targetId)
                      : "/marketplace";
                  return (
                    <li key={row.id} className="glass-card rounded-xl border border-white/10 p-4">
                      <div className="flex gap-4">
                        <Link
                          href={detailHref}
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
                              href={detailHref}
                              className="block truncate text-base font-semibold text-white hover:text-chrome"
                            >
                              {title}
                            </Link>
                            <StepBadge tone={step.tone}>
                              {step.phase === "complete" && !step.isEscrow
                                ? "Direct sale"
                                : step.label}
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

                      {/* Single status line + optional CTA — replaces the old stepper. */}
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                        <p className="min-w-0 flex-1 text-sm text-silver">
                          <span
                            className={`font-semibold ${
                              step.tone === "active"
                                ? "text-blue-200"
                                : step.tone === "waiting"
                                  ? "text-amber-200"
                                  : step.tone === "complete"
                                    ? "text-emerald-200"
                                    : "text-rose-200"
                            }`}
                          >
                            {step.label}
                          </span>
                          <span className="mx-1.5 text-white/30">·</span>
                          {step.detail}
                        </p>
                        {step.cta && !disputed && (
                          <Link
                            href={step.cta.href}
                            className="shrink-0 rounded-glass border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/15"
                          >
                            {step.cta.label}
                          </Link>
                        )}
                      </div>

                      {/* Tracking link — once a tracking number is on file, give
                          the buyer a direct link to the carrier's tracking page. */}
                      {row.listing?.trackingNumber &&
                        (() => {
                          const url = carrierTrackingUrl(
                            row.listing.trackingCarrier,
                            row.listing.trackingNumber,
                          );
                          return (
                            <p className="mt-2 text-xs text-silver">
                              Tracking:{" "}
                              {url ? (
                                <a
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-chrome underline underline-offset-2 hover:text-white"
                                >
                                  {row.listing.trackingNumber}
                                  {row.listing.trackingCarrier
                                    ? ` (${row.listing.trackingCarrier})`
                                    : ""}
                                </a>
                              ) : (
                                <span className="text-chrome">{row.listing.trackingNumber}</span>
                              )}
                            </p>
                          );
                        })()}

                      {/* Dispute state — frozen banner, or an entry point to open one. */}
                      {disputed ? (
                        <div className="mt-2 flex items-center gap-2 rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2">
                          <span className="rounded-full border border-amber-400/40 bg-amber-400/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-amber-200">
                            Disputed
                          </span>
                          <p className="text-xs text-amber-200/90">
                            Escrow is frozen while this dispute is reviewed. Continue in the Hashpop
                            Discord.
                          </p>
                        </div>
                      ) : (
                        canDispute && (
                          <div className="mt-2 text-right">
                            <button
                              type="button"
                              onClick={() =>
                                setDispute({
                                  listingId: row.listingId as string,
                                  title: String(title),
                                })
                              }
                              className="text-xs font-medium text-rose-300/90 underline underline-offset-2 hover:text-rose-200"
                            >
                              Open dispute
                            </button>
                          </div>
                        )
                      )}

                      {/* Rating prompt — once the transaction is complete, invite
                          the participant to rate their counterparty. */}
                      {step.phase === "complete" && (
                        <div className="mt-2 flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                          <p className="text-xs text-silver">
                            {ratedSales.has(row.id)
                              ? `You rated this ${row.role === "buyer" ? "seller" : "buyer"}.`
                              : `How was your experience with this ${row.role === "buyer" ? "seller" : "buyer"}?`}
                          </p>
                          {!ratedSales.has(row.id) && (
                            <button
                              type="button"
                              onClick={() =>
                                setRating({
                                  saleId: row.id,
                                  ratedAddress: counterpartyAddr,
                                  role: row.role === "buyer" ? "seller" : "buyer",
                                })
                              }
                              className="shrink-0 rounded-glass border border-amber-400/40 bg-amber-400/10 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-400/20"
                            >
                              ★ Rate {row.role === "buyer" ? "seller" : "buyer"}
                            </button>
                          )}
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
      {rating && (
        <RateCounterpartyModal
          saleId={rating.saleId}
          ratedAddress={rating.ratedAddress}
          counterpartyRole={rating.role}
          onClose={() => setRating(null)}
          onRated={() => markRated(rating.saleId)}
        />
      )}
      {dispute && address && (
        <OpenDisputeModal
          listingId={dispute.listingId}
          listingTitle={dispute.title}
          openerAddress={address}
          onClose={() => setDispute(null)}
          onOpened={() =>
            setDisputedIds((prev) => new Set(prev).add(dispute.listingId))
          }
        />
      )}
    </main>
  );
}
