/**
 * Helpers for ED25519 (non-EVM) flows: build message hashes and call the backend relay.
 * Must match contract encoding: keccak256(abi.encodePacked(...))
 */

import { keccak256, encodePacked, toHex } from "viem";

function apiUrl(relayPath: string): string {
  const base = (typeof window !== "undefined" ? process.env.NEXT_PUBLIC_API_URL : process.env.NEXT_PUBLIC_API_URL) || "";
  const p = relayPath.startsWith("/") ? relayPath : `/${relayPath}`;
  return base ? `${base.replace(/\/$/, "")}/api/relay${p}` : `/api/relay${p}`;
}

/** Listing id as bytes32 hex (same as BuyButton formatId). */
export function listingIdToBytes32(listingId: string): `0x${string}` {
  const hex = Buffer.from(listingId).toString("hex").padEnd(64, "0").slice(0, 64);
  return `0x${hex}` as `0x${string}`;
}

export function auctionIdToBytes32(auctionId: string): `0x${string}` {
  return listingIdToBytes32(auctionId);
}

/** Message hash for buyNowWithED25519. */
export function buyNowMessageHash(listingIdBytes32: `0x${string}`, priceWei: bigint, deadline: number): `0x${string}` {
  return keccak256(
    encodePacked(
      ["bytes32", "uint256", "uint256", "string"],
      [listingIdBytes32, priceWei, BigInt(deadline), "marketplace.buyNow"]
    )
  );
}

/** Message hash for confirmReceiptWithED25519. */
export function confirmReceiptMessageHash(listingIdBytes32: `0x${string}`, deadline: number): `0x${string}` {
  return keccak256(
    encodePacked(["bytes32", "uint256", "string"], [listingIdBytes32, BigInt(deadline), "escrow.confirmReceipt"])
  );
}

/** Message hash for placeBidWithED25519. */
export function placeBidMessageHash(
  auctionIdBytes32: `0x${string}`,
  bidAmountWei: bigint,
  deadline: number
): `0x${string}` {
  return keccak256(
    encodePacked(
      ["bytes32", "uint256", "uint256", "string"],
      [auctionIdBytes32, bidAmountWei, BigInt(deadline), "auctionHouse.placeBid"]
    )
  );
}

/** Default deadline: 10 minutes from now. */
export function defaultDeadline(): number {
  return Math.floor(Date.now() / 1000) + 60 * 10;
}

export type RelayBuyParams = {
  listingId: string;
  buyerAlias: `0x${string}`;
  priceWei: string;
  deadline: number;
  messageHash: `0x${string}`;
  signature: `0x${string}`;
};

export async function relayBuy(params: RelayBuyParams): Promise<{ txHash: string }> {
  const res = await fetch(apiUrl("/relay/buy"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      listingId: params.listingId,
      buyerAlias: params.buyerAlias,
      price: params.priceWei,
      deadline: params.deadline,
      messageHash: params.messageHash,
      signature: params.signature,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.details || err.error || "Relay buy failed");
  }
  return res.json();
}

export type RelayConfirmReceiptParams = {
  listingId: string;
  buyerAlias: `0x${string}`;
  deadline: number;
  messageHash: `0x${string}`;
  signature: `0x${string}`;
};

export async function relayConfirmReceipt(params: RelayConfirmReceiptParams): Promise<{ txHash: string }> {
  const res = await fetch(apiUrl("/relay/confirm-receipt"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      listingId: params.listingId,
      buyerAlias: params.buyerAlias,
      deadline: params.deadline,
      messageHash: params.messageHash,
      signature: params.signature,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.details || err.error || "Relay confirm failed");
  }
  return res.json();
}

export type RelayPlaceBidParams = {
  auctionId: string;
  bidderAlias: `0x${string}`;
  bidAmountWei: string;
  deadline: number;
  messageHash: `0x${string}`;
  signature: `0x${string}`;
};

export async function relayPlaceBid(params: RelayPlaceBidParams): Promise<{ txHash: string }> {
  const res = await fetch(apiUrl("/relay/place-bid"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      auctionId: params.auctionId,
      bidderAlias: params.bidderAlias,
      bidAmount: params.bidAmountWei,
      deadline: params.deadline,
      messageHash: params.messageHash,
      signature: params.signature,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.details || err.error || "Relay place-bid failed");
  }
  return res.json();
}

/** Resolve Hedera account ID (0.0.XXXXX) to EVM alias (0x...) via backend. */
export async function fetchAccountAlias(accountId: string): Promise<`0x${string}`> {
  const res = await fetch(apiUrl(`/account-alias?accountId=${encodeURIComponent(accountId)}`));
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Failed to resolve account alias");
  }
  const { evmAlias } = await res.json();
  return evmAlias as `0x${string}`;
}
