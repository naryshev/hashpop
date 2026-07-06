import path from "path";
import fs from "fs";
import { ethers } from "ethers";
import { PrismaClient } from "../generated/prisma/client";
import type { Logger } from "pino";
import { fetchMirrorEvents } from "../mirror";
import { decodeEvents } from "./decoder";
import {
  fetchItemListedLogsFromRpc,
  updateLastProcessedBlock,
  getLastProcessedBlock,
  setLastProcessedBlock,
} from "./rpc";

const POLL_INTERVAL = 8000; // 8 seconds
const RECONCILE_INTERVAL = 60_000; // 1 minute — recheck unconfirmed listings against contract
const RECONCILE_BATCH = 50; // listings per reconciliation pass
let lastProcessedTimestamp = 0;

const STATE_FILE = path.join(process.cwd(), ".indexer-state.json");

function loadIndexerState(): { lastProcessedTimestamp: number; lastProcessedBlock: number } {
  try {
    const raw = fs.readFileSync(STATE_FILE, "utf8");
    const data = JSON.parse(raw);
    const ts = typeof data.lastProcessedTimestamp === "number" ? data.lastProcessedTimestamp : 0;
    const block = typeof data.lastProcessedBlock === "number" ? data.lastProcessedBlock : 0;
    return { lastProcessedTimestamp: Math.max(0, ts), lastProcessedBlock: Math.max(0, block) };
  } catch {
    return { lastProcessedTimestamp: 0, lastProcessedBlock: 0 };
  }
}

function saveIndexerState(ts: number, block: number): void {
  try {
    fs.writeFileSync(
      STATE_FILE,
      JSON.stringify({ lastProcessedTimestamp: ts, lastProcessedBlock: block }),
      "utf8",
    );
  } catch {
    // ignore
  }
}

function normalizeAddress(addr: string | undefined): string {
  if (!addr || typeof addr !== "string") return "";
  const hex = addr.startsWith("0x") ? addr.slice(2) : addr;
  return "0x" + hex.toLowerCase();
}

function weiToHbar(wei: bigint | string): string {
  const w = typeof wei === "string" ? BigInt(wei) : wei;
  if (w === 0n) return "0";
  const div = 10n ** 18n;
  const whole = w / div;
  const frac = w % div;
  const fracStr = frac.toString().padStart(18, "0").slice(0, 18).replace(/0+$/, "") || "0";
  return fracStr === "0" ? whole.toString() : `${whole}.${fracStr}`;
}

/** Tinybar (8 decimals) to HBAR string — the unit the contract stores prices in. */
function tinybarToHbar(tinybar: bigint | string): string {
  const tb = typeof tinybar === "string" ? BigInt(tinybar) : tinybar;
  if (tb === 0n) return "0";
  const div = 10n ** 8n;
  const whole = tb / div;
  const frac = tb % div;
  const fracStr = frac.toString().padStart(8, "0").replace(/0+$/, "") || "0";
  return fracStr === "0" ? whole.toString() : `${whole}.${fracStr}`;
}

/**
 * Convert an on-chain amount to an HBAR string.
 * Contracts currently store prices as tinybar (8 decimals, parseUnits(price, 8)).
 * Legacy listings may have used wei (18 decimals); the >= 1e15 threshold distinguishes them.
 */
function chainAmountToHbar(amount: bigint | string): string {
  const n = typeof amount === "string" ? BigInt(amount) : amount;
  if (n >= 10n ** 15n) return weiToHbar(n);
  return tinybarToHbar(n);
}

const MARKETPLACE_LISTINGS_ABI = [
  "function listings(bytes32) view returns (address seller, uint256 price, uint256 createdAt, uint8 status, bytes32 escrowId, bool requireEscrow)",
];

// How long a listing may stay unconfirmed before the reconciler treats it as
// dead and deletes it. Long enough to ride out slow relays and missed mirror
// events (the reconciler itself confirms those), short enough that phantom
// listings don't linger in the database.
const UNCONFIRMED_PURGE_AGE_MS = 30 * 60 * 1000;
// Confirmed LISTED rows are re-verified in a slow rotation (a few per pass)
// so listings pointing at a retired contract — e.g. testnet rows after the
// mainnet switch — are purged too.
const CONFIRMED_RECHECK_BATCH = 10;
let confirmedRecheckCursor: Date | null = null;
// A confirmed listing must read NONE on two separate passes before it is
// deleted — one anomalous RPC response must never destroy a live listing.
const confirmedNoneMisses = new Map<string, number>();

/** Delete a phantom listing and its dependents. Returns false if blocked (e.g. Sale FK). */
async function purgeListing(
  prisma: PrismaClient,
  log: Logger,
  listingId: string,
  reason: string,
): Promise<boolean> {
  try {
    await prisma.$transaction([
      prisma.offer.deleteMany({ where: { listingId } }),
      prisma.wishlistItem.deleteMany({ where: { itemId: listingId } }),
      prisma.shippingAddress.deleteMany({ where: { listingId } }),
      prisma.listing.delete({ where: { id: listingId } }),
    ]);
    log.info({ listingId, reason }, "Reconciler purged listing not present on-chain");
    return true;
  } catch (err) {
    // e.g. a Sale row references it — leave it for manual review.
    log.warn({ err, listingId }, "Reconciler: could not purge listing");
    return false;
  }
}

/**
 * Reconcile DB listings against the contract.
 *
 * Unconfirmed LISTED rows (every pass):
 *   - contract knows the listing (status > NONE) → set onChainConfirmed=true
 *     and correct the price (fixes missed mirror events);
 *   - contract says NONE past the grace window → the creation tx never
 *     landed; delete the row and its offers / wishlist entries / address.
 *
 * Confirmed LISTED rows (slow rotation, CONFIRMED_RECHECK_BATCH per pass):
 *   - re-verify they still exist on the configured contract; two consecutive
 *     NONE reads → purge. This clears stale rows after a contract redeploy
 *     or the testnet → mainnet switch.
 */
async function reconcileUnconfirmedListings(
  marketplaceAddress: string,
  prisma: PrismaClient,
  log: Logger,
): Promise<void> {
  const rpcUrl = process.env.HEDERA_RPC_URL;
  if (!rpcUrl || !marketplaceAddress) return;

  const unconfirmed = await prisma.listing.findMany({
    where: { onChainConfirmed: false, status: "LISTED" },
    select: { id: true, price: true, createdAt: true },
    take: RECONCILE_BATCH,
    orderBy: { createdAt: "asc" },
  });

  // Rotating window over confirmed rows, oldest-first, wrapping at the end.
  let recheck = await prisma.listing.findMany({
    where: {
      onChainConfirmed: true,
      status: "LISTED",
      ...(confirmedRecheckCursor && { createdAt: { gt: confirmedRecheckCursor } }),
    },
    select: { id: true, createdAt: true },
    take: CONFIRMED_RECHECK_BATCH,
    orderBy: { createdAt: "asc" },
  });
  confirmedRecheckCursor =
    recheck.length === CONFIRMED_RECHECK_BATCH
      ? recheck[recheck.length - 1]!.createdAt
      : null; // partial page — wrapped; restart from the oldest next pass

  if (unconfirmed.length === 0 && recheck.length === 0) return;

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const iface = new ethers.Interface(MARKETPLACE_LISTINGS_ABI);

  /** Reads the listing's on-chain status; null means the read was ambiguous. */
  const readChainStatus = async (listingId: string): Promise<number | null> => {
    const calldata = iface.encodeFunctionData("listings", [listingId]);
    const raw = await provider.call({ to: marketplaceAddress, data: calldata });
    if (!raw || raw === "0x") return null; // ambiguous read — never delete on ambiguity
    const decoded = iface.decodeFunctionResult("listings", raw);
    return Number(decoded[3] ?? 0);
  };

  let confirmed = 0;
  let purged = 0;

  for (const listing of unconfirmed) {
    try {
      const calldata = iface.encodeFunctionData("listings", [listing.id]);
      const raw = await provider.call({ to: marketplaceAddress, data: calldata });
      if (!raw || raw === "0x") continue;

      const decoded = iface.decodeFunctionResult("listings", raw);
      const status = Number(decoded[3] ?? 0);
      if (status === 0) {
        // NONE — the contract definitively does not know this listing. Give
        // fresh listings a grace window (creation tx may still be syncing),
        // then purge.
        const age = Date.now() - new Date(listing.createdAt).getTime();
        if (age < UNCONFIRMED_PURGE_AGE_MS) continue;
        if (await purgeListing(prisma, log, listing.id, "creation tx never confirmed")) {
          purged++;
        }
        continue;
      }

      const onChainPrice = BigInt(decoded[1]?.toString?.() ?? "0");
      const priceHbar = chainAmountToHbar(onChainPrice);

      await prisma.listing.update({
        where: { id: listing.id },
        data: {
          onChainConfirmed: true,
          ...(onChainPrice > 0n && { price: priceHbar }),
        },
      });
      confirmed++;
      log.info(
        { listingId: listing.id, priceHbar, status },
        "Reconciler confirmed listing on-chain",
      );
    } catch (err) {
      log.warn({ err, listingId: listing.id }, "Reconciler: contract read failed for listing");
    }
  }

  for (const listing of recheck) {
    try {
      const status = await readChainStatus(listing.id);
      if (status === null) continue;
      if (status !== 0) {
        confirmedNoneMisses.delete(listing.id);
        continue;
      }
      const misses = (confirmedNoneMisses.get(listing.id) ?? 0) + 1;
      if (misses < 2) {
        confirmedNoneMisses.set(listing.id, misses);
        continue;
      }
      confirmedNoneMisses.delete(listing.id);
      if (await purgeListing(prisma, log, listing.id, "no longer on configured contract")) {
        purged++;
      }
    } catch (err) {
      log.warn({ err, listingId: listing.id }, "Reconciler: recheck read failed for listing");
    }
  }

  if (confirmed > 0 || purged > 0) {
    log.info(
      { confirmed, purged, checked: unconfirmed.length + recheck.length },
      "Reconciler: processed listings",
    );
  }
}

/**
 * Backfill historical ItemListed events from the mirror node from the beginning of time.
 * Runs once at startup. Picks up any events the regular poll missed because they
 * occurred before lastProcessedTimestamp was initialised, or because the RPC chunk
 * window (5 blocks) was too narrow to catch them.
 */
async function backfillHistoricalEvents(
  marketplaceAddress: string,
  auctionHouseAddress: string,
  prisma: PrismaClient,
  log: Logger,
): Promise<void> {
  try {
    log.info("Starting historical event backfill from mirror node (timestamp=0)");
    const events = await fetchMirrorEvents(marketplaceAddress, auctionHouseAddress, 0);
    let processed = 0;
    for (const event of events) {
      try {
        const decoded = decodeEvents(event);
        if (!decoded) continue;
        await handleEvent(decoded, prisma, log);
        processed++;
      } catch (err) {
        log.warn({ err, event }, "Backfill: failed to process event");
      }
    }
    log.info({ processed }, "Historical event backfill complete");
  } catch (err) {
    log.error({ err }, "Historical event backfill failed");
  }
}

export async function startIndexer(prisma: PrismaClient, log: Logger) {
  const marketplaceAddress = normalizeAddress(process.env.MARKETPLACE_ADDRESS);
  const auctionHouseAddress = normalizeAddress(process.env.AUCTION_HOUSE_ADDRESS);

  if (!marketplaceAddress || !auctionHouseAddress) {
    log.warn("Contract addresses not set; indexer disabled");
    return;
  }

  const state = loadIndexerState();
  lastProcessedTimestamp = state.lastProcessedTimestamp;
  setLastProcessedBlock(state.lastProcessedBlock);
  log.info(
    {
      marketplaceAddress,
      auctionHouseAddress,
      lastProcessedTimestamp,
      lastProcessedBlock: state.lastProcessedBlock,
    },
    "Starting indexer (Mirror + RPC)",
  );

  const run = async () => {
    try {
      const processed = await processEvents(marketplaceAddress, auctionHouseAddress, prisma, log);
      saveIndexerState(lastProcessedTimestamp, getLastProcessedBlock());
      if (processed > 0) {
        log.info({ processed }, "Indexer processed events");
      }
    } catch (err) {
      log.error({ err }, "Indexer error");
    }
  };

  // On startup: backfill all historical mirror events, then start the normal poll.
  backfillHistoricalEvents(marketplaceAddress, auctionHouseAddress, prisma, log).finally(() => {
    run();
    setInterval(run, POLL_INTERVAL);
  });

  // Periodically reconcile DB listings that are still unconfirmed against the contract.
  const reconcile = () =>
    reconcileUnconfirmedListings(marketplaceAddress, prisma, log).catch((err) =>
      log.error({ err }, "Reconciler error"),
    );
  // First pass after a short delay to let the backfill settle.
  setTimeout(reconcile, 15_000);
  setInterval(reconcile, RECONCILE_INTERVAL);
}

async function processEvents(
  marketplaceAddr: string,
  auctionHouseAddr: string,
  prisma: PrismaClient,
  log: Logger,
): Promise<number> {
  const events = await fetchMirrorEvents(marketplaceAddr, auctionHouseAddr, lastProcessedTimestamp);

  if (events.length === 0 && lastProcessedTimestamp === 0) {
    log.debug("Mirror returned 0 logs; check GET /api/debug/mirror-logs");
  }

  let processed = 0;
  for (const event of events) {
    try {
      let ts =
        typeof event.timestamp === "string" ? parseFloat(event.timestamp) : Number(event.timestamp);
      if (ts > 1e15) ts = ts / 1e9;
      if (!Number.isNaN(ts) && isFinite(ts))
        lastProcessedTimestamp = Math.max(lastProcessedTimestamp, ts);

      const decoded = decodeEvents(event);
      if (!decoded) continue;
      await handleEvent(decoded, prisma, log);
      processed++;
    } catch (err) {
      log.error({ err, event }, "Failed to process event");
    }
  }

  const rpcLogs = await fetchItemListedLogsFromRpc(marketplaceAddr, log);
  let maxRpcBlock = 0;
  for (const rpcLog of rpcLogs) {
    try {
      const blockNum =
        typeof rpcLog.blockNumber === "bigint"
          ? Number(rpcLog.blockNumber)
          : Number(rpcLog.blockNumber ?? 0);
      if (!Number.isNaN(blockNum)) maxRpcBlock = Math.max(maxRpcBlock, blockNum);

      const decoded = decodeEvents(rpcLog);
      if (decoded?.type !== "ItemListed") continue;
      await handleEvent(decoded, prisma, log);
      processed++;
    } catch (err) {
      log.error({ err, rpcLog }, "Failed to process RPC log");
    }
  }
  if (maxRpcBlock > 0) updateLastProcessedBlock(maxRpcBlock);

  return processed;
}

function normalizeListingId(id: string): string {
  if (!id || typeof id !== "string") return id;
  const hex = id.startsWith("0x") ? id.slice(2) : id;
  return "0x" + hex.toLowerCase();
}

async function handleEvent(event: any, prisma: PrismaClient, log: Logger) {
  switch (event.type) {
    case "ItemListed": {
      const listingId = normalizeListingId(event.listingId);
      const seller = (event.seller || "").toLowerCase();
      await prisma.listing.upsert({
        where: { id: listingId },
        create: {
          id: listingId,
          seller,
          price: chainAmountToHbar(event.price),
          status: "LISTED",
          onChainConfirmed: true,
        },
        update: {
          price: chainAmountToHbar(event.price),
          status: "LISTED",
          onChainConfirmed: true,
        },
      });
      log.info({ listingId, seller }, "Listing indexed");
      break;
    }

    case "ItemPurchased": {
      const purchListingId = normalizeListingId(event.listingId);
      const buyer = normalizeAddress(event.buyer);
      const seller = normalizeAddress(event.seller);
      const amount = event.price.toString();
      const saleId = `sale-${purchListingId}-${buyer}`;
      await prisma.sale.upsert({
        where: { id: saleId },
        create: {
          id: saleId,
          listingId: purchListingId,
          buyer,
          seller,
          amount,
        },
        update: {},
      });
      // Check DB listing to determine if escrow or direct sale
      const dbListing = await prisma.listing.findUnique({
        where: { id: purchListingId },
        select: { requireEscrow: true },
      });
      const nextStatus = dbListing?.requireEscrow ? "LOCKED" : "SOLD";
      await prisma.listing.update({
        where: { id: purchListingId },
        data: { status: nextStatus, buyer },
      });
      break;
    }

    case "ListingCancelled":
      await prisma.listing.updateMany({
        where: { id: normalizeListingId(event.listingId) },
        data: { status: "CANCELLED" },
      });
      break;

    case "PriceUpdated":
      {
        const listingId = normalizeListingId(event.listingId);
        const result = await prisma.listing.updateMany({
          where: { id: listingId },
          data: { price: weiToHbar(event.newPrice) },
        });
        if (result.count === 0) {
          log.warn({ listingId }, "PriceUpdated event for missing listing");
        }
      }
      break;

    case "AuctionCreated":
      await prisma.auction.upsert({
        where: { id: event.auctionId },
        update: { status: "ACTIVE" },
        create: {
          id: event.auctionId,
          seller: (event.seller || "").toLowerCase(),
          reservePrice: chainAmountToHbar(event.reservePrice),
          startTime: BigInt(event.startTime),
          endTime: BigInt(event.endTime),
          status: "ACTIVE",
        },
      });
      break;

    case "BidPlaced":
      await prisma.bid.create({
        data: {
          id: `bid-${Date.now()}-${event.bidder}`,
          auctionId: event.auctionId,
          bidder: event.bidder,
          amount: event.amount.toString(),
          timestamp: BigInt(event.timestamp),
        },
      });
      break;

    case "AuctionSettled": {
      const auction = await prisma.auction.findUnique({ where: { id: event.auctionId } });
      const seller = auction?.seller ?? event.seller ?? "";
      await prisma.sale.create({
        data: {
          id: `sale-auction-${Date.now()}-${event.auctionId}`,
          auctionId: event.auctionId,
          buyer: event.winner,
          seller,
          amount: event.amount.toString(),
        },
      });
      await prisma.auction.update({
        where: { id: event.auctionId },
        data: { status: "SETTLED" },
      });
      break;
    }
  }
}
