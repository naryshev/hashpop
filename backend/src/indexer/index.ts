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

/**
 * Reconcile DB listings that are marked as LISTED but not yet confirmed on-chain.
 * For each, reads the contract directly. If the contract knows the listing (status > NONE),
 * set onChainConfirmed=true and correct the price. This fixes listings that were created
 * before the sync fixes landed, or where the mirror event was missed.
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
    select: { id: true, price: true },
    take: RECONCILE_BATCH,
    orderBy: { createdAt: "asc" },
  });

  if (unconfirmed.length === 0) return;

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const iface = new ethers.Interface(MARKETPLACE_LISTINGS_ABI);
  let confirmed = 0;

  for (const listing of unconfirmed) {
    try {
      const calldata = iface.encodeFunctionData("listings", [listing.id]);
      const raw = await provider.call({ to: marketplaceAddress, data: calldata });
      if (!raw || raw === "0x") continue;

      const decoded = iface.decodeFunctionResult("listings", raw);
      const status = Number(decoded[3] ?? 0);
      if (status === 0) continue; // NONE — listing genuinely does not exist on-chain

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

  if (confirmed > 0) {
    log.info({ confirmed, total: unconfirmed.length }, "Reconciler: confirmed listings on-chain");
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
