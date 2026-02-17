"use client";

import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { marketplaceAbi, marketplaceAddress } from "../lib/contracts";
import { stringToBytes32Hex } from "../lib/bytes32";
import { parseEther } from "viem";

export function useCreateListing() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const create = (id: string, price: string) => {
    const idBytes = stringToBytes32Hex(id);
    writeContract({
      address: marketplaceAddress,
      abi: marketplaceAbi,
      functionName: "createListing",
      args: [idBytes, parseEther(price)],
    });
  };

  return {
    create,
    isPending: isPending || isConfirming,
    isSuccess,
    error,
    hash,
  };
}
