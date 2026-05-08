import { ethers } from "ethers";

// Event signature hashes (keccak256 of EventName(type,type,...)), lowercase for comparison
const ITEM_LISTED = ethers.id("ItemListed(bytes32,address,uint256)").toLowerCase();
const ITEM_PURCHASED = ethers.id("ItemPurchased(bytes32,address,address,uint256)").toLowerCase();
const LISTING_CANCELLED = ethers.id("ListingCancelled(bytes32,address)").toLowerCase();
const PRICE_UPDATED = ethers.id("PriceUpdated(bytes32,uint256)").toLowerCase();
const AUCTION_CREATED = ethers
  .id("AuctionCreated(bytes32,address,uint256,uint256,uint256)")
  .toLowerCase();
const BID_PLACED = ethers.id("BidPlaced(bytes32,address,uint256)").toLowerCase();
const AUCTION_EXTENDED = ethers.id("AuctionExtended(bytes32,uint256)").toLowerCase();
const AUCTION_SETTLED = ethers.id("AuctionSettled(bytes32,address,uint256)").toLowerCase();
const OFFER_MADE = ethers.id("OfferMade(bytes32,address,uint256)").toLowerCase();
const OFFER_ACCEPTED = ethers.id("OfferAccepted(bytes32,address,uint256)").toLowerCase();
const OFFER_REJECTED = ethers.id("OfferRejected(bytes32,address,uint256)").toLowerCase();
const OFFER_CANCELLED = ethers.id("OfferCancelled(bytes32,address,uint256)").toLowerCase();

export const EXPECTED_TOPIC0_ITEM_LISTED = ITEM_LISTED;

function topic0(ev: any): string {
  const t = ev.topics?.[0] ?? ev.topic0;
  if (!t) return "";
  return typeof t === "string" && t.startsWith("0x") ? t : `0x${t}`;
}

function topicAt(ev: any, i: number): string {
  const t = ev.topics?.[i] ?? ev[`topic${i}` as keyof typeof ev];
  if (!t) return "";
  return typeof t === "string" && t.startsWith("0x") ? t : `0x${t}`;
}

function addressFromTopic(t: string): string {
  if (!t) return "";
  const hex = t.startsWith("0x") ? t : `0x${t}`;
  // 32-byte topic; address is last 20 bytes (40 hex chars)
  const addrHex = hex.slice(-40);
  try {
    return ethers.getAddress(ethers.zeroPadValue("0x" + addrHex, 20));
  } catch {
    return "";
  }
}

function dataHex(ev: any): string {
  const d = ev.data;
  if (d == null || d === "") return "0x";
  const s = typeof d === "string" ? d : String(d);
  return s.startsWith("0x") ? s : `0x${s}`;
}

/** Decode one uint256 from data at offset 0 */
function uint256FromData(data: string): bigint {
  if (!data || data === "0x") return 0n;
  try {
    return ethers.toBigInt(data.slice(0, 66)); // 0x + 64 chars
  } catch {
    return 0n;
  }
}

/**
 * Decode a mirror node log into a typed event.
 * Mirror returns: { topics: string[], data: string, timestamp: string }
 */
export function decodeEvents(event: any): any | null {
  const t0Raw = topic0(event);
  if (!t0Raw) return null;
  const t0 = t0Raw.toLowerCase();

  const data = dataHex(event);

  if (t0 === ITEM_LISTED) {
    return {
      type: "ItemListed",
      listingId: topicAt(event, 1),
      seller: addressFromTopic(topicAt(event, 2)),
      price: uint256FromData(data),
    };
  }

  if (t0 === ITEM_PURCHASED) {
    return {
      type: "ItemPurchased",
      listingId: topicAt(event, 1),
      buyer: addressFromTopic(topicAt(event, 2)),
      seller: addressFromTopic(topicAt(event, 3)),
      price: uint256FromData(data),
    };
  }

  if (t0 === LISTING_CANCELLED) {
    return {
      type: "ListingCancelled",
      listingId: topicAt(event, 1),
      seller: addressFromTopic(topicAt(event, 2)),
    };
  }

  if (t0 === PRICE_UPDATED) {
    return {
      type: "PriceUpdated",
      listingId: topicAt(event, 1),
      newPrice: uint256FromData(data),
    };
  }

  if (t0 === AUCTION_CREATED.toLowerCase()) {
    // data = reservePrice (32) + startTime (32) + endTime (32)
    const reservePrice = data.length >= 66 ? ethers.toBigInt("0x" + data.slice(2, 66)) : 0n;
    const startTime = data.length >= 130 ? ethers.toBigInt("0x" + data.slice(66, 130)) : 0n;
    const endTime = data.length >= 194 ? ethers.toBigInt("0x" + data.slice(130, 194)) : 0n;
    return {
      type: "AuctionCreated",
      auctionId: topicAt(event, 1),
      seller: addressFromTopic(topicAt(event, 2)),
      reservePrice,
      startTime,
      endTime,
    };
  }

  if (t0 === BID_PLACED) {
    return {
      type: "BidPlaced",
      auctionId: topicAt(event, 1),
      bidder: addressFromTopic(topicAt(event, 2)),
      amount: uint256FromData(data),
      timestamp: BigInt(Math.floor(Date.now() / 1000)),
    };
  }

  if (t0 === AUCTION_EXTENDED) {
    return {
      type: "AuctionExtended",
      auctionId: topicAt(event, 1),
      newEndTime: uint256FromData(data),
    };
  }

  if (t0 === AUCTION_SETTLED) {
    return {
      type: "AuctionSettled",
      auctionId: topicAt(event, 1),
      winner: addressFromTopic(topicAt(event, 2)),
      amount: uint256FromData(data),
      seller: "", // not in event; could be looked up from auction if needed
    };
  }

  if (t0 === OFFER_MADE) {
    return {
      type: "OfferMade",
      listingId: topicAt(event, 1),
      buyer: addressFromTopic(topicAt(event, 2)),
      amount: uint256FromData(data),
    };
  }

  if (t0 === OFFER_ACCEPTED) {
    return {
      type: "OfferAccepted",
      listingId: topicAt(event, 1),
      buyer: addressFromTopic(topicAt(event, 2)),
      amount: uint256FromData(data),
    };
  }

  if (t0 === OFFER_REJECTED) {
    return {
      type: "OfferRejected",
      listingId: topicAt(event, 1),
      buyer: addressFromTopic(topicAt(event, 2)),
      amount: uint256FromData(data),
    };
  }

  if (t0 === OFFER_CANCELLED) {
    return {
      type: "OfferCancelled",
      listingId: topicAt(event, 1),
      buyer: addressFromTopic(topicAt(event, 2)),
      amount: uint256FromData(data),
    };
  }

  return null;
}
