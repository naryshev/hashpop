"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Lock } from "lucide-react";
import { AddressDisplay } from "./AddressDisplay";
import { getApiUrl } from "../lib/apiUrl";
import { formatPriceForDisplay } from "../lib/formatPrice";
import { useHbarUsd } from "../hooks/useHbarUsd";
import { activeHederaChain } from "../lib/hederaChains";

type SheetListing = {
  title?: string | null;
  imageUrl?: string | null;
  mediaUrls?: string[];
  seller?: string;
  requireEscrow?: boolean;
};

// EVM contract address → "0.0.x" id, resolved once per session via the
// mirror node so the sheet can show a real Hedera contract id (never 0x).
const contractIdCache = new Map<string, string>();

async function resolveContractIdDisplay(address: string): Promise<string | null> {
  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) return null;
  const cached = contractIdCache.get(address.toLowerCase());
  if (cached) return cached;
  try {
    const mirrorBase =
      activeHederaChain.id === 295
        ? "https://mainnet.mirrornode.hedera.com"
        : "https://testnet.mirrornode.hedera.com";
    const res = await fetch(`${mirrorBase}/api/v1/contracts/${address.toLowerCase()}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { contract_id?: string };
    if (typeof data?.contract_id === "string" && /^\d+\.\d+\.\d+$/.test(data.contract_id)) {
      contractIdCache.set(address.toLowerCase(), data.contract_id);
      return data.contract_id;
    }
  } catch {
    // row is simply hidden when the mirror node is unreachable
  }
  return null;
}

/**
 * "Confirm purchase" bottom sheet shown between the shipping-address gate and
 * the wallet approval, styled after the demo video: item row, price / network
 * fee / escrow contract rows, a green "held in on-chain escrow" banner, and a
 * gradient CONFIRM · X ℏ button.
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
  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState(false);
  const [listing, setListing] = useState<SheetListing | null>(null);
  const [contractId, setContractId] = useState<string | null>(null);
  const usdRate = useHbarUsd();

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) {
      setShown(false);
      return;
    }
    const r = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(r);
  }, [open]);

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

  if (!mounted || !open) return null;

  const hbar = formatPriceForDisplay(priceHbar || "0");
  const usd =
    usdRate && usdRate > 0 && !Number.isNaN(Number(hbar))
      ? (Number(hbar) * usdRate).toFixed(2)
      : null;
  const thumb = listing?.mediaUrls?.[0] ?? listing?.imageUrl ?? null;
  const escrowed = listing?.requireEscrow !== false;

  return createPortal(
    <div
      className="fixed inset-0 z-[140] flex items-end justify-center md:items-center md:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Confirm purchase"
    >
      <div
        className={`absolute inset-0 bg-black/60 transition-opacity duration-300 ${
          shown ? "opacity-100" : "opacity-0"
        }`}
        onClick={confirming ? undefined : onClose}
      />
      <div
        className={`relative w-full max-w-md rounded-t-3xl border border-white/10 bg-[#10161f] px-5 pt-3 shadow-[0_-12px_40px_rgba(0,0,0,0.5)] transition-all duration-300 ease-out md:rounded-3xl ${
          shown ? "translate-y-0 opacity-100" : "translate-y-full opacity-0 md:translate-y-4"
        }`}
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 20px)" }}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/15" />
        <h2 className="text-lg font-bold text-white">Confirm purchase</h2>

        {/* Item row */}
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.04] p-3">
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumb} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
          ) : (
            <div className="h-12 w-12 shrink-0 rounded-lg bg-white/5" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">
              {listing?.title || "Listing"}
            </p>
            {listing?.seller && (
              <p className="mt-0.5 flex items-center gap-1 truncate font-mono text-[11px] text-silver/60">
                by{" "}
                <AddressDisplay
                  address={listing.seller}
                  showVerified={false}
                  className="truncate"
                />
              </p>
            )}
          </div>
          <p className="shrink-0 text-sm font-extrabold text-[#00ffa3]">
            {hbar} <span className="italic">ℏ</span>
          </p>
        </div>

        {/* Breakdown rows */}
        <dl className="mt-2 divide-y divide-white/[0.06] text-sm">
          <div className="flex items-center justify-between py-3">
            <dt className="text-silver">Price</dt>
            <dd className="text-white">
              {hbar} ℏ{usd ? <span className="text-silver/70"> (${usd})</span> : null}
            </dd>
          </div>
          <div className="flex items-center justify-between py-3">
            <dt className="text-silver">Network fee</dt>
            <dd className="text-white">~0.1 ℏ</dd>
          </div>
          {contractId && (
            <div className="flex items-center justify-between py-3">
              <dt className="text-silver">{escrowed ? "Escrow contract" : "Contract"}</dt>
              <dd className="font-mono text-white">{contractId}</dd>
            </div>
          )}
        </dl>

        {/* Escrow banner */}
        <div className="mt-1 flex items-start gap-2.5 rounded-xl border border-[#00ffa3]/25 bg-[#00ffa3]/[0.07] px-3.5 py-3">
          <Lock size={14} className="mt-0.5 shrink-0 text-[#00ffa3]" />
          <p className="text-[13px] leading-snug text-white/90">
            {escrowed
              ? `${hbar} ℏ is held in on-chain escrow until you confirm delivery.`
              : "Payment is sent directly to the seller on-chain."}
          </p>
        </div>

        <button
          type="button"
          onClick={onConfirm}
          disabled={confirming}
          className="btn-mint mt-4 w-full py-4 text-sm uppercase tracking-[0.2em]"
        >
          {confirming ? "Confirm in wallet…" : `Confirm · ${hbar} ℏ`}
        </button>
      </div>
    </div>,
    document.body,
  );
}
