"use client";

import { useState, useEffect, useMemo } from "react";
import { escrowAbi, escrowAddress } from "../lib/contracts";
import { formatContractAmountToHbar } from "../lib/formatPrice";
import { formatHbarWithUsd } from "../lib/hbarUsd";
import { useHbarUsd } from "../hooks/useHbarUsd";
import { getApiUrl } from "../lib/apiUrl";
import { getTransactionErrorMessage } from "../lib/transactionError";
import { AddressDisplay } from "./AddressDisplay";
import { TransactionProgress } from "./TransactionProgress";
import { useRobustContractWrite } from "../hooks/useRobustContractWrite";
import { useHashpackWallet } from "../lib/hashpackWallet";
import { activeHederaChain } from "../lib/hederaChains";

function toBytes32(listingId: string): `0x${string}` {
  if (listingId.startsWith("0x") && listingId.length === 66) return listingId as `0x${string}`;
  const hex = Array.from(new TextEncoder().encode(listingId))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `0x${hex.padEnd(64, "0").slice(0, 64)}` as `0x${string}`;
}

type EscrowState = "AWAITING_SHIPMENT" | "AWAITING_CONFIRMATION" | "COMPLETE" | "UNKNOWN";

type EscrowData = {
  buyer: string;
  seller: string;
  amount: string;
  createdAt: number;
  timeoutAt: number;
  state: EscrowState;
};

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
  const [escrow, setEscrow] = useState<EscrowData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [trackingInput, setTrackingInput] = useState(trackingNumber ?? "");
  const [carrierInput, setCarrierInput] = useState(trackingCarrier ?? "");
  const [trackingSaveError, setTrackingSaveError] = useState<string | null>(null);
  const [trackingSaving, setTrackingSaving] = useState(false);
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
  const shipConfirming = false;
  const receiptConfirming = false;
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
      .then((data: EscrowData | null) => {
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

  const isSeller = address && sellerAddress && address.toLowerCase() === sellerAddress.toLowerCase();
  const isBuyer = address && escrow && address.toLowerCase() === escrow.buyer.toLowerCase();

  const confirmShipment = async () => {
    if (requireEscrow && !trackingInput.trim()) {
      setTrackingSaveError("Tracking number is required before marking as shipped.");
      return;
    }
    if (requireEscrow) {
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
        onEscrowUpdated?.();
      } catch (e) {
        setTrackingSaveError(e instanceof Error ? e.message : "Failed to save tracking details.");
        setTrackingSaving(false);
        return;
      } finally {
        setTrackingSaving(false);
      }
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
      <div className="glass-card p-5 rounded-xl border border-white/10">
        <p className="text-silver text-sm">Loading escrow status…</p>
      </div>
    );
  }

  if (fetchError || !escrow) {
    return (
      <div className="glass-card p-5 rounded-xl border border-white/10">
        <p className="text-silver text-sm">{fetchError ?? "No escrow data"}</p>
      </div>
    );
  }

  const roleLabel = isSeller ? "Seller" : isBuyer ? "Buyer" : "Observer";

  return (
    <div className="glass-card rounded-xl border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Escrow Transaction</h3>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${
            isSeller
              ? "bg-amber-500/15 border-amber-400/30 text-amber-300"
              : isBuyer
                ? "bg-blue-500/15 border-blue-400/30 text-blue-300"
                : "bg-white/5 border-white/10 text-silver"
          }`}>
            {roleLabel}
          </span>
        </div>
        <p className="text-xs text-silver mt-1">
          Funds held by platform escrow until both parties fulfill their obligations.
        </p>
      </div>

      {/* Progress Bar */}
      <div className="px-5">
        <TransactionProgress escrowState={escrow.state} />
      </div>

      {/* Transaction Details */}
      <div className="px-5 pb-4">
        <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3 space-y-2">
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-white/40 mb-0.5">Buyer</p>
              <AddressDisplay address={escrow.buyer} className="text-blue-300 text-xs" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-white/40 mb-0.5">Escrow</p>
              <p className="text-emerald-300 text-xs font-medium">Platform</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-white/40 mb-0.5">Seller</p>
              <AddressDisplay address={escrow.seller} className="text-amber-300 text-xs" />
            </div>
          </div>
          <div className="flex items-center justify-between pt-1 border-t border-white/[0.06]">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-white/40">Amount in escrow</p>
              <p className="text-chrome font-semibold text-sm">
                {formatHbarWithUsd(formatContractAmountToHbar(escrow.amount), usdRate)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider text-white/40">Timeout</p>
              <p className="text-silver text-xs">
                {new Date(escrow.timeoutAt * 1000).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Action Area */}
      <div className="border-t border-white/[0.06] px-5 py-4 bg-white/[0.02]">
        {/* Seller: confirm shipment */}
        {escrow.state === "AWAITING_SHIPMENT" && isSeller && (
          <div className="space-y-3">
            <p className="text-sm text-silver">
              Provide proof of shipment or handoff to proceed. The buyer&apos;s payment will remain in escrow until they confirm receipt.
            </p>
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
                  placeholder="Carrier (optional)"
                  className="input-frost w-full text-sm"
                />
              </div>
            )}
            <button
              type="button"
              onClick={() => void confirmShipment()}
              disabled={shipPending || shipConfirming || trackingSaving || (requireEscrow && !trackingInput.trim())}
              className="btn-frost-cta w-full disabled:opacity-60"
            >
              {shipPending || shipConfirming || trackingSaving ? "Confirm in wallet…" : "Confirm Shipment / Handoff"}
            </button>
            {trackingSaveError && <p className="text-xs text-rose-300">{trackingSaveError}</p>}
          </div>
        )}

        {/* Buyer: confirm receipt */}
        {escrow.state === "AWAITING_CONFIRMATION" && isBuyer && (
          <div className="space-y-3">
            <p className="text-sm text-silver">
              The seller has shipped / handed off the item. Once you confirm receipt, funds will be released from escrow to the seller&apos;s wallet.
            </p>
            {trackingNumber && (
              <div className="rounded-lg bg-white/5 border border-white/10 px-3 py-2">
                <p className="text-xs text-chrome">
                  Tracking: {trackingNumber}
                  {trackingCarrier ? ` (${trackingCarrier})` : ""}
                </p>
              </div>
            )}
            <button
              type="button"
              onClick={() => void confirmReceipt()}
              disabled={receiptPending || receiptConfirming}
              className="btn-frost-cta w-full disabled:opacity-60"
            >
              {receiptPending || receiptConfirming ? "Confirm in wallet…" : "Confirm Receipt — Release Payment"}
            </button>
          </div>
        )}

        {/* Waiting states */}
        {escrow.state === "AWAITING_SHIPMENT" && isBuyer && (
          <div className="space-y-2">
            <p className="text-sm text-silver">
              Your payment is secured in escrow. Waiting for the seller to provide proof of shipment or handoff.
            </p>
            {trackingNumber && (
              <p className="text-xs text-chrome">
                Tracking: {trackingNumber}{trackingCarrier ? ` (${trackingCarrier})` : ""}
              </p>
            )}
          </div>
        )}
        {escrow.state === "AWAITING_CONFIRMATION" && isSeller && (
          <div className="space-y-2">
            <p className="text-sm text-silver">
              Shipment confirmed. Waiting for the buyer to confirm receipt. Funds will be released to your wallet once confirmed.
            </p>
            {trackingNumber && (
              <p className="text-xs text-chrome">
                Tracking: {trackingNumber}{trackingCarrier ? ` (${trackingCarrier})` : ""}
              </p>
            )}
          </div>
        )}

        {/* Observer states */}
        {escrow.state === "AWAITING_SHIPMENT" && !isSeller && !isBuyer && (
          <p className="text-sm text-silver">Waiting for the seller to confirm shipment.</p>
        )}
        {escrow.state === "AWAITING_CONFIRMATION" && !isBuyer && !isSeller && (
          <p className="text-sm text-silver">Waiting for the buyer to confirm receipt.</p>
        )}

        {/* Complete */}
        {escrow.state === "COMPLETE" && (
          <div className="text-center py-1">
            <p className="text-emerald-400 font-medium">Transaction Complete</p>
            <p className="text-xs text-silver mt-1">
              Funds have been released from escrow to the seller&apos;s wallet.
            </p>
          </div>
        )}

        {errorMessage && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 mt-3">
            <p className="text-sm text-red-400">{errorMessage}</p>
          </div>
        )}
      </div>
    </div>
  );
}
