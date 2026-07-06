"use client";

import { useState, useEffect, useMemo } from "react";
import { escrowAbi, escrowAddress } from "../lib/contracts";
import { formatContractAmountToHbar } from "../lib/formatPrice";
import { formatHbarWithUsd } from "../lib/hbarUsd";
import { useHbarUsd } from "../hooks/useHbarUsd";
import { getApiUrl } from "../lib/apiUrl";
import { getTransactionErrorMessage } from "../lib/transactionError";
import { AddressDisplay } from "./AddressDisplay";
import { useRobustContractWrite } from "../hooks/useRobustContractWrite";
import { useHashpackWallet } from "../lib/hashpackWallet";
import { activeHederaChain } from "../lib/hederaChains";
import { CARRIERS, carrierTrackingUrl } from "../lib/trackingUrl";
import {
  ESCROW_V2,
  EscrowView,
  orderStatusLine,
  phaseFor,
  StatusLine,
} from "../lib/orderStatus";

/** Buyer-facing tracking line with a clickable link to the carrier's tracking page. */
function TrackingLink({
  trackingNumber,
  trackingCarrier,
}: {
  trackingNumber: string;
  trackingCarrier?: string | null;
}) {
  const url = carrierTrackingUrl(trackingCarrier, trackingNumber);
  return (
    <p className="text-xs text-chrome">
      Tracking:{" "}
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-white"
        >
          {trackingNumber}
          {trackingCarrier ? ` (${trackingCarrier})` : ""}
        </a>
      ) : (
        <>
          {trackingNumber}
          {trackingCarrier ? ` (${trackingCarrier})` : ""}
        </>
      )}
    </p>
  );
}

function toBytes32(listingId: string): `0x${string}` {
  if (listingId.startsWith("0x") && listingId.length === 66) return listingId as `0x${string}`;
  const hex = Array.from(new TextEncoder().encode(listingId))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `0x${hex.padEnd(64, "0").slice(0, 64)}` as `0x${string}`;
}

const TONE_CLASSES: Record<StatusLine["tone"], { dot: string; label: string }> = {
  waiting: { dot: "bg-amber-300", label: "text-amber-200" },
  active: { dot: "bg-blue-300", label: "text-blue-200" },
  complete: { dot: "bg-emerald-400", label: "text-emerald-300" },
  refunded: { dot: "bg-rose-300", label: "text-rose-200" },
  disputed: { dot: "bg-rose-400", label: "text-rose-300" },
};

/** Single status line — "Paid · seller has until Jul 13 to ship". */
function StatusLineRow({ status }: { status: StatusLine }) {
  const tone = TONE_CLASSES[status.tone];
  return (
    <div className="flex items-start gap-2.5">
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${tone.dot}`} />
      <p className="text-sm leading-relaxed text-silver">
        <span className={`font-semibold ${tone.label}`}>{status.label}</span>
        <span className="mx-1.5 text-white/30">·</span>
        {status.detail}
      </p>
    </div>
  );
}

export function EscrowPanel({
  listingId,
  sellerAddress,
  requireEscrow,
  trackingNumber,
  trackingCarrier,
  onEscrowUpdated,
}: {
  listingId: string;
  sellerAddress: string;
  requireEscrow: boolean;
  trackingNumber?: string | null;
  trackingCarrier?: string | null;
  onEscrowUpdated?: () => void;
}) {
  const { address } = useHashpackWallet();
  const chainId = activeHederaChain.id;
  const [escrow, setEscrow] = useState<EscrowView | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [trackingInput, setTrackingInput] = useState(trackingNumber ?? "");
  const [carrierInput, setCarrierInput] = useState(trackingCarrier ?? "");
  const [trackingSaveError, setTrackingSaveError] = useState<string | null>(null);
  const [trackingSaving, setTrackingSaving] = useState(false);
  const [trackingSaved, setTrackingSaved] = useState(false);
  const usdRate = useHbarUsd();

  const idBytes = useMemo(() => toBytes32(listingId), [listingId]);

  const {
    send: sendConfirmShipment,
    isPending: shipPending,
    error: shipError,
    lastHash: shipHash,
  } = useRobustContractWrite();
  const {
    send: sendConfirmReceipt,
    isPending: receiptPending,
    error: receiptError,
    lastHash: receiptHash,
  } = useRobustContractWrite();
  const shipSuccess = !!shipHash;
  const receiptSuccess = !!receiptHash;

  useEffect(() => {
    if (!listingId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setFetchError(null);
    fetch(`${getApiUrl()}/api/escrow/${encodeURIComponent(listingId)}`)
      .then((r) => {
        if (r.ok) return r.json();
        if (r.status === 404) return null;
        throw new Error("Failed to load escrow");
      })
      .then((data: EscrowView | null) => {
        setEscrow(data);
      })
      .catch((e) => {
        setFetchError(e instanceof Error ? e.message : "Failed to load escrow");
        setEscrow(null);
      })
      .finally(() => setLoading(false));
  }, [listingId, shipSuccess, receiptSuccess]);

  useEffect(() => {
    setTrackingInput(trackingNumber ?? "");
  }, [trackingNumber]);

  useEffect(() => {
    setCarrierInput(trackingCarrier ?? "");
  }, [trackingCarrier]);

  const isSeller =
    address && sellerAddress && address.toLowerCase() === sellerAddress.toLowerCase();
  const isBuyer = address && escrow && address.toLowerCase() === escrow.buyer.toLowerCase();

  const saveTracking = async (): Promise<boolean> => {
    setTrackingSaving(true);
    setTrackingSaveError(null);
    try {
      const res = await fetch(`${getApiUrl()}/api/listing/${encodeURIComponent(listingId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sellerAddress: address,
          trackingNumber: trackingInput.trim(),
          trackingCarrier: carrierInput.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Failed to save tracking details.");
      }
      setTrackingSaved(true);
      onEscrowUpdated?.();
      return true;
    } catch (e) {
      setTrackingSaveError(e instanceof Error ? e.message : "Failed to save tracking details.");
      return false;
    } finally {
      setTrackingSaving(false);
    }
  };

  const confirmShipment = async () => {
    if (requireEscrow && !trackingInput.trim()) {
      setTrackingSaveError("Tracking number is required before marking as shipped.");
      return;
    }
    if (requireEscrow) {
      const ok = await saveTracking();
      if (!ok) return;
    }
    if (ESCROW_V2) {
      // No wallet transaction: the settlement engine verifies the tracking
      // number and records the shipment on-chain on the seller's behalf.
      return;
    }
    await sendConfirmShipment({
      address: escrowAddress,
      abi: escrowAbi,
      functionName: "confirmShipment",
      args: [idBytes],
    });
  };

  const confirmReceipt = async () => {
    await sendConfirmReceipt({
      address: escrowAddress,
      abi: escrowAbi,
      functionName: "confirmReceipt",
      args: [idBytes],
    });
    await fetch(`${getApiUrl()}/api/sync-escrow-complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId }),
    }).catch(() => {});
    onEscrowUpdated?.();
  };

  const displayError = shipError ?? receiptError;
  const errorMessage = getTransactionErrorMessage(displayError, { chainId });

  if (loading) {
    return (
      <div className="glass-card p-5 border border-white/10">
        <p className="text-silver text-sm">Loading order status…</p>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="glass-card p-5 border border-white/10">
        <p className="text-silver text-sm">{fetchError}</p>
      </div>
    );
  }

  if (!escrow) {
    return (
      <div className="glass-card border border-white/10 overflow-hidden">
        <div className="px-5 pt-5 pb-2">
          <h3 className="text-lg font-semibold text-white">Order status</h3>
        </div>
        <div className="border-t border-white/[0.06] px-5 py-4 bg-white/[0.02]">
          <StatusLineRow
            status={{
              label: "Paid",
              detail:
                "Your payment is secured on-chain. The escrow record is initializing — this can take a moment after purchase.",
              tone: "waiting",
            }}
          />
        </div>
      </div>
    );
  }

  const role: "buyer" | "seller" | "observer" = isSeller
    ? "seller"
    : isBuyer
      ? "buyer"
      : "observer";
  const phase = phaseFor(escrow.state, escrow.disputed);
  const status = orderStatusLine({ phase, role, timeoutAt: escrow.timeoutAt, isEscrow: true });
  const live = phase === "paid" || phase === "shipped";
  const awaitingShipment = escrow.state === "AWAITING_SHIPMENT";
  // v1's confirmReceipt only works after the seller confirms shipment; v2
  // accepts it from any live state (local pickup with no tracking).
  const buyerCanRelease = isBuyer && live && (ESCROW_V2 || phase === "shipped");

  return (
    <div className="glass-card border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Order status</h3>
          <span
            className={`text-xs font-medium px-2.5 py-1 rounded-full border ${
              isSeller
                ? "bg-amber-500/15 border-amber-400/30 text-amber-300"
                : isBuyer
                  ? "bg-blue-500/15 border-blue-400/30 text-blue-300"
                  : "bg-white/5 border-white/10 text-silver"
            }`}
          >
            {role === "observer" ? "Observer" : role === "seller" ? "Seller" : "Buyer"}
          </span>
        </div>
      </div>

      {/* The status line — replaces the old 4-step stepper. */}
      <div className="px-5 pb-4">
        <StatusLineRow status={status} />
      </div>

      {/* Transaction details */}
      <div className="px-5 pb-4">
        <div className="rounded-glass bg-white/[0.03] border border-white/[0.06] p-3">
          <div className="flex items-center justify-between gap-3 text-sm">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-white/40 mb-0.5">Buyer</p>
              <AddressDisplay address={escrow.buyer} className="text-blue-300 text-xs" />
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider text-white/40 mb-0.5">Seller</p>
              <AddressDisplay address={escrow.seller} className="text-amber-300 text-xs" />
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider text-white/40 mb-0.5">
                In escrow
              </p>
              <p className="text-chrome font-semibold text-xs">
                {formatHbarWithUsd(formatContractAmountToHbar(escrow.amount), usdRate)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Action area */}
      <div className="border-t border-white/[0.06] px-5 py-4 bg-white/[0.02] space-y-3">
        {/* Seller: enter tracking. With EscrowV2 that's the entire shipping
            flow — no wallet transaction. */}
        {awaitingShipment && isSeller && !escrow.disputed && (
          <div className="space-y-3">
            {requireEscrow && (
              <div className="space-y-2">
                <input
                  value={trackingInput}
                  onChange={(e) => setTrackingInput(e.target.value)}
                  placeholder="Tracking number *"
                  className="input-frost w-full text-sm"
                />
                <input
                  value={carrierInput}
                  onChange={(e) => setCarrierInput(e.target.value)}
                  placeholder="Carrier (e.g. USPS, UPS, FedEx)"
                  list="escrow-carriers"
                  className="input-frost w-full text-sm"
                />
                <datalist id="escrow-carriers">
                  {CARRIERS.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
            )}
            {ESCROW_V2 && trackingSaved ? (
              <p className="text-sm text-emerald-300">
                Tracking saved — the shipment will be recorded on-chain automatically.
              </p>
            ) : (
              <button
                type="button"
                onClick={() => void confirmShipment()}
                disabled={shipPending || trackingSaving || (requireEscrow && !trackingInput.trim())}
                className="btn-frost-cta w-full disabled:opacity-60"
              >
                {trackingSaving
                  ? "Saving…"
                  : shipPending
                    ? "Confirm in wallet…"
                    : ESCROW_V2
                      ? "Mark as shipped"
                      : "Confirm Shipment / Handoff"}
              </button>
            )}
            {trackingSaveError && <p className="text-xs text-rose-300">{trackingSaveError}</p>}
          </div>
        )}

        {/* Buyer: tracking + optional early release. */}
        {isBuyer && live && (
          <div className="space-y-3">
            {trackingNumber && (
              <div className="rounded-glass bg-white/5 border border-white/10 px-3 py-2">
                <TrackingLink trackingNumber={trackingNumber} trackingCarrier={trackingCarrier} />
              </div>
            )}
            {buyerCanRelease && (
              <button
                type="button"
                onClick={() => void confirmReceipt()}
                disabled={receiptPending}
                className="btn-frost-cta w-full disabled:opacity-60"
              >
                {receiptPending ? "Confirm in wallet…" : "Got it — release now"}
              </button>
            )}
            {ESCROW_V2 && buyerCanRelease && (
              <p className="text-xs text-silver/70">
                Optional — funds release automatically on the date above if you do nothing.
              </p>
            )}
          </div>
        )}

        {/* Seller waiting on release. */}
        {phase === "shipped" && isSeller && trackingNumber && (
          <TrackingLink trackingNumber={trackingNumber} trackingCarrier={trackingCarrier} />
        )}

        {/* Final states get a quiet confirmation row. */}
        {phase === "complete" && (
          <p className="text-center text-sm font-medium text-emerald-400">
            Funds released to the seller. Trade complete.
          </p>
        )}
        {phase === "refunded" && (
          <p className="text-center text-sm font-medium text-rose-300">
            Escrow refunded — the buyer&apos;s payment was returned.
          </p>
        )}

        {errorMessage && (
          <div className="rounded-glass bg-red-500/10 border border-red-500/30 px-3 py-2">
            <p className="text-sm text-red-400">{errorMessage}</p>
          </div>
        )}
      </div>
    </div>
  );
}
