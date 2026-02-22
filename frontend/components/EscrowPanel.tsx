"use client";

import { useState, useEffect, useMemo } from "react";
import { useChainId } from "wagmi";
import { escrowAbi, escrowAddress } from "../lib/contracts";
import { formatPriceWeiToHbar } from "../lib/formatPrice";
import { formatHbarWithUsd } from "../lib/hbarUsd";
import { useHbarUsd } from "../hooks/useHbarUsd";
import { getApiUrl } from "../lib/apiUrl";
import { getTransactionErrorMessage } from "../lib/transactionError";
import { AddressDisplay } from "./AddressDisplay";
import { useRobustContractWrite } from "../hooks/useRobustContractWrite";
import { useHashpackWallet } from "../lib/hashpackWallet";

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
}: {
  listingId: string;
  sellerAddress: string;
}) {
  const { address } = useHashpackWallet();
  const chainId = useChainId();
  const [escrow, setEscrow] = useState<EscrowData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
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

  const isSeller = address && sellerAddress && address.toLowerCase() === sellerAddress.toLowerCase();
  const isBuyer = address && escrow && address.toLowerCase() === escrow.buyer.toLowerCase();

  const confirmShipment = async () => {
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
  };

  const displayError = shipError ?? receiptError;
  const errorMessage = getTransactionErrorMessage(displayError, { chainId });

  if (loading) {
    return (
      <div className="glass-card p-4 rounded-lg border border-white/10">
        <p className="text-silver text-sm">Loading escrow status…</p>
      </div>
    );
  }

  if (fetchError || !escrow) {
    return (
      <div className="glass-card p-4 rounded-lg border border-white/10">
        <p className="text-silver text-sm">{fetchError ?? "No escrow data"}</p>
      </div>
    );
  }

  const stateLabel =
    escrow.state === "AWAITING_SHIPMENT"
      ? "Awaiting proof of shipment"
      : escrow.state === "AWAITING_CONFIRMATION"
        ? "Awaiting buyer confirmation"
        : "Complete";

  return (
    <div className="glass-card p-4 rounded-lg border border-white/10 space-y-4">
      <h3 className="text-lg font-semibold text-white">Escrow</h3>
      <p className="text-sm text-silver">
        Payment is held in escrow until the seller confirms shipment and the buyer confirms receipt.
      </p>
      <div className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm">
        <p className="text-silver">
          Status: <span className="text-white font-medium">{stateLabel}</span>
        </p>
        <p className="text-silver mt-1">
          Amount: <span className="text-chrome">{formatHbarWithUsd(formatPriceWeiToHbar(escrow.amount), usdRate)}</span>
        </p>
        <p className="text-silver mt-0.5 text-xs">
          Buyer: <AddressDisplay address={escrow.buyer} className="text-chrome" />
        </p>
        <p className="text-silver text-xs">
          Timeout: {new Date(escrow.timeoutAt * 1000).toLocaleDateString()} (refund or release)
        </p>
      </div>

      {escrow.state === "AWAITING_SHIPMENT" && isSeller && (
        <div>
          <p className="text-sm text-silver mb-2">
            You are the seller. After you ship the item, mark it as shipped so the buyer can confirm receipt and release payment.
          </p>
          <button
            type="button"
            onClick={() => void confirmShipment()}
            disabled={shipPending || shipConfirming}
            className="btn-frost-cta w-full disabled:opacity-60"
          >
            {shipPending || shipConfirming ? "Confirm in wallet…" : "Mark as shipped (proof of shipment)"}
          </button>
        </div>
      )}

      {escrow.state === "AWAITING_CONFIRMATION" && isBuyer && (
        <div>
          <p className="text-sm text-silver mb-2">
            You are the buyer. After you receive the item, confirm receipt to release payment to the seller.
          </p>
          <button
            type="button"
            onClick={() => void confirmReceipt()}
            disabled={receiptPending || receiptConfirming}
            className="btn-frost-cta w-full disabled:opacity-60"
          >
            {receiptPending || receiptConfirming ? "Confirm in wallet…" : "Confirm receipt (release payment)"}
          </button>
        </div>
      )}

      {escrow.state === "AWAITING_SHIPMENT" && !isSeller && !isBuyer && (
        <p className="text-sm text-silver">Only the seller can mark this as shipped.</p>
      )}
      {escrow.state === "AWAITING_CONFIRMATION" && !isBuyer && !isSeller && (
        <p className="text-sm text-silver">Only the buyer can confirm receipt.</p>
      )}
      {escrow.state === "AWAITING_CONFIRMATION" && isSeller && (
        <p className="text-sm text-silver">Waiting for the buyer to confirm receipt. Payment will then be released to you.</p>
      )}
      {escrow.state === "AWAITING_SHIPMENT" && isBuyer && (
        <p className="text-sm text-silver">Waiting for the seller to mark the item as shipped. After that, you can confirm receipt to complete.</p>
      )}

      {escrow.state === "COMPLETE" && (
        <p className="text-sm text-emerald-400">Escrow complete. Payment has been released.</p>
      )}

      {errorMessage && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2">
          <p className="text-sm text-red-400">{errorMessage}</p>
        </div>
      )}
    </div>
  );
}
