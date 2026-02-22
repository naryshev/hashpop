"use client";

import { useState } from "react";
import { marketplaceAbi, marketplaceAddress } from "../lib/contracts";
import { listingIdToBytes32 } from "../lib/bytes32";
import { useRobustContractWrite } from "./useRobustContractWrite";

export function useCancelListing() {
  const { send, isPending, error, lastHash } = useRobustContractWrite();
  const [isSuccess, setIsSuccess] = useState(false);

  const cancel = async (listingId: string): Promise<boolean> => {
    setIsSuccess(false);
    const idHex = listingIdToBytes32(listingId);
    try {
      await send({
        address: marketplaceAddress,
        abi: marketplaceAbi,
        functionName: "cancelListing",
        args: [idHex as `0x${string}`],
      });
      setIsSuccess(true);
      return true;
    } catch {
      setIsSuccess(false);
      return false;
    }
  };

  return {
    cancel,
    isPending,
    isSuccess,
    error,
    hash: lastHash,
  };
}
