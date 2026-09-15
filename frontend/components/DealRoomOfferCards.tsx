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
import { OfferModal } from "./OfferModal";
import { material } from "../lib/materials";
import { offerCardActions, type OfferAction } from "../lib/dealRoom";
import { cn } from "../lib/utils";

type Offer = {
  id: string;
  listingId: string;
  buyer: string;
  amount: string;
  status: "ACTIVE" | "ACCEPTED" | "REJECTED" | "CANCELLED";
  createdAt: string;
};

export function DealRoomOfferCards({
  listingId,
  sellerAddress,
  askingPriceHbar,
}: {
  listingId: string;
  sellerAddress: string;
  askingPriceHbar?: string | null;
}) {
  const { address } = useHashpackWallet();
  const { send, isPending } = useRobustContractWrite();
  const chainId = activeHederaChain.id;
  const usdRate = useHbarUsd();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<OfferAction | null>(null);
  const [counterOpen, setCounterOpen] = useState(false);

  const fetchOffers = useCallback(async () => {
    try {
      const res = await fetch(`${getApiUrl()}/api/listing/${encodeURIComponent(listingId)}/offers`);
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { offers: Offer[] };
      setOffers(data.offers || []);
    } catch {
      setOffers([]);
    }
  }, [listingId]);

  useEffect(() => {
    void fetchOffers();
  }, [fetchOffers]);

  const runAction = async (offer: Offer, action: "accept" | "reject" | "cancel") => {
    if (!address) return;
    setBusy(action === "accept" ? "accept" : action === "cancel" ? "cancel" : "accept");
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
        body: JSON.stringify({ txHash, listingId, buyer: offer.buyer, action }),
      }).catch(() => {});
      await fetchOffers();
    } catch (e) {
      setError(getTransactionErrorMessage(e, { chainId }));
    } finally {
      setBusy(null);
    }
  };

  const visible = offers.filter((o) => {
    if (o.status !== "ACTIVE") return false;
    if (!address) return false;
    const isSeller = address.toLowerCase() === sellerAddress.toLowerCase();
    return isSeller || o.buyer.toLowerCase() === address.toLowerCase();
  });

  if (!address) return null;

  return (
    <>
      {visible.map((offer) => {
        const actions = offerCardActions(offer, { viewer: address, seller: sellerAddress });
        return (
          <div key={offer.id} className={cn(material.regular, "mx-2 rounded-[16px] px-3.5 py-3")}>
            <p className="text-[13px] font-medium text-silver">Offer</p>
            <p className="mt-1 text-lg font-bold text-white">
              {formatHbarWithUsd(offer.amount, usdRate)}
            </p>
            <p className="mt-0.5 text-[11px] text-silver">
              {new Date(offer.createdAt).toLocaleString()}
            </p>
            {actions.length > 0 && (
              <div className="mt-3 flex gap-2">
                {actions.includes("accept") && (
                  <button
                    type="button"
                    onClick={() => void runAction(offer, "accept")}
                    disabled={isPending || busy !== null}
                    className="flex-1 rounded-[14px] bg-[#00ffa3] py-2 text-sm font-bold text-black disabled:opacity-50"
                  >
                    {busy === "accept" ? "Confirm in wallet…" : "Accept"}
                  </button>
                )}
                {actions.includes("counter") && (
                  <button
                    type="button"
                    onClick={() => setCounterOpen(true)}
                    disabled={isPending}
                    className="flex-1 rounded-[14px] border border-[#00ffa3]/25 bg-[#00ffa3]/10 py-2 text-sm font-bold text-chrome"
                  >
                    Counter
                  </button>
                )}
                {actions.includes("cancel") && (
                  <button
                    type="button"
                    onClick={() => void runAction(offer, "cancel")}
                    disabled={isPending || busy !== null}
                    className="flex-1 rounded-[14px] border border-white/15 py-2 text-sm font-semibold text-silver"
                  >
                    {busy === "cancel" ? "Confirm in wallet…" : "Cancel"}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
      {error && <p className="px-4 text-xs text-rose-300">{error}</p>}
      <OfferModal
        open={counterOpen}
        onClose={() => setCounterOpen(false)}
        listingId={listingId}
        askingPriceHbar={askingPriceHbar || offerAmountHint(visible) || "0"}
        onOfferSubmitted={() => {
          setCounterOpen(false);
          void fetchOffers();
        }}
      />
    </>
  );
}

function offerAmountHint(offers: Offer[]): string | undefined {
  return offers[0]?.amount;
}
