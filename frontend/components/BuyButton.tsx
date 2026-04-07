"use client";

import { useState, useMemo, useEffect } from "react";
import { marketplaceAbi, marketplaceAddress } from "../lib/contracts";
import { formatPriceForDisplay } from "../lib/formatPrice";
import { formatHbarWithUsd } from "../lib/hbarUsd";
import { getTransactionErrorMessage } from "../lib/transactionError";
import { useHbarUsd } from "../hooks/useHbarUsd";
import { listingIdToBytes32 } from "../lib/bytes32";
import { useRobustContractWrite } from "../hooks/useRobustContractWrite";
import { useHashpackWallet } from "../lib/hashpackWallet";
import { activeHederaChain } from "../lib/hederaChains";
import { parseUnits } from "viem";
import { readListingCompat } from "../lib/marketplaceRead";
import { getApiUrl } from "../lib/apiUrl";
import { getTransactionExplorerUrl } from "../lib/explorer";

export function BuyButton({
  listingId,
  price: _price,
  inWishlist = false,
  onToggleWishlist,
  wishlistDisabled = false,
  onPurchaseComplete,
  onMessage,
  onMakeOffer,
}: {
  listingId: string;
  price: string;
  inWishlist?: boolean;
  onToggleWishlist?: () => void;
  wishlistDisabled?: boolean;
  onPurchaseComplete?: () => void;
  onMessage?: () => void;
  onMakeOffer?: () => void;
}) {
  const idBytes = useMemo(() => listingIdToBytes32(listingId), [listingId]);

  const { address } = useHashpackWallet();
  const chainId = activeHederaChain.id;
  const isWrongNetwork = false;
  const [onChainListing, setOnChainListing] = useState<
    { price: bigint; status: number } | undefined
  >(undefined);
  const [chainReadFailed, setChainReadFailed] = useState(false);

  function parsePriceWei(raw: unknown): bigint {
    if (raw == null) return 0n;
    if (typeof raw === "bigint") return raw;
    if (typeof raw === "number") return BigInt(Math.floor(raw));
    if (typeof raw === "string") return BigInt(raw);
    const o = raw as { _hex?: string; value?: string; toString?: () => string };
    if (o._hex) return BigInt(o._hex);
    if (o.value != null) return BigInt(o.value);
    if (typeof o.toString === "function") return BigInt(o.toString());
    return 0n;
  }
  const [notOnChain, setNotOnChain] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void readListingCompat(idBytes)
      .then((data) => {
        if (!cancelled) {
          const p = parsePriceWei(data.price);
          const s = Number(data.status ?? 0);
          if (p === 0n && s === 0) {
            setOnChainListing(undefined);
            setChainReadFailed(true);
            setNotOnChain(true);
          } else {
            setOnChainListing({ price: p, status: s });
            setChainReadFailed(false);
            setNotOnChain(false);
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setOnChainListing(undefined);
          setChainReadFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [idBytes]);
  const priceWei = parsePriceWei(onChainListing?.price);
  const hasPrice = priceWei > 0n;
  const hasApiPrice = !!_price && _price !== "0";
  const isLegacyWeiListing = priceWei >= 10n ** 15n;

  const { send, isPending, error: writeError } = useRobustContractWrite();
  const isConfirming = false;
  const [isSuccess, setIsSuccess] = useState(false);
  const [lastTxId, setLastTxId] = useState<string | null>(null);

  const [buyAttempted, setBuyAttempted] = useState(false);
  const displayError = writeError;
  const [actionError, setActionError] = useState<string | null>(null);
  const errorMessage = actionError ?? getTransactionErrorMessage(displayError, { chainId });
  const explorerUrl = getTransactionExplorerUrl(lastTxId, chainId);

  useEffect(() => {
    if (!errorMessage && !isSuccess) return;
  }, [listingId, isSuccess, errorMessage, isWrongNetwork, hasPrice, buyAttempted]);

  const buy = async () => {
    try {
      setIsSuccess(false);
      setLastTxId(null);
      setActionError(null);
      setBuyAttempted(true);
      let latestPrice = 0n;
      let latestStatus = 0;
      try {
        const latest = await readListingCompat(idBytes);
        latestPrice = parsePriceWei(latest.price);
        latestStatus = Number(latest.status ?? 0);
      } catch {
        // Chain read failed — fall through to API fallback below.
      }
      if (latestPrice <= 0n || latestStatus === 0) {
        const apiPrice = parseUnits(String(_price || "0"), 8);
        if (apiPrice > 0n) {
          latestPrice = apiPrice;
          latestStatus = 1;
        } else {
          throw new Error("Listing is no longer available to buy. Please refresh.");
        }
      }
      if (latestPrice >= 10n ** 15n) {
        throw new Error(
          "This listing uses a legacy on-chain price format and cannot be purchased as-is. Ask the seller to edit price and save again, or recreate the listing.",
        );
      }
      const txHash = await send({
        address: marketplaceAddress,
        abi: marketplaceAbi,
        functionName: "buyNow",
        args: [idBytes],
        value: latestPrice,
      });
      setLastTxId(txHash);
      await fetch(`${getApiUrl()}/api/sync-purchase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txHash, listingId }),
      }).catch(() => {});
      setIsSuccess(true);
      onPurchaseComplete?.();
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : "Unable to prepare buy transaction. Please refresh and retry.";
      setActionError(msg);
    }
  };

  const usdRate = useHbarUsd();
  const listingPriceWithUsd = formatHbarWithUsd(formatPriceForDisplay(_price || "0"), usdRate);
  const canBuy =
    (hasPrice || chainReadFailed || hasApiPrice) &&
    !isWrongNetwork &&
    !isPending &&
    !isConfirming &&
    !isLegacyWeiListing;

  return (
    <div className="space-y-1">
      {/* Price line */}
      <p className="text-xl font-semibold text-white mb-3">{listingPriceWithUsd}</p>

      {notOnChain && (
        <p className="text-xs text-amber-300/90 mb-2">
          This listing does not exist on the smart contract yet. The seller&apos;s creation
          transaction may not have completed successfully.
        </p>
      )}
      {isLegacyWeiListing && (
        <p className="text-xs text-amber-300/90 mb-2">
          This listing uses a legacy price format. The seller needs to edit and save the price
          before it can be purchased.
        </p>
      )}

      {/* PURCHASE */}
      <button
        onClick={() => { if (canBuy) void buy(); }}
        disabled={!canBuy}
        className="w-full bg-white text-black font-bold uppercase tracking-widest py-4 text-sm hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {isPending ? "Confirm in wallet\u2026" : "Purchase"}
      </button>

      {/* OFFER */}
      <button
        type="button"
        onClick={onMakeOffer}
        className="w-full bg-transparent text-white font-bold uppercase tracking-widest py-3.5 text-sm border border-white/40 hover:border-white hover:bg-white/5 transition-colors"
      >
        Offer
      </button>

      {/* MESSAGE */}
      <button
        type="button"
        onClick={onMessage}
        className="w-full bg-transparent text-white font-bold uppercase tracking-widest py-3.5 text-sm border border-white/40 hover:border-white hover:bg-white/5 transition-colors"
      >
        Message
      </button>

      {/* Wishlist toggle — subtle, below the main actions */}
      <button
        type="button"
        onClick={onToggleWishlist}
        disabled={wishlistDisabled}
        className={`w-full py-2 text-xs font-medium transition-colors disabled:opacity-40 mt-1 ${
          inWishlist
            ? "text-emerald-400 hover:text-emerald-300"
            : "text-white/40 hover:text-white/70"
        }`}
        aria-label={inWishlist ? "Remove from wishlist" : "Add to wishlist"}
      >
        {inWishlist ? "✓ In wishlist" : "+ Add to wishlist"}
      </button>

      {isSuccess && (
        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 space-y-2 mt-2">
          <p className="text-sm text-emerald-200">
            Purchase submitted. You can verify this transaction on-chain.
          </p>
          {explorerUrl && (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-emerald-100 hover:text-white underline"
            >
              View on HashScan
            </a>
          )}
        </div>
      )}
      {errorMessage && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 space-y-2 mt-2">
          <p className="text-sm text-red-300/90 break-words">{errorMessage}</p>
          <a
            href="https://docs.hashpack.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-red-200/90 hover:text-red-100 underline"
          >
            HashPack docs – connection help
          </a>
        </div>
      )}
    </div>
  );
}
