"use client";

import { useState, useMemo, useEffect } from "react";
import { useChainId, useReadContract, usePublicClient } from "wagmi";
import { marketplaceAbi, marketplaceAddress } from "../lib/contracts";
import { formatPriceWeiToHbar } from "../lib/formatPrice";
import { formatHbarWithUsd } from "../lib/hbarUsd";
import { getTransactionErrorMessage } from "../lib/transactionError";
import { useHbarUsd } from "../hooks/useHbarUsd";
import { listingIdToBytes32 } from "../lib/bytes32";
import { useRobustContractWrite } from "../hooks/useRobustContractWrite";
import { useHashpackWallet } from "../lib/hashpackWallet";

export function BuyButton({ listingId, price: _price }: { listingId: string; price: string }) {
  type ListingTuple = readonly [string, bigint, bigint, number, `0x${string}`];
  const idBytes = useMemo(() => listingIdToBytes32(listingId), [listingId]);

  const { address } = useHashpackWallet();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const isWrongNetwork = false;

  const { data: onChainListing } = useReadContract({
    address: marketplaceAddress,
    abi: marketplaceAbi,
    functionName: "listings",
    args: [idBytes],
  });

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
  const listingTuple = onChainListing as ListingTuple | undefined;
  const priceWei = parsePriceWei(listingTuple?.[1]);
  const hasPrice = priceWei > 0n;

  const { send, isPending, error: writeError } = useRobustContractWrite();
  const isConfirming = false;
  const isSuccess = false;

  const [buyAttempted, setBuyAttempted] = useState(false);
  const displayError = writeError;
  const [actionError, setActionError] = useState<string | null>(null);
  const errorMessage = actionError ?? getTransactionErrorMessage(displayError, { chainId });

  useEffect(() => {
    if (!errorMessage && !isSuccess) return;
  }, [listingId, isSuccess, errorMessage, isWrongNetwork, hasPrice, buyAttempted]);

  const buy = async () => {
    try {
      setActionError(null);
      setBuyAttempted(true);
      // Read the latest on-chain listing at click-time to avoid stale cached price mismatches.
      const latest = await publicClient?.readContract({
        address: marketplaceAddress,
        abi: marketplaceAbi,
        functionName: "listings",
        args: [idBytes],
      });
      const latestTuple = latest as ListingTuple | undefined;
      const latestPrice = parsePriceWei(latestTuple?.[1]);
      const latestStatus = Number(latestTuple?.[3] ?? 0);
      if (latestStatus !== 1 || latestPrice <= 0n) {
        throw new Error("Listing is no longer available to buy. Please refresh.");
      }
      await send({
        address: marketplaceAddress,
        abi: marketplaceAbi,
        functionName: "buyNow",
        args: [idBytes],
        value: latestPrice,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unable to prepare buy transaction. Please refresh and retry.";
      setActionError(msg);
    }
  };

  const priceHbar = hasPrice ? formatPriceWeiToHbar(priceWei.toString()) : "—";
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
          : "Loading price from chain…"}
      </p>
      {hasPrice && (
        <p className="text-xs text-zinc-500 mb-1">
          <a
            href="https://docs.hashpack.app/dapp-developers/walletconnect"
            target="_blank"
            rel="noopener noreferrer"
            className="text-chrome hover:text-white underline"
          >
            Paying with HashPack? See WalletConnect & supported transactions →
          </a>
        </p>
      )}
      <button
        onClick={() => {
          if (!hasPrice || isWrongNetwork || isPending || isConfirming) return;
          void buy();
        }}
        disabled={!hasPrice || isPending || isConfirming || isWrongNetwork}
        className="btn-frost-cta w-full disabled:opacity-60"
      >
        {isPending ? "Confirm in wallet…" : "Buy Now"}
      </button>
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
