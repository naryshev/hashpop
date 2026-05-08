"use client";

import { useCallback, useEffect, useState } from "react";
import { marketplaceAbi, marketplaceAddress } from "../lib/contracts";
import { listingIdToBytes32 } from "../lib/bytes32";
import { useRobustContractWrite } from "../hooks/useRobustContractWrite";
import { useHashpackWallet } from "../lib/hashpackWallet";
import { activeHederaChain } from "../lib/hederaChains";
import { getApiUrl } from "../lib/apiUrl";
import { getTransactionErrorMessage } from "../lib/transactionError";
import { formatHbarWithUsd } from "../lib/hbarUsd";
import { useHbarUsd } from "../hooks/useHbarUsd";
import { AddressDisplay } from "./AddressDisplay";

type Offer = {
  id: string;
  listingId: string;
  buyer: string;
  amount: string;
  status: "ACTIVE" | "ACCEPTED" | "REJECTED" | "CANCELLED";
  createdAt: string;
};

type Props = {
  listingId: string;
  /** Seller's wallet address (lowercased, 0x…). Used to decide which UI to render. */
  sellerAddress: string;
  /** Refresh the parent's listing payload after an action mutates state. */
  onChanged?: () => void;
};

/**
 * Renders pending offers tied to a listing. Sellers see Accept / Reject for
 * each active offer; the buyer who placed the offer sees a Cancel button.
 * Read-only for everyone else.
 */
export function OffersPanel({ listingId, sellerAddress, onChanged }: Props) {
  const { address } = useHashpackWallet();
  const { send, isPending } = useRobustContractWrite();
  const chainId = activeHederaChain.id;
  const usdRate = useHbarUsd();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<{ buyer: string; action: string } | null>(null);

  const fetchOffers = useCallback(async () => {
    try {
      const res = await fetch(`${getApiUrl()}/api/listing/${encodeURIComponent(listingId)}/offers`);
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { offers: Offer[] };
      setOffers(data.offers || []);
    } catch {
      // Endpoint may 404 on stale deployments — render nothing rather than blow up.
      setOffers([]);
    } finally {
      setLoading(false);
    }
  }, [listingId]);

  useEffect(() => {
    void fetchOffers();
  }, [fetchOffers]);

  const isSeller = !!address && address.toLowerCase() === sellerAddress.toLowerCase();
  const activeOffers = offers.filter((o) => o.status === "ACTIVE");

  const runAction = async (offer: Offer, action: "accept" | "reject" | "cancel") => {
    if (!address) return;
    setBusyAction({ buyer: offer.buyer, action });
    setError(null);
    try {
      const idBytes = listingIdToBytes32(listingId);
      const fn =
        action === "accept" ? "acceptOffer" : action === "reject" ? "rejectOffer" : "cancelOffer";
      const args = action === "cancel" ? [idBytes] : [idBytes, offer.buyer as `0x${string}`];
      const txHash = await send({
        address: marketplaceAddress,
        abi: marketplaceAbi,
        functionName: fn,
        args,
      });
      await fetch(`${getApiUrl()}/api/sync-offer-action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          txHash,
          listingId,
          buyer: offer.buyer,
          action,
        }),
      }).catch(() => {});
      await fetchOffers();
      onChanged?.();
    } catch (e) {
      setError(getTransactionErrorMessage(e, { chainId }));
    } finally {
      setBusyAction(null);
    }
  };

  if (loading) return null;
  if (activeOffers.length === 0) return null;

  return (
    <div className="glass-card rounded-[2px] border border-white/10 p-4">
      <h3 className="mb-2 font-medium text-white">{isSeller ? "Pending offers" : "Your offer"}</h3>
      {!isSeller && (
        <p className="mb-2 text-xs text-silver/70">
          Funds are locked in escrow until the seller accepts or rejects.
        </p>
      )}
      <ul className="space-y-3">
        {activeOffers
          .filter((o) => isSeller || o.buyer.toLowerCase() === (address ?? "").toLowerCase())
          .map((offer) => {
            const isMine = !!address && offer.buyer.toLowerCase() === address.toLowerCase();
            const busy =
              busyAction !== null && busyAction.buyer.toLowerCase() === offer.buyer.toLowerCase();
            return (
              <li
                key={offer.id}
                className="space-y-2 rounded-[2px] border border-white/10 bg-white/5 px-3 py-3"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-base font-semibold text-white">
                    {formatHbarWithUsd(offer.amount, usdRate)}
                  </span>
                  <span className="text-xs text-silver/70">
                    {new Date(offer.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-silver">
                  Buyer: <AddressDisplay address={offer.buyer} className="text-chrome font-mono" />
                </p>
                {isSeller && (
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => void runAction(offer, "accept")}
                      disabled={isPending || busy}
                      className="flex-1 rounded-glass border border-emerald-500/50 bg-emerald-500/15 px-3 py-2 text-sm font-semibold text-emerald-200 transition-colors hover:bg-emerald-500/25 disabled:opacity-50"
                    >
                      {busy && busyAction?.action === "accept" ? "Confirm in wallet…" : "Accept"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void runAction(offer, "reject")}
                      disabled={isPending || busy}
                      className="flex-1 rounded-glass border border-rose-500/50 bg-rose-500/10 px-3 py-2 text-sm font-semibold text-rose-300 transition-colors hover:bg-rose-500/20 disabled:opacity-50"
                    >
                      {busy && busyAction?.action === "reject" ? "Confirm in wallet…" : "Reject"}
                    </button>
                  </div>
                )}
                {!isSeller && isMine && (
                  <button
                    type="button"
                    onClick={() => void runAction(offer, "cancel")}
                    disabled={isPending || busy}
                    className="w-full rounded-glass border border-white/20 bg-white/5 px-3 py-2 text-sm font-semibold text-silver transition-colors hover:bg-white/10 disabled:opacity-50"
                  >
                    {busy ? "Confirm in wallet…" : "Cancel offer"}
                  </button>
                )}
              </li>
            );
          })}
      </ul>
      {error && (
        <p className="mt-3 rounded-[2px] border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300/90">
          {error}
        </p>
      )}
    </div>
  );
}
