"use client";

import { useEffect, useRef } from "react";
import { auctionHouseAbi, auctionHouseAddress } from "../lib/contracts";
import { parseEther } from "viem";
import { generateTimeBasedId, stringToBytes32Hex } from "../lib/bytes32";
import { useRobustContractWrite } from "./useRobustContractWrite";

import { getApiUrl } from "../lib/apiUrl";
const SECONDS_PER_DAY = 86400;

export type AuctionDurationDays = 7 | 14 | 30;

export function durationToSeconds(days: AuctionDurationDays): number {
  return days * SECONDS_PER_DAY;
}

type UseCreateAuctionOptions = {
  titleRef?: React.MutableRefObject<string | null>;
  subtitleRef?: React.MutableRefObject<string | null>;
  descriptionRef?: React.MutableRefObject<string | null>;
  conditionRef?: React.MutableRefObject<string | null>;
  yearOfProductionRef?: React.MutableRefObject<string | null>;
  imageUrlRef?: React.MutableRefObject<string | null>;
  mediaUrlsRef?: React.MutableRefObject<string[]>;
};

export function useCreateAuction(options?: UseCreateAuctionOptions) {
  const {
    titleRef,
    subtitleRef,
    descriptionRef,
    conditionRef,
    yearOfProductionRef,
    imageUrlRef,
    mediaUrlsRef,
  } = options || {};
  const { send, isPending, error, lastHash } = useRobustContractWrite();
  const isSuccess = !!lastHash;
  const hash = lastHash;
  const syncedTxRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isSuccess || !hash || syncedTxRef.current === hash) return;
    syncedTxRef.current = hash;
    const title = titleRef?.current ?? undefined;
    const subtitle = subtitleRef?.current ?? undefined;
    const description = descriptionRef?.current ?? undefined;
    const condition = conditionRef?.current ?? undefined;
    const yearOfProduction = yearOfProductionRef?.current ?? undefined;
    const imageUrl = imageUrlRef?.current ?? undefined;
    const mediaUrls = mediaUrlsRef?.current ?? undefined;
    fetch(`${getApiUrl()}/api/sync-auction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        txHash: hash,
        ...(title && { title }),
        ...(subtitle && { subtitle }),
        ...(description && { description }),
        ...(condition && { condition }),
        ...(yearOfProduction && { yearOfProduction }),
        ...(imageUrl && { imageUrl }),
        ...(mediaUrls?.length && { mediaUrls }),
      }),
    }).catch(() => {});
  }, [
    isSuccess,
    hash,
    titleRef,
    subtitleRef,
    descriptionRef,
    conditionRef,
    yearOfProductionRef,
    imageUrlRef,
    mediaUrlsRef,
  ]);

  const createAuction = async (
    reservePriceHbar: string,
    durationDays: AuctionDurationDays,
  ): Promise<string> => {
    const auctionId = generateTimeBasedId("auc");
    const idBytes = stringToBytes32Hex(auctionId);
    const startTime = Math.floor(Date.now() / 1000);
    const duration = durationToSeconds(durationDays);
    await send({
      address: auctionHouseAddress,
      abi: auctionHouseAbi,
      functionName: "createAuction",
      args: [idBytes, parseEther(reservePriceHbar), BigInt(startTime), BigInt(duration)],
    });
    return idBytes;
  };

  return {
    createAuction,
    isPending,
    isSuccess,
    error,
    hash,
  };
}
