"use client";
import { listingHref } from "../../../lib/listingUrl";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getApiUrl } from "../../../lib/apiUrl";
import { getTransactionExplorerUrl } from "../../../lib/explorer";
import { activeHederaChain } from "../../../lib/hederaChains";
import { formatPriceForDisplay } from "../../../lib/formatPrice";
import { formatHbarWithUsd } from "../../../lib/hbarUsd";
import { useHbarUsd } from "../../../hooks/useHbarUsd";

type Listing = {
  id: string;
  title?: string | null;
  imageUrl?: string | null;
  mediaUrls?: string[];
  price: string;
  seller: string;
  status: string;
  requireEscrow?: boolean;
};

export default function PurchaseSuccessPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = (params.id as string) || "";
  const txHash = searchParams.get("tx") ?? null;
  const chainId = activeHederaChain.id;
  const usdRate = useHbarUsd();

  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    fetch(`${getApiUrl()}/api/listing/${encodeURIComponent(id)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: { listing: Listing }) => setListing(data.listing))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const explorerUrl = txHash ? getTransactionExplorerUrl(txHash, chainId) : null;
  const thumb = listing?.mediaUrls?.[0] ?? listing?.imageUrl ?? null;
  const priceDisplay = listing?.price
    ? formatHbarWithUsd(formatPriceForDisplay(listing.price), usdRate)
    : null;

  return (
    <main className="min-h-screen flex items-start justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Hero confirmation — glowing green check + LOCKED pill, per the
            demo video's "Funds locked in escrow" state. */}
        <div className="flex flex-col items-center text-center mb-8">
          <div
            className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-[radial-gradient(circle_at_50%_35%,#7dffce_0%,#00ffa3_60%,#00d98a_100%)]"
            style={{ boxShadow: "0 0 48px rgba(0,255,163,0.45)" }}
          >
            <svg
              className="h-9 w-9 text-[#04150f]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">
            {listing?.requireEscrow === false ? "Purchase complete" : "Funds locked in escrow"}
          </h1>
          <p className="text-silver text-sm mt-2 max-w-sm">
            The seller has been notified.
            {listing?.requireEscrow !== false && priceDisplay
              ? ` ${formatPriceForDisplay(listing?.price ?? "0")} ℏ releases when you confirm delivery.`
              : ""}
          </p>
          {txHash && (
            <div className="mt-4 flex max-w-full items-center gap-2.5">
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#f59e0b] px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-[#2a1503]">
                <svg
                  className="h-3 w-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                  />
                </svg>
                Locked
              </span>
              <span className="truncate font-mono text-[11px] text-silver/70">tx {txHash}</span>
            </div>
          )}
        </div>

        {/* Listing card */}
        {!loading && listing && (
          <div className="glass-card p-4 flex gap-4 items-center mb-5">
            {thumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={thumb}
                alt=""
                className="w-16 h-16 object-cover flex-shrink-0"
                style={{ borderRadius: "2px" }}
              />
            ) : (
              <div className="w-16 h-16 bg-white/5 flex-shrink-0 flex items-center justify-center text-white/20 text-xs">
                No img
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-white font-semibold text-sm truncate">
                {listing.title || "Listing"}
              </p>
              {priceDisplay && (
                <p className="text-[#00ffa3] text-sm font-medium mt-0.5">{priceDisplay}</p>
              )}
              <p className="text-white/30 text-xs mt-1 font-mono truncate">
                {listing.seller.startsWith("0.0.")
                  ? listing.seller
                  : `${listing.seller.slice(0, 6)}…${listing.seller.slice(-4)}`}
              </p>
            </div>
          </div>
        )}

        {/* What happens next — escrow settles itself; nothing is required of the buyer. */}
        <div className="glass-card p-5 mb-5">
          <p className="text-[10px] font-semibold text-white/40 uppercase tracking-widest mb-2">
            What happens next
          </p>
          <p className="text-sm text-silver leading-relaxed">
            <span className="font-semibold text-white">Your payment is secured in escrow.</span>{" "}
            The seller has a week to ship — if they don&apos;t, you&apos;re refunded
            automatically. Once shipped, the seller is paid after a short window unless you
            report a problem. You never need to do anything unless something goes wrong.
          </p>
        </div>

        {/* TX hash */}
        {txHash && (
          <div className="glass-card px-4 py-3 mb-5">
            <p className="text-[10px] uppercase tracking-widest text-white/40 mb-1">
              Transaction Hash
            </p>
            <p className="text-xs font-mono text-silver/70 break-all">{txHash}</p>
            {explorerUrl && (
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[#00ffa3] hover:text-white underline mt-2 inline-block"
              >
                Verify on HashScan ↗
              </a>
            )}
          </div>
        )}

        {/* CTA buttons */}
        <div className="flex gap-3">
          <Link
            href="/marketplace"
            className="btn-mint-outline flex-1 py-3 text-center text-sm font-semibold"
          >
            Marketplace
          </Link>
          {id && (
            <Link
              href={listingHref(id)}
              className="btn-mint flex-1 py-3 text-center text-sm font-semibold"
            >
              View Listing & Escrow
            </Link>
          )}
        </div>

        {/* Loading state */}
        {loading && (
          <div className="text-center mt-8">
            <p className="text-silver text-sm">Loading purchase details…</p>
          </div>
        )}
      </div>
    </main>
  );
}
