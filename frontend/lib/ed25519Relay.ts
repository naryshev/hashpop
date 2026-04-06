/**
 * Helpers for ED25519 (non-EVM) flows: build message hashes and call the backend relay.
 * Must match contract encoding: keccak256(abi.encodePacked(...))
 */

import { keccak256, encodePacked, toHex } from "viem";
import type { HashConnect } from "hashconnect";
import { getApiUrl } from "./apiUrl";
import { stringToBytes32Hex } from "./bytes32";

function relayUrl(relayPath: string): string {
  const base = getApiUrl().replace(/\/$/, "");
  const p = relayPath.startsWith("/") ? relayPath : `/${relayPath}`;
  return `${base}/api/relay${p}`;
}

export function listingIdToBytes32(listingId: string): `0x${string}` {
  if (listingId.startsWith("0x") && listingId.length === 66)
    return listingId.toLowerCase() as `0x${string}`;
  return stringToBytes32Hex(listingId);
}

export function auctionIdToBytes32(auctionId: string): `0x${string}` {
  return listingIdToBytes32(auctionId);
}

/** Message hash for buyNowWithED25519. */
export function buyNowMessageHash(
  listingIdBytes32: `0x${string}`,
  priceWei: bigint,
  deadline: number,
): `0x${string}` {
  return keccak256(
    encodePacked(
      ["bytes32", "uint256", "uint256", "string"],
      [listingIdBytes32, priceWei, BigInt(deadline), "marketplace.buyNow"],
    ),
  );
}

/** Message hash for confirmReceiptWithED25519. */
export function confirmReceiptMessageHash(
  listingIdBytes32: `0x${string}`,
  deadline: number,
): `0x${string}` {
  return keccak256(
    encodePacked(
      ["bytes32", "uint256", "string"],
      [listingIdBytes32, BigInt(deadline), "escrow.confirmReceipt"],
    ),
  );
}

/** Message hash for placeBidWithED25519. */
export function placeBidMessageHash(
  auctionIdBytes32: `0x${string}`,
  bidAmountWei: bigint,
  deadline: number,
): `0x${string}` {
  return keccak256(
    encodePacked(
      ["bytes32", "uint256", "uint256", "string"],
      [auctionIdBytes32, bidAmountWei, BigInt(deadline), "auctionHouse.placeBid"],
    ),
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
  const res = await fetch(relayUrl("/relay/buy"), {
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

export async function relayConfirmReceipt(
  params: RelayConfirmReceiptParams,
): Promise<{ txHash: string }> {
  const res = await fetch(relayUrl("/relay/confirm-receipt"), {
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
  const res = await fetch(relayUrl("/relay/place-bid"), {
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

/**
 * Ask HashPack to sign a 32-byte message hash and return the raw signature.
 *
 * Works for both ECDSA and ED25519 accounts. The wallet opens a signing
 * prompt; no copy-pasting required. The returned hex is passed directly to
 * relay endpoints that call *WithED25519 contract functions.
 */
export async function signHashWithHashpack(
  hashconnect: HashConnect,
  accountId: string,
  messageHashHex: `0x${string}`,
): Promise<`0x${string}`> {
  const sdk = await import("@hashgraph/sdk");
  const accountObj = sdk.AccountId.fromString(accountId);
  const signer = (hashconnect as unknown as { getSigner?: (id: unknown) => unknown }).getSigner?.(
    accountObj,
  );
  if (!signer || typeof (signer as { sign?: unknown }).sign !== "function") {
    throw new Error("HashPack signer unavailable — reconnect your wallet and try again.");
  }

  const hexBody = messageHashHex.slice(2);
  const messageBytes = new Uint8Array(hexBody.match(/.{2}/g)!.map((b) => parseInt(b, 16)));

  let signatureMaps: unknown[];
  try {
    signatureMaps = await (signer as { sign: (m: Uint8Array[]) => Promise<unknown[]> }).sign([
      messageBytes,
    ]);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`HashPack rejected the sign request: ${msg}`);
  }

  if (!signatureMaps || signatureMaps.length === 0) {
    throw new Error("HashPack returned no signature — try again.");
  }

  // DAppSigner.sign() returns @hashgraph/sdk SignatureMap objects.
  // _toProtobuf() exposes { sigPair: [{ ed25519?, ECDSASecp256k1? }] }.
  type SigPair = { ed25519?: Uint8Array; ECDSASecp256k1?: Uint8Array };
  type SigMapProto = { sigPair?: SigPair[] };
  const proto = (signatureMaps[0] as { _toProtobuf?: () => SigMapProto })?._toProtobuf?.();
  const firstPair = proto?.sigPair?.[0];
  const rawSig: Uint8Array | undefined = firstPair?.ed25519 ?? firstPair?.ECDSASecp256k1;

  if (!rawSig || rawSig.length === 0) {
    throw new Error("Could not extract signature bytes from HashPack response.");
  }

  return `0x${Array.from(rawSig)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}` as `0x${string}`;
}

/** Resolve Hedera account ID (0.0.XXXXX) to EVM alias (0x...) via backend. */
export async function fetchAccountAlias(accountId: string): Promise<`0x${string}`> {
  const res = await fetch(relayUrl(`/account-alias?accountId=${encodeURIComponent(accountId)}`));
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Failed to resolve account alias");
  }
  const { evmAlias } = await res.json();
  return evmAlias as `0x${string}`;
}
