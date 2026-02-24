"use client";

import { useState, useMemo, useEffect } from "react";
import { marketplaceAbi, marketplaceAddress } from "../lib/contracts";
import { formatContractAmountToHbar } from "../lib/formatPrice";
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

export function BuyButton({ listingId, price: _price }: { listingId: string; price: string }) {
  const idBytes = useMemo(() => listingIdToBytes32(listingId), [listingId]);

  const { address } = useHashpackWallet();
  const chainId = activeHederaChain.id;
  const isWrongNetwork = false;
  const [onChainListing, setOnChainListing] = useState<{ price: bigint; status: number } | undefined>(undefined);
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
  useEffect(() => {
    let cancelled = false;
    void readListingCompat(idBytes)
      .then((data) => {
        if (!cancelled) {
          setOnChainListing({ price: data.price, status: data.status });
          setChainReadFailed(false);
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
      // Read the latest on-chain listing at click-time to avoid stale cached price mismatches.
      let latestPrice = 0n;
      let latestStatus = 0;
      try {
        const latest = await readListingCompat(idBytes);
        latestPrice = parsePriceWei(latest.price);
        latestStatus = Number(latest.status ?? 0);
      } catch {
        // Legacy fallback: use API-provided price if live read fails.
        latestPrice = parseUnits(String(_price || "0"), 8);
        latestStatus = 1;
      }
      if (latestStatus !== 1 || latestPrice <= 0n) {
        throw new Error("Listing is no longer available to buy. Please refresh.");
      }
      if (latestPrice >= 10n ** 15n) {
        throw new Error(
          "This listing uses a legacy on-chain price format and cannot be purchased as-is. Ask the seller to edit price and save again, or recreate the listing."
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
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unable to prepare buy transaction. Please refresh and retry.";
      setActionError(msg);
    }
  };

  const priceHbar = hasPrice ? formatContractAmountToHbar(priceWei.toString()) : "—";
  const usdRate = useHbarUsd();
  const priceWithUsd = formatHbarWithUsd(priceHbar, usdRate);

  return (
    <div className="glass-card p-4 space-y-4">
      <h3 className="text-lg font-semibold text-white mb-2">Buy Now</h3>
      <div className="mb-2 min-h-[2rem]">
        <span className="text-silver text-sm">Price: </span>
        <span className="text-2xl font-bold text-chrome">{priceWithUsd}</span>
      </div>
      <p className="text-sm text-silver mb-3">
        {hasPrice
          ? `You will send ${priceWithUsd} on Hedera Testnet. Confirm in your wallet (HashPack supports this).`
          : chainReadFailed
            ? "Could not read chain price quickly. We will use the latest known listing price at checkout."
            : "Loading price from chain…"}
      </p>
      {isLegacyWeiListing && (
        <p className="text-xs text-amber-300/90 mb-1">
          This listing was created with a legacy price unit and cannot be bought yet. The seller needs to edit the price and save, or relist.
        </p>
      )}
      <button
        onClick={() => {
          if (!hasPrice || isLegacyWeiListing || isWrongNetwork || isPending || isConfirming) return;
          void buy();
        }}
        disabled={( !hasPrice && !chainReadFailed ) || isLegacyWeiListing || isPending || isConfirming || isWrongNetwork}
        className="btn-frost-cta w-full disabled:opacity-60"
      >
        {isPending ? "Confirm in wallet…" : "Buy Now"}
      </button>
      {isSuccess && (
        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 space-y-2">
          <p className="text-sm text-emerald-200">Purchase submitted and synced. You can verify this transaction on-chain.</p>
          {explorerUrl && (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-emerald-100 hover:text-white underline"
            >
              View transaction on HashScan
            </a>
          )}
        </div>
      )}
      {errorMessage && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 space-y-2">
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
