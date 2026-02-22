import path from "path";
import fs from "fs";
import { PrismaClient } from "@prisma/client";
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
    fs.writeFileSync(STATE_FILE, JSON.stringify({ lastProcessedTimestamp: ts, lastProcessedBlock: block }), "utf8");
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
  log.info({ marketplaceAddress, auctionHouseAddress, lastProcessedTimestamp, lastProcessedBlock: state.lastProcessedBlock }, "Starting indexer (Mirror + RPC)");

  const run = async () => {
    try {
      const processed = await processEvents(
        marketplaceAddress,
        auctionHouseAddress,
        prisma,
        log
      );
      saveIndexerState(lastProcessedTimestamp, getLastProcessedBlock());
      if (processed > 0) {
        log.info({ processed }, "Indexer processed events");
      }
    } catch (err) {
      log.error({ err }, "Indexer error");
    }
  };

  run();
  setInterval(run, POLL_INTERVAL);
}

async function processEvents(
  marketplaceAddr: string,
  auctionHouseAddr: string,
  prisma: PrismaClient,
  log: Logger
): Promise<number> {
  const events = await fetchMirrorEvents(
    marketplaceAddr,
    auctionHouseAddr,
    lastProcessedTimestamp
  );

  if (events.length === 0 && lastProcessedTimestamp === 0) {
    log.debug("Mirror returned 0 logs; check GET /api/debug/mirror-logs");
  }

  let processed = 0;
  for (const event of events) {
    try {
      let ts =
        typeof event.timestamp === "string"
          ? parseFloat(event.timestamp)
          : Number(event.timestamp);
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
      const existing = await prisma.listing.findUnique({ where: { id: listingId } });
      if (!existing) {
        await prisma.listing.create({
          data: {
            id: listingId,
            seller,
            price: weiToHbar(event.price),
            status: "LISTED",
          },
        });
        log.info({ listingId, seller }, "Listing indexed");
      } else {
        await prisma.listing.update({
          where: { id: listingId },
          data: { status: "LISTED" },
        });
      }
      break;
    }

    case "ItemPurchased": {
      const purchListingId = normalizeListingId(event.listingId);
      await prisma.sale.create({
        data: {
          id: `sale-${Date.now()}-${purchListingId}`,
          listingId: purchListingId,
          buyer: event.buyer,
          seller: event.seller,
          amount: event.price.toString(),
        },
      });
      await prisma.listing.update({
        where: { id: purchListingId },
        data: { status: "LOCKED" },
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
          reservePrice: weiToHbar(event.reservePrice),
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
