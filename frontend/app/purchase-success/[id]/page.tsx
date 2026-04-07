"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { TransactionProgress } from "../../../components/TransactionProgress";
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

        {/* Hero confirmation */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 flex items-center justify-center bg-[#00ffa3]/10 border border-[#00ffa3]/40 mb-5"
            style={{ boxShadow: "0 0 32px rgba(0,255,163,0.2)" }}
          >
            <svg
              className="w-8 h-8 text-[#00ffa3]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Purchase Confirmed</h1>
          <p className="text-silver text-sm mt-2 max-w-xs">
            Your payment is secured in escrow. The seller has been notified.
          </p>
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

        {/* Escrow progress */}
        <div className="glass-card p-5 mb-4">
          <p className="text-[10px] font-semibold text-white/40 uppercase tracking-widest mb-1">
            Transaction Progress
          </p>
          <TransactionProgress escrowState="AWAITING_SHIPMENT" />
        </div>

        {/* What happens next */}
        <div className="glass-card p-5 mb-5">
          <p className="text-[10px] font-semibold text-white/40 uppercase tracking-widest mb-4">
            What happens next
          </p>
          <div className="space-y-4">
            <div className="flex gap-3 items-start">
              <span className="w-5 h-5 flex-shrink-0 flex items-center justify-center text-xs font-bold text-[#00ffa3] border border-[#00ffa3]/40 bg-[#00ffa3]/10">
                ✓
              </span>
              <div>
                <p className="text-white text-sm font-medium">Payment secured in escrow</p>
                <p className="text-silver text-xs mt-0.5">
                  Your funds are locked on-chain. Neither party can access them yet.
                </p>
              </div>
            </div>
            <div className="flex gap-3 items-start">
              <span className="w-5 h-5 flex-shrink-0 flex items-center justify-center text-xs font-bold text-white/30 border border-white/10 bg-white/5">
                2
              </span>
              <div>
                <p className="text-white/60 text-sm font-medium">Seller ships the item</p>
                <p className="text-silver/60 text-xs mt-0.5">
                  The seller provides tracking info and confirms shipment on-chain.
                </p>
              </div>
            </div>
            <div className="flex gap-3 items-start">
              <span className="w-5 h-5 flex-shrink-0 flex items-center justify-center text-xs font-bold text-white/30 border border-white/10 bg-white/5">
                3
              </span>
              <div>
                <p className="text-white/60 text-sm font-medium">You confirm receipt</p>
                <p className="text-silver/60 text-xs mt-0.5">
                  Once you&apos;ve received the item, confirm it on the listing page. Funds are
                  released to the seller automatically.
                </p>
              </div>
            </div>
          </div>
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
            className="btn-frost flex-1 text-center text-sm"
          >
            Marketplace
          </Link>
          {id && (
            <Link
              href={`/listing/${encodeURIComponent(id)}`}
              className="btn-frost-cta flex-1 text-center text-sm"
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
