"use client";

import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { AddressDisplay } from "./AddressDisplay";
import { Sheet } from "./ui/Sheet";
import { getApiUrl } from "../lib/apiUrl";
import { formatPriceForDisplay } from "../lib/formatPrice";
import { useHbarUsd } from "../hooks/useHbarUsd";
import { resolveContractIdDisplay } from "../lib/contractId";
import { listingCta, material } from "../lib/materials";
import { cn } from "../lib/utils";

const HBAR = "\u210F";

type SheetListing = {
  title?: string | null;
  imageUrl?: string | null;
  mediaUrls?: string[];
  seller?: string;
  requireEscrow?: boolean;
};

/**
 * "Confirm purchase" bottom sheet shown between the shipping-address gate and
 * the wallet approval: item row, price / network fee / escrow contract rows,
 * an on-chain escrow banner, and a Confirm CTA.
 */
export function ConfirmPurchaseSheet({
  open,
  listingId,
  priceHbar,
  contractAddress,
  confirming = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  listingId: string;
  /** Display price in HBAR (e.g. "100"). */
  priceHbar: string;
  /** EVM address of the contract that receives the payment. */
  contractAddress?: string;
  confirming?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const [listing, setListing] = useState<SheetListing | null>(null);
  const [contractId, setContractId] = useState<string | null>(null);
  const usdRate = useHbarUsd();

  useEffect(() => {
    if (!open || !listingId) return;
    let cancelled = false;
    fetch(`${getApiUrl()}/api/listing/${encodeURIComponent(listingId)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: { listing?: SheetListing }) => {
        if (!cancelled && data.listing) setListing(data.listing);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, listingId]);

  useEffect(() => {
    if (!open || !contractAddress) return;
    let cancelled = false;
    void resolveContractIdDisplay(contractAddress).then((id) => {
      if (!cancelled) setContractId(id);
    });
    return () => {
      cancelled = true;
    };
  }, [open, contractAddress]);

  const hbar = formatPriceForDisplay(priceHbar || "0");
  const usd =
    usdRate && usdRate > 0 && !Number.isNaN(Number(hbar))
      ? (Number(hbar) * usdRate).toFixed(2)
      : null;
  const thumb = listing?.mediaUrls?.[0] ?? listing?.imageUrl ?? null;
  const escrowed = listing?.requireEscrow !== false;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      detent="medium"
      dismissible={!confirming}
      title="Confirm purchase"
      footer={
        <button
          type="button"
          onClick={onConfirm}
          disabled={confirming}
          className={listingCta.filled}
        >
          {confirming ? "Confirm in wallet\u2026" : `Confirm \u00b7 ${hbar} ${HBAR}`}
        </button>
      }
    >
      <div className={cn(material.regular, "flex items-center gap-3 rounded-xl p-3")}>
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
        ) : (
          <div className="h-12 w-12 shrink-0 rounded-lg bg-white/5" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{listing?.title || "Listing"}</p>
          {listing?.seller && (
            <p className="mt-0.5 flex items-center gap-1 truncate font-mono text-[11px] text-silver/60">
              by{" "}
              <AddressDisplay address={listing.seller} showVerified={false} className="truncate" />
            </p>
          )}
        </div>
        <p className="shrink-0 text-sm font-extrabold text-chrome">
          {hbar} <span className="italic">{HBAR}</span>
        </p>
      </div>

      <dl className="mt-2 divide-y divide-hairline text-sm">
        <div className="flex items-center justify-between py-3">
          <dt className="text-silver">Price</dt>
          <dd className="text-white">
            {hbar} {HBAR}
            {usd ? <span className="text-silver/70"> (${usd})</span> : null}
          </dd>
        </div>
        <div className="flex items-center justify-between py-3">
          <dt className="text-silver">Network fee</dt>
          <dd className="text-white">~0.1 {HBAR}</dd>
        </div>
        {contractId && (
          <div className="flex items-center justify-between py-3">
            <dt className="text-silver">{escrowed ? "Escrow contract" : "Contract"}</dt>
            <dd className="font-mono text-white">{contractId}</dd>
          </div>
        )}
      </dl>

      <div className="mt-1 flex items-start gap-2.5 rounded-xl border border-[#00ffa3]/25 bg-[#00ffa3]/10 px-3.5 py-3">
        <Lock size={14} className="mt-0.5 shrink-0 text-chrome" />
        <p className="text-[13px] leading-snug text-white/90">
          {escrowed
            ? `${hbar} ${HBAR} is held in on-chain escrow until you confirm delivery.`
            : "Payment is sent directly to the seller on-chain."}
        </p>
      </div>
    </Sheet>
  );
}
