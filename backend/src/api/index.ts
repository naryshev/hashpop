import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import type { Logger } from "pino";
import { fetchMirrorEvents } from "../mirror";
import { decodeEvents, EXPECTED_TOPIC0_ITEM_LISTED } from "../indexer/decoder";

export function apiRouter(prisma: PrismaClient, log: Logger): Router {
  const router = Router();

  router.get("/listings", async (req, res) => {
    try {
      const listings = await prisma.listing.findMany({
        where: { status: "LISTED" },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      res.json({ listings });
    } catch (err) {
      log.error({ err }, "Failed to fetch listings");
      res.status(500).json({ error: "Internal server error" });
    }
  });

  router.get("/listing/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const listing = await prisma.listing.findUnique({
        where: { id },
      });
      if (!listing) return res.status(404).json({ error: "Listing not found" });
      res.json({ listing });
    } catch (err) {
      log.error({ err }, "Failed to fetch listing");
      res.status(500).json({ error: "Internal server error" });
    }
  });

  router.post("/user/register", async (req, res) => {
    try {
      const { address } = req.body as { address?: string };
      if (!address || typeof address !== "string") {
        return res.status(400).json({ error: "address required" });
      }
      const addrLower = address.toLowerCase();
      await prisma.user.upsert({
        where: { address: addrLower },
        update: {},
        create: {
          id: addrLower,
          address: addrLower,
        },
      });
      res.json({ ok: true, address: addrLower });
    } catch (err) {
      log.error({ err }, "Failed to register user");
      res.status(500).json({ error: "Internal server error" });
    }
  });

  router.get("/user/:address", async (req, res) => {
    try {
      const { address } = req.params;
      const addrLower = address.toLowerCase();
      const user = await prisma.user.findUnique({
        where: { address: addrLower },
      });

      const [activeListings, totalSalesFromSales] = await Promise.all([
        prisma.listing.count({
          where: { status: "LISTED", seller: addrLower },
        }),
        prisma.sale.count({
          where: { seller: addrLower },
        }),
      ]);

      if (!user) {
        return res.json({
          address,
          totalSales: totalSalesFromSales,
          activeListings,
          reputation: "N/A",
        });
      }

      res.json({
        address: user.address,
        totalSales: user.totalSales ?? totalSalesFromSales,
        activeListings,
        reputation: user.reputationScore,
        successful: user.successfulCompletions,
      });
    } catch (err) {
      log.error({ err }, "Failed to fetch user");
      res.status(500).json({ error: "Internal server error" });
    }
  });

  router.get("/debug/mirror-logs", async (req, res) => {
    const marketplaceAddress = process.env.MARKETPLACE_ADDRESS;
    const auctionHouseAddress = process.env.AUCTION_HOUSE_ADDRESS;
    if (!marketplaceAddress || !auctionHouseAddress) {
      return res.json({ error: "MARKETPLACE_ADDRESS or AUCTION_HOUSE_ADDRESS not set" });
    }
    try {
      const events = await fetchMirrorEvents(
        marketplaceAddress,
        auctionHouseAddress,
        0
      );
      const eventsWithDecoded = events.map((ev: any) => {
        const topic0 = ev.topics?.[0] ?? ev.topic0 ?? null;
        const decoded = decodeEvents(ev);
        return {
          topic0: topic0 ? String(topic0).toLowerCase() : null,
          decodedType: decoded?.type ?? null,
          timestamp: ev.timestamp,
        };
      });
      const itemListedCount = eventsWithDecoded.filter((e: any) => e.decodedType === "ItemListed").length;
      return res.json({
        totalLogs: events.length,
        expectedTopic0ItemListed: EXPECTED_TOPIC0_ITEM_LISTED,
        itemListedDecodedCount: itemListedCount,
        events: eventsWithDecoded,
      });
    } catch (err: any) {
      log.error({ err }, "Debug mirror-logs failed");
      return res.status(500).json({ error: err.message });
    }
  });

  router.get("/debug/listings", async (req, res) => {
    try {
      const count = await prisma.listing.count();
      const listed = await prisma.listing.findMany({
        where: { status: "LISTED" },
        take: 20,
        orderBy: { createdAt: "desc" },
      });
      return res.json({ count, listedCount: listed.length, listings: listed });
    } catch (err: any) {
      log.error({ err }, "Debug listings failed");
      return res.status(500).json({ error: err.message });
    }
  });

  return router;
}
