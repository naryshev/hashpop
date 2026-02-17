import { PrismaClient } from "@prisma/client";
import type { Logger } from "pino";
import { fetchMirrorEvents } from "../mirror";
import { decodeEvents } from "./decoder";
import {
  fetchItemListedLogsFromRpc,
  updateLastProcessedBlock,
} from "./rpc";

const POLL_INTERVAL = 8000; // 8 seconds
let lastProcessedTimestamp = 0;

export async function startIndexer(prisma: PrismaClient, log: Logger) {
  const marketplaceAddress = process.env.MARKETPLACE_ADDRESS;
  const auctionHouseAddress = process.env.AUCTION_HOUSE_ADDRESS;

  if (!marketplaceAddress || !auctionHouseAddress) {
    log.warn("Contract addresses not set; indexer disabled");
    return;
  }

  log.info("Starting Mirror Node indexer");

  const run = async () => {
    try {
      const processed = await processEvents(
        marketplaceAddress,
        auctionHouseAddress,
        prisma,
        log
      );
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
      const ts =
        typeof event.timestamp === "string"
          ? parseFloat(event.timestamp)
          : Number(event.timestamp);
      if (!Number.isNaN(ts))
        lastProcessedTimestamp = Math.max(lastProcessedTimestamp, ts);

      const decoded = decodeEvents(event);
      if (!decoded) continue;
      await handleEvent(decoded, prisma, log);
      processed++;
    } catch (err) {
      log.error({ err, event }, "Failed to process event");
    }
  }

  const rpcLogs = await fetchItemListedLogsFromRpc(marketplaceAddr);
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

async function handleEvent(event: any, prisma: PrismaClient, log: Logger) {
  switch (event.type) {
    case "ItemListed": {
      const seller = (event.seller || "").toLowerCase();
      const existing = await prisma.listing.findUnique({ where: { id: event.listingId } });
      if (!existing) {
        await prisma.listing.create({
          data: {
            id: event.listingId,
            seller,
            price: event.price.toString(),
            status: "LISTED",
          },
        });
        log.info({ listingId: event.listingId, seller }, "Listing indexed");
      } else {
        await prisma.listing.update({
          where: { id: event.listingId },
          data: { status: "LISTED" },
        });
      }
      break;
    }

    case "ItemPurchased":
      await prisma.sale.create({
        data: {
          id: `sale-${Date.now()}-${event.listingId}`,
          listingId: event.listingId,
          buyer: event.buyer,
          seller: event.seller,
          amount: event.price.toString(),
        },
      });
      await prisma.listing.update({
        where: { id: event.listingId },
        data: { status: "LOCKED" },
      });
      break;

    case "ListingCancelled":
      await prisma.listing.updateMany({
        where: { id: event.listingId },
        data: { status: "CANCELLED" },
      });
      break;

    case "AuctionCreated":
      await prisma.auction.upsert({
        where: { id: event.auctionId },
        update: { status: "ACTIVE" },
        create: {
          id: event.auctionId,
          seller: (event.seller || "").toLowerCase(),
          reservePrice: event.reservePrice.toString(),
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
