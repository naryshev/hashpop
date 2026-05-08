"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { parseUnits } from "viem";
import { marketplaceAbi, marketplaceAddress } from "../lib/contracts";
import { listingIdToBytes32 } from "../lib/bytes32";
import { useRobustContractWrite } from "../hooks/useRobustContractWrite";
import { getApiUrl } from "../lib/apiUrl";
import { getTransactionErrorMessage } from "../lib/transactionError";
import { activeHederaChain } from "../lib/hederaChains";
import { useHashpackWallet } from "../lib/hashpackWallet";
import { formatPriceForDisplay } from "../lib/formatPrice";
import { formatHbarWithUsd } from "../lib/hbarUsd";
import { useHbarUsd } from "../hooks/useHbarUsd";

type Props = {
  open: boolean;
  onClose: () => void;
  listingId: string;
  /** Listing's asking price in HBAR (display string), used as initial offer value. */
  askingPriceHbar: string;
  onOfferSubmitted?: (txHash: string, amountHbar: string) => void;
};

/**
 * "Enter Your Offer" popup. Buyer enters an HBAR amount, we lock it in the
 * marketplace contract via makeOffer(), then mirror the OfferMade event to
 * the backend so the seller's listing page sees the pending offer.
 */
export function OfferModal({ open, onClose, listingId, askingPriceHbar, onOfferSubmitted }: Props) {
  const { address } = useHashpackWallet();
  const { send, isPending } = useRobustContractWrite();
  const chainId = activeHederaChain.id;
  const usdRate = useHbarUsd();
  const initialAmount = useMemo(
    () => formatPriceForDisplay(askingPriceHbar || "0"),
    [askingPriceHbar],
  );
  const [amount, setAmount] = useState(initialAmount);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setAmount(initialAmount);
      setError(null);
      // Defer focus to the next tick so the modal has mounted.
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [open, initialAmount]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isPending) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, isPending, onClose]);

  if (!open) return null;

  const numeric = Number(amount);
  const canSubmit = !!address && !isPending && Number.isFinite(numeric) && numeric > 0;

  const handleSubmit = async () => {
    setError(null);
    if (!address) {
      setError("Connect your wallet to make an offer.");
      return;
    }
    if (!Number.isFinite(numeric) || numeric <= 0) {
      setError("Enter a positive HBAR amount.");
      return;
    }
    try {
      const idBytes = listingIdToBytes32(listingId);
      const value = parseUnits(String(amount), 8);
      const txHash = await send({
        address: marketplaceAddress,
        abi: marketplaceAbi,
        functionName: "makeOffer",
        args: [idBytes],
        value,
      });
      // Best-effort mirror to backend so the seller sees the pending offer
      // immediately without waiting for the indexer to catch up.
      await fetch(`${getApiUrl()}/api/sync-offer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          txHash,
          listingId: idBytes,
          buyer: address,
          amount: String(amount),
        }),
      }).catch(() => {});
      onOfferSubmitted?.(txHash, String(amount));
      onClose();
    } catch (e) {
      setError(getTransactionErrorMessage(e, { chainId }));
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={() => {
        if (!isPending) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Enter your offer"
    >
      <div
        className="relative w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-black">Enter Your Offer</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="text-base font-medium text-black/70 hover:text-black disabled:opacity-50"
          >
            Cancel
          </button>
        </div>

        <div className="mb-2 rounded-lg border-2 border-emerald-500 px-6 py-5 focus-within:ring-2 focus-within:ring-emerald-200">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-black">ℏ</span>
            <input
              ref={inputRef}
              type="number"
              step="any"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canSubmit) {
                  e.preventDefault();
                  void handleSubmit();
                }
              }}
              className="w-full bg-transparent text-3xl font-bold text-black outline-none placeholder:text-black/30"
              placeholder="0"
              aria-label="Offer amount in HBAR"
            />
          </div>
        </div>
        <p className="mb-6 text-xs text-black/60">
          {numeric > 0
            ? `≈ ${formatHbarWithUsd(String(amount), usdRate)}`
            : `Asking price: ${formatHbarWithUsd(initialAmount, usdRate)}`}
        </p>

        {error && (
          <p className="mb-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={!canSubmit}
          className="w-full rounded-full bg-emerald-500 py-4 text-base font-bold text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
        >
          {isPending ? "Confirm in wallet…" : "Make offer"}
        </button>

        <p className="mt-3 text-center text-[11px] text-black/50">
          Funds lock in escrow until the seller accepts or rejects.
        </p>
      </div>
    </div>
  );
}
