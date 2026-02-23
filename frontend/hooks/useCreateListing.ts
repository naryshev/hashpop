"use client";

import { useState } from "react";
import { marketplaceAbi, marketplaceAddress } from "../lib/contracts";
import { stringToBytes32Hex, generateTimeBasedId } from "../lib/bytes32";
import { parseUnits } from "viem";
import { useRobustContractWrite } from "./useRobustContractWrite";
import { useHashpackWallet } from "../lib/hashpackWallet";

import { getApiUrl } from "../lib/apiUrl";

type UseCreateListingOptions = {
  imageUrlRef?: React.MutableRefObject<string | null>;
  mediaUrlsRef?: React.MutableRefObject<string[]>;
  requireEscrowRef?: React.MutableRefObject<boolean>;
  titleRef?: React.MutableRefObject<string | null>;
  subtitleRef?: React.MutableRefObject<string | null>;
  descriptionRef?: React.MutableRefObject<string | null>;
  categoryRef?: React.MutableRefObject<string | null>;
  conditionRef?: React.MutableRefObject<string | null>;
  yearOfProductionRef?: React.MutableRefObject<string | null>;
};

export function useCreateListing(options?: UseCreateListingOptions) {
  const { imageUrlRef, mediaUrlsRef, requireEscrowRef, titleRef, subtitleRef, descriptionRef, categoryRef, conditionRef, yearOfProductionRef } = options || {};
  const { send, isPending, error, lastHash } = useRobustContractWrite();
  const { address } = useHashpackWallet();
  const [isSuccess, setIsSuccess] = useState(false);

  const create = async (price: string): Promise<string> => {
    setIsSuccess(false);
    const id = generateTimeBasedId("lst");
    const idBytes = stringToBytes32Hex(id);
    const txHash = await send({
      address: marketplaceAddress,
      abi: marketplaceAbi,
      functionName: "createListing",
      args: [idBytes, parseUnits(price, 8), !!requireEscrowRef?.current],
    });
    const imageUrl = imageUrlRef?.current ?? undefined;
    const mediaUrls = mediaUrlsRef?.current ?? undefined;
    const title = titleRef?.current ?? undefined;
    const requireEscrow = requireEscrowRef?.current ?? false;
    const subtitle = subtitleRef?.current ?? undefined;
    const description = descriptionRef?.current ?? undefined;
    const category = categoryRef?.current ?? undefined;
    const condition = conditionRef?.current ?? undefined;
    const yearOfProduction = yearOfProductionRef?.current ?? undefined;
    await fetch(`${getApiUrl()}/api/sync-listing`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        txHash,
        listingId: idBytes,
        seller: address,
        price,
        requireEscrow,
        ...(imageUrl && { imageUrl }),
        ...(mediaUrls?.length && { mediaUrls }),
        ...(title && { title }),
        ...(subtitle && { subtitle }),
        ...(description && { description }),
        ...(category && { category }),
        ...(condition && { condition }),
        ...(yearOfProduction && { yearOfProduction }),
      }),
    }).catch(() => {});
    setIsSuccess(true);
    return idBytes;
  };

  return {
    create,
    isPending,
    isSuccess,
    error,
    hash: lastHash,
  };
}
