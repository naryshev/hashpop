import path from "path";
import fs from "fs";
import { Router } from "express";
import multer from "multer";
import { PrismaClient } from "../generated/prisma/client";
import type { Logger } from "pino";
import { ethers } from "ethers";
import { fetchMirrorEvents } from "../mirror";
import { decodeEvents, EXPECTED_TOPIC0_ITEM_LISTED } from "../indexer/decoder";
import { saveUpload } from "../uploads";

const prisma = new PrismaClient();
const memoryStorage = multer.memoryStorage();

export function createRouter({
  log,
  uploadsDir,
}: {
  log: Logger;
  uploadsDir: string;
}): Router {
  const router = Router();

  // ── listings ──────────────────────────────────────────────────────────────

  router.get("/listings", async (_req, res) => {
    try {
      const listings = await prisma.listing.findMany({
        orderBy: { createdAt: "desc" },
        include: { media: true },
      });
      res.json(listings);
    } catch (e: any) {
      log.error({ err: e }, "Failed to fetch listings");
      res.status(500).json({ error: e?.message || "Internal server error" });
    }
  });

  router.get("/listings/:id", async (req, res) => {
    try {
      const listing = await prisma.listing.findUnique({
        where: { id: req.params.id },
        include: { media: true },
      });
      if (!listing) return res.status(404).json({ error: "Not found" });
      res.json(listing);
    } catch (e: any) {
      log.error({ err: e }, "Failed to fetch listing");
      res.status(500).json({ error: e?.message || "Internal server error" });
    }
  });

  router.post("/listings", async (req, res) => {
    try {
      const {
        title,
        description,
        price,
        address,
        chain,
        contractAddress,
        tokenId,
        txHash,
      } = req.body;
      if (!title || price == null || !address) {
        return res
          .status(400)
          .json({ error: "title, price, and address are required" });
      }
      const listing = await prisma.listing.create({
        data: {
          title,
          description: description ?? null,
          price: String(price),
          sellerAddress: address,
          chain: chain ?? null,
          contractAddress: contractAddress ?? null,
          tokenId: tokenId ?? null,
          txHash: txHash ?? null,
        },
      });
      res.status(201).json(listing);
    } catch (e: any) {
      log.error({ err: e }, "Failed to create listing");
      res.status(500).json({ error: e?.message || "Internal server error" });
    }
  });

  router.patch("/listings/:id", async (req, res) => {
    try {
      const { title, description, price } = req.body;
      const listing = await prisma.listing.update({
        where: { id: req.params.id },
        data: {
          ...(title !== undefined && { title }),
          ...(description !== undefined && { description }),
          ...(price !== undefined && { price: String(price) }),
        },
      });
      res.json(listing);
    } catch (e: any) {
      log.error({ err: e }, "Failed to update listing");
      res.status(500).json({ error: e?.message || "Internal server error" });
    }
  });

  // ── users ─────────────────────────────────────────────────────────────────

  router.get("/users/:address", async (req, res) => {
    try {
      const address = req.params.address.toLowerCase();
      const user = await prisma.user.findUnique({ where: { address } });
      if (!user) return res.status(404).json({ error: "Not found" });
      res.json(user);
    } catch (e: any) {
      log.error({ err: e }, "Failed to fetch user");
      res.status(500).json({ error: e?.message || "Internal server error" });
    }
  });

  router.post("/users", async (req, res) => {
    try {
      const { address, username, bio } = req.body;
      if (!address)
        return res.status(400).json({ error: "address is required" });
      const normalised = address.toLowerCase();
      const user = await prisma.user.upsert({
        where: { address: normalised },
        update: {
          ...(username !== undefined && { username }),
          ...(bio !== undefined && { bio }),
        },
        create: {
          id: normalised,
          address: normalised,
          username: username ?? null,
          bio: bio ?? null,
          reputationScore: 0,
        },
      });
      res.json(user);
    } catch (e: any) {
      log.error({ err: e }, "Failed to upsert user");
      res.status(500).json({ error: e?.message || "Internal server error" });
    }
  });

  // ── offers ────────────────────────────────────────────────────────────────

  router.post("/offers", async (req, res) => {
    try {
      const { listingId, buyerAddress, offerPrice } = req.body;
      if (!listingId || !buyerAddress || offerPrice == null) {
        return res
          .status(400)
          .json({ error: "listingId, buyerAddress, offerPrice are required" });
      }
      const offer = await prisma.offer.create({
        data: {
          listingId,
          buyerAddress: buyerAddress.toLowerCase(),
          offerPrice: String(offerPrice),
        },
      });
      res.status(201).json(offer);
    } catch (e: any) {
      log.error({ err: e }, "Failed to create offer");
      res.status(500).json({ error: e?.message || "Internal server error" });
    }
  });

  router.get("/offers", async (req, res) => {
    try {
      const { listingId } = req.query;
      const offers = await prisma.offer.findMany({
        where: listingId ? { listingId: String(listingId) } : undefined,
        orderBy: { createdAt: "desc" },
      });
      res.json(offers);
    } catch (e: any) {
      log.error({ err: e }, "Failed to fetch offers");
      res.status(500).json({ error: e?.message || "Internal server error" });
    }
  });

  // ── swipes ────────────────────────────────────────────────────────────────

  router.post("/swipes", async (req, res) => {
    try {
      const { listingId, swipedByAddress, direction } = req.body;
      if (!listingId || !swipedByAddress || !direction) {
        return res
          .status(400)
          .json({ error: "listingId, swipedByAddress, direction are required" });
      }
      if (direction !== "left" && direction !== "right") {
        return res
          .status(400)
          .json({ error: 'direction must be "left" or "right"' });
      }
      const swipe = await prisma.swipe.create({
        data: {
          listingId,
          swipedByAddress: swipedByAddress.toLowerCase(),
          direction,
        },
      });
      res.status(201).json(swipe);
    } catch (e: any) {
      log.error({ err: e }, "Failed to record swipe");
      res.status(500).json({ error: e?.message || "Internal server error" });
    }
  });

  // ── messages ──────────────────────────────────────────────────────────────

  router.get("/messages", async (req, res) => {
    try {
      const { offerId } = req.query;
      if (!offerId)
        return res.status(400).json({ error: "offerId is required" });
      const messages = await prisma.message.findMany({
        where: { offerId: String(offerId) },
        orderBy: { createdAt: "asc" },
      });
      res.json(messages);
    } catch (e: any) {
      log.error({ err: e }, "Failed to fetch messages");
      res.status(500).json({ error: e?.message || "Internal server error" });
    }
  });

  router.post("/messages", async (req, res) => {
    try {
      const { offerId, senderAddress, content } = req.body;
      if (!offerId || !senderAddress || !content) {
        return res
          .status(400)
          .json({ error: "offerId, senderAddress, content are required" });
      }
      const message = await prisma.message.create({
        data: {
          offerId,
          senderAddress: senderAddress.toLowerCase(),
          content,
        },
      });
      res.status(201).json(message);
    } catch (e: any) {
      log.error({ err: e }, "Failed to create message");
      res.status(500).json({ error: e?.message || "Internal server error" });
    }
  });

  // ── profile image upload ──────────────────────────────────────────────────

  const uploadProfile = multer({
    storage: memoryStorage,
    limits: { fileSize: 5 * 1024 * 1024 },
  });

  router.post("/upload-profile-image", (req, res) => {
    uploadProfile.single("image")(req, res, async (err: any) => {
      try {
        if (err) {
          if (err.code === "LIMIT_FILE_SIZE")
            return res
              .status(400)
              .json({ error: "Image must be 5 MB or smaller" });
          return res
            .status(400)
            .json({ error: err.message || "Upload failed" });
        }
        const address = (
          req.body?.address as string | undefined
        )
          ?.trim()
          .toLowerCase();
        if (!address)
          return res.status(400).json({ error: "address required" });
        if (!req.file)
          return res.status(400).json({ error: "image file required" });

        const ext = (
          path.extname(req.file.originalname) || ".jpg"
        )
          .toLowerCase()
          .slice(0, 5);
        const safeExt = /^\.(jpe?g|png|gif|webp)$/.test(ext) ? ext : ".jpg";
        const filename = `profile-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 10)}${safeExt}`;
        const baseUrl = `${req.protocol}://${req.get("host")}`;
        const url = await saveUpload(
          req.file.buffer,
          filename,
          req.file.mimetype,
          baseUrl,
          uploadsDir
        );

        await prisma.user.upsert({
          where: { address },
          update: { profileImageUrl: url },
          create: {
            id: address,
            address,
            profileImageUrl: url,
            reputationScore: 0,
          },
        });

        res.json({ profileImageUrl: url });
      } catch (e: any) {
        log.error({ err: e }, "Upload handler error");
        res.status(500).json({ error: e?.message || "Internal server error" });
      }
    });
  });

  // Avatar upload
  router.post("/upload-avatar", (req, res) => {
    const avatarUpload = multer({ storage: memoryStorage, limits: { fileSize: 5 * 1024 * 1024 } }).single("avatar");
    avatarUpload(req, res, async (err: any) => {
      try {
        if (err) {
          if (err.code === "LIMIT_FILE_SIZE")
            return res.status(400).json({ error: "Image must be 5 MB or smaller" });
          return res.status(400).json({ error: err.message || "Upload failed" });
        }
        const address = (req.body?.address as string | undefined)?.trim().toLowerCase();
        if (!address) return res.status(400).json({ error: "address required" });
        if (!req.file) return res.status(400).json({ error: "avatar file required" });
        const ext = (path.extname(req.file.originalname) || ".jpg").toLowerCase().slice(0, 5);
        const safeExt = /^\.(jpe?g|png|gif|webp)$/.test(ext) ? ext : ".jpg";
        const filename = `avatar-${Date.now()}-${Math.random().toString(36).slice(2, 10)}${safeExt}`;
        const baseUrl = `${req.protocol}://${req.get("host")}`;
        const url = await saveUpload(req.file.buffer, filename, req.file.mimetype, baseUrl, uploadsDir);
        await prisma.user.upsert({
          where: { address },
          update: { profileImageUrl: url },
          create: { id: address, address, profileImageUrl: url, reputationScore: 0 },
        });
        res.json({ profileImageUrl: url });
      } catch (e: any) {
        log.error({ err: e }, "Failed to upload avatar");
        res.status(500).json({ error: e?.message || "Internal server error" });
      }
    });
  });

  router.post("/upload-listing-media", (req, res) => {
    uploadMedia.single("media")(req, res, async (err: any) => {
      try {
        if (err) {
          log.warn({ err, code: err?.code }, "Upload media error");
          if (err.code === "LIMIT_FILE_SIZE")
            return res
              .status(400)
              .json({ error: "File must be 20 MB or smaller" });
          return res
            .status(400)
            .json({ error: err.message || "Upload failed" });
        }
        if (!req.file)
          return res.status(400).json({ error: "No file uploaded" });
        const ext = (
          path.extname(req.file.originalname) || ".bin"
        )
          .toLowerCase()
          .slice(0, 5);
        const safeExt = /^\.(jpe?g|png|gif|webp|mp4|mov|avi|mkv)$/.test(ext)
          ? ext
          : ".bin";
        const filename = `listing-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 10)}${safeExt}`;
        const baseUrl = `${req.protocol}://${req.get("host")}`;
        const url = await saveUpload(
          req.file.buffer,
          filename,
          req.file.mimetype,
          baseUrl,
          uploadsDir
        );
        const listingId = req.body?.listingId as string | undefined;
        if (listingId) {
          const mediaType = req.file.mimetype.startsWith("video/")
            ? "video"
            : "image";
          await prisma.listingMedia.create({
            data: { listingId, url, mediaType },
          });
        }
        res.json({ url });
      } catch (e: any) {
        log.error({ err: e }, "Failed to upload listing media");
        res.status(500).json({ error: e?.message || "Internal server error" });
      }
    });
  });

  // ── blockchain / indexer ──────────────────────────────────────────────────

  router.get("/events", async (req, res) => {
    try {
      const { contractAddress, fromBlock, toBlock } = req.query;
      if (!contractAddress)
        return res.status(400).json({ error: "contractAddress required" });

      const events = await fetchMirrorEvents({
        contractAddress: String(contractAddress),
        fromBlock: fromBlock ? Number(fromBlock) : undefined,
        toBlock: toBlock ? Number(toBlock) : undefined,
      });
      res.json(events);
    } catch (e: any) {
      log.error({ err: e }, "Failed to fetch events");
      res.status(500).json({ error: e?.message || "Internal server error" });
    }
  });

  router.post("/index-listing", async (req, res) => {
    try {
      const { txHash, contractAddress } = req.body;
      if (!txHash || !contractAddress) {
        return res
          .status(400)
          .json({ error: "txHash and contractAddress required" });
      }

      const provider = new ethers.JsonRpcProvider(
        process.env.RPC_URL || "https://mainnet.base.org"
      );
      const receipt = await provider.getTransactionReceipt(txHash);
      if (!receipt) {
        return res.status(404).json({ error: "Transaction not found" });
      }

      const relevantLogs = receipt.logs.filter(
        (l) =>
          l.address.toLowerCase() === contractAddress.toLowerCase() &&
          l.topics[0] === EXPECTED_TOPIC0_ITEM_LISTED
      );

      if (relevantLogs.length === 0) {
        return res.status(404).json({ error: "No ItemListed events found" });
      }

      const decoded = decodeEvents(relevantLogs);

      const listings = await Promise.all(
        decoded.map(async (item) => {
          return prisma.listing.upsert({
            where: { txHash_tokenId: { txHash, tokenId: String(item.tokenId) } },
            create: {
              title: item.metadata?.name || `NFT #${item.tokenId}`,
              description: item.metadata?.description || null,
              price: ethers.formatEther(item.price),
              sellerAddress: item.seller.toLowerCase(),
              chain: "base",
              contractAddress: contractAddress.toLowerCase(),
              tokenId: String(item.tokenId),
              txHash,
            },
            update: {
              price: ethers.formatEther(item.price),
            },
          });
        })
      );

      res.json({ indexed: listings.length, listings });
    } catch (e: any) {
      log.error({ err: e }, "Failed to index listing");
      res.status(500).json({ error: e?.message || "Internal server error" });
    }
  });

  // ── healthcheck ───────────────────────────────────────────────────────────

  router.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // ── on-chain listings from RPC ────────────────────────────────────────────

  router.get("/onchain-listings", async (req, res) => {
    try {
      const {
        contractAddress,
        fromBlock,
        toBlock,
        rpcUrl,
      } = req.query as Record<string, string>;

      if (!contractAddress)
        return res.status(400).json({ error: "contractAddress required" });

      const provider = new ethers.JsonRpcProvider(
        rpcUrl || process.env.RPC_URL || "https://mainnet.base.org"
      );

      const latestBlock = await provider.getBlockNumber();
      const from = fromBlock ? Number(fromBlock) : latestBlock - 10_000;
      const to = toBlock ? Number(toBlock) : latestBlock;

      const filter = {
        address: contractAddress,
        topics: [EXPECTED_TOPIC0_ITEM_LISTED],
        fromBlock: from,
        toBlock: to,
      };

      const logs = await provider.getLogs(filter);
      const decoded = decodeEvents(logs);

      res.json({ count: decoded.length, listings: decoded });
    } catch (e: any) {
      log.error({ err: e }, "Failed to fetch on-chain listings");
      res.status(500).json({ error: e?.message || "Internal server error" });
    }
  });

  // ── listing-swipes (next unseen listing per user) ─────────────────────────

  router.get("/listing-swipes/next", async (req, res) => {
    try {
      const rawAddress = req.query.address as string | undefined;
      if (!rawAddress)
        return res.status(400).json({ error: "address required" });
      const address = rawAddress.trim().toLowerCase();

      // IDs already swiped by this user
      const swiped = await prisma.swipe.findMany({
        where: { swipedByAddress: address },
        select: { listingId: true },
      });
      const swipedIds = swiped.map((s) => s.listingId);

      const listing = await prisma.listing.findFirst({
        where: { id: { notIn: swipedIds } },
        orderBy: { createdAt: "asc" },
        include: { media: true },
      });

      if (!listing) return res.status(204).send();
      res.json(listing);
    } catch (e: any) {
      log.error({ err: e }, "Failed to fetch next listing for swipe");
      res.status(500).json({ error: e?.message || "Internal server error" });
    }
  });

  router.post("/listing-swipes", async (req, res) => {
    try {
      const { listingId, address, direction } = req.body as {
        listingId?: string;
        address?: string;
        direction?: string;
      };

      if (!listingId || !address || !direction)
        return res
          .status(400)
          .json({ error: "listingId, address, direction required" });

      if (direction !== "left" && direction !== "right")
        return res
          .status(400)
          .json({ error: 'direction must be "left" or "right"' });

      const swipe = await prisma.swipe.create({
        data: {
          listingId,
          swipedByAddress: address.trim().toLowerCase(),
          direction,
        },
      });
      res.status(201).json(swipe);
    } catch (e: any) {
      log.error({ err: e }, "Failed to record listing swipe");
      res.status(500).json({ error: e?.message || "Internal server error" });
    }
  });

  return router;
}

// ── media upload (module-level, shared) ───────────────────────────────────────

const uploadMedia = multer({
  storage: memoryStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const allowed = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "video/mp4",
      "video/quicktime",
      "video/x-msvideo",
      "video/x-matroska",
    ];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    cb(new Error("Unsupported file type"));
  },
});

export async function handleError(err: any, res: any): Promise<void> {
  if (err.code === "LIMIT_FILE_SIZE") {
    res.status(400).json({ error: "File must be 20 MB or smaller" });
  } else {
    res.status(400).json({ error: err.message });
  }
}
