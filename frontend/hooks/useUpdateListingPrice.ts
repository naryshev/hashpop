"use client";

import { useCallback } from "react";
import { parseUnits } from "viem";
import { marketplaceAbi, marketplaceAddress } from "../lib/contracts";
import { listingIdToBytes32 } from "../lib/bytes32";
import { useRobustContractWrite } from "./useRobustContractWrite";

/**
 * Returns a function that updates a listing's price on-chain. Resolves when the tx is confirmed.
 * Use when the seller edits the listing price so the contract and DB stay in sync.
 */
export function useUpdateListingPrice() {
  const { send, isPending, error } = useRobustContractWrite();

  const updatePriceOnChain = useCallback(
    async (listingId: string, priceHbar: string): Promise<string> => {
      if (!priceHbar.trim() || Number.isNaN(Number(priceHbar)) || Number(priceHbar) <= 0) {
        throw new Error("Invalid price");
      }
      try {
        const idBytes = listingIdToBytes32(listingId);
        return await send({
          address: marketplaceAddress,
          abi: marketplaceAbi,
          functionName: "updateListingPrice",
          args: [idBytes, parseUnits(priceHbar.trim(), 8)],
        });
      } catch (e) {
        throw e instanceof Error ? e : new Error(String(e));
      }
    },
    [send],
  );

  return {
    updatePriceOnChain,
    isPending,
    error,
  };
}
