import path from "path";
import fs from "fs";
import { Router } from "express";
import multer from "multer";
import { PrismaClient } from "../generated/prisma/client";
import type { Logger } from "pino";
import { ethers } from "ethers";
import { fetchMirrorEvents } from "../mirror";
import { decodeEvents, EXPECTED_TOPIC0_ITEM_LISTED } from "../indexer/decoder";
import { saveUpload } from "../storage";

const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB
const MAX_MEDIA_SIZE = 15 * 1024 * 1024; // 15MB

export function createRouter(
  prisma: PrismaClient,
  log: Logger,
  uploadsDir: string
): Router {
  const router = Router();
  const memoryStorage = multer.memoryStorage();
  const upload = multer({
    storage: memoryStorage,
    limits: { fileSize: MAX_IMAGE_SIZE },
  });
  const uploadMedia = multer({
    storage: memoryStorage,
    limits: { fileSize: MAX_MEDIA_SIZE },
  });

  // ── Listings ──────────────────────────────────────────────────────────────

  router.get("/listings", async (req, res) => {
    try {
      const page = Math.max(1, parseInt((req.query.page as string) || "1", 10));
      const limit = Math.min(
        50,
        Math.max(1, parseInt((req.query.limit as string) || "20", 10))
      );
      const skip = (page - 1) * limit;

      const statusFilter = req.query.status as string | undefined;
      const whereClause =
        statusFilter && statusFilter !== "all"
          ? { status: statusFilter }
          : undefined;

      const [listings, total] = await Promise.all([
        prisma.listing.findMany({
          where: whereClause,
          include: {
            media: { orderBy: { order: "asc" } },
            seller: true,
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.listing.count({ where: whereClause }),
      ]);

      res.json({
        listings,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (e: any) {
      log.error({ err: e }, "Failed to fetch listings");
      res.status(500).json({ error: e?.message || "Internal server error" });
    }
  });

  router.get("/listings/:id", async (req, res) => {
    try {
      const listing = await prisma.listing.findUnique({
        where: { id: req.params.id },
        include: {
          media: { orderBy: { order: "asc" } },
          seller: true,
        },
      });
      if (!listing) {
        return res.status(404).json({ error: "Listing not found" });
      }
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
        tokenId,
        contractAddress,
        sellerAddress,
      } = req.body;

      if (!title || !price || !sellerAddress) {
        return res
          .status(400)
          .json({ error: "title, price, and sellerAddress are required" });
      }

      const seller = await prisma.user.upsert({
        where: { address: sellerAddress.toLowerCase() },
        update: {},
        create: {
          id: sellerAddress.toLowerCase(),
          address: sellerAddress.toLowerCase(),
          reputationScore: 0,
        },
      });

      const listing = await prisma.listing.create({
        data: {
          title,
          description,
          price: parseFloat(price),
          tokenId,
          contractAddress,
          sellerId: seller.id,
          status: "active",
        },
        include: {
          media: true,
          seller: true,
        },
      });

      res.status(201).json(listing);
    } catch (e: any) {
      log.error({ err: e }, "Failed to create listing");
      res.status(500).json({ error: e?.message || "Internal server error" });
    }
  });

  // ── Upload image (listing cover) ──────────────────────────────────────────

  router.post("/upload-image", (req, res) => {
    upload.single("image")(req, res, async (err: any) => {
      try {
        if (err) {
          if (err.code === "LIMIT_FILE_SIZE")
            return res
              .status(400)
              .json({ error: "Image must be 2 MB or smaller" });
          return res
            .status(400)
            .json({ error: err.message || "Upload failed" });
        }
        if (!req.file)
          return res.status(400).json({ error: "No file uploaded" });
        const ext = (
          path.extname(req.file.originalname) || ".jpg"
        )
          .toLowerCase()
          .slice(0, 5);
        const safeExt = /^\.(jpe?g|png|gif|webp)$/.test(ext) ? ext : ".jpg";
        const filename = `img-${Date.now()}-${Math.random()
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
        res.json({ url });
      } catch (e: any) {
        log.error({ err: e }, "Failed to upload image");
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
          log.warn({ err, code: err?.code }, "Upload middleware error");
          if (err.code === "LIMIT_FILE_SIZE")
            return res
              .status(400)
              .json({ error: "File must be 15 MB or smaller" });
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
        const safeExt =
          /^\.(jpe?g|png|gif|webp|mp4|mov|avi|wmv|flv|mkv|webm)$/.test(ext)
            ? ext
            : ".bin";
        const filename = `media-${Date.now()}-${Math.random()
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
        res.json({ url });
      } catch (e: any) {
        log.error({ err: e }, "Failed to upload listing media");
        res.status(500).json({ error: e?.message || "Internal server error" });
      }
    });
  });

  // ── Users ─────────────────────────────────────────────────────────────────

  router.get("/users/:address", async (req, res) => {
    try {
      const address = req.params.address.toLowerCase();
      const user = await prisma.user.findUnique({
        where: { address },
        include: {
          listings: {
            include: { media: { orderBy: { order: "asc" } } },
            orderBy: { createdAt: "desc" },
          },
        },
      });
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (e: any) {
      log.error({ err: e }, "Failed to fetch user");
      res.status(500).json({ error: e?.message || "Internal server error" });
    }
  });

  router.post("/users", async (req, res) => {
    try {
      const { address, username, bio } = req.body;
      if (!address) {
        return res.status(400).json({ error: "address is required" });
      }
      const user = await prisma.user.upsert({
        where: { address: address.toLowerCase() },
        update: { username, bio },
        create: {
          id: address.toLowerCase(),
          address: address.toLowerCase(),
          username,
          bio,
          reputationScore: 0,
        },
      });
      res.json(user);
    } catch (e: any) {
      log.error({ err: e }, "Failed to create/update user");
      res.status(500).json({ error: e?.message || "Internal server error" });
    }
  });

  // ── On-chain sync ─────────────────────────────────────────────────────────

  router.post("/sync-listings", async (req, res) => {
    try {
      const { rpcUrl, contractAddress, fromBlock, toBlock } = req.body;

      if (!rpcUrl || !contractAddress) {
        return res
          .status(400)
          .json({ error: "rpcUrl and contractAddress are required" });
      }

      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const events = await fetchMirrorEvents(
        provider,
        contractAddress,
        fromBlock || 0,
        toBlock || "latest"
      );

      const decoded = decodeEvents(events);
      const created: any[] = [];

      for (const item of decoded) {
        if (item.topic0 !== EXPECTED_TOPIC0_ITEM_LISTED) continue;
        const d = item.decoded as any;
        if (!d) continue;

        const sellerAddr = (d.seller as string).toLowerCase();
        const seller = await prisma.user.upsert({
          where: { address: sellerAddr },
          update: {},
          create: {
            id: sellerAddr,
            address: sellerAddr,
            reputationScore: 0,
          },
        });

        const existing = await prisma.listing.findFirst({
          where: {
            tokenId: String(d.tokenId),
            contractAddress: (d.nftContract as string).toLowerCase(),
          },
        });

        if (!existing) {
          const listing = await prisma.listing.create({
            data: {
              title: `Token #${d.tokenId}`,
              price: parseFloat(
                ethers.formatEther(d.price as bigint)
              ),
              tokenId: String(d.tokenId),
              contractAddress: (d.nftContract as string).toLowerCase(),
              sellerId: seller.id,
              status: "active",
            },
          });
          created.push(listing);
        }
      }

      res.json({ synced: created.length, listings: created });
    } catch (e: any) {
      log.error({ err: e }, "Failed to sync listings");
      res.status(500).json({ error: e?.message || "Internal server error" });
    }
  });

  // ── Offers ────────────────────────────────────────────────────────────────

  router.get("/listings/:listingId/offers", async (req, res) => {
    try {
      const offers = await prisma.offer.findMany({
        where: { listingId: req.params.listingId },
        include: { buyer: true },
        orderBy: { createdAt: "desc" },
      });
      res.json(offers);
    } catch (e: any) {
      log.error({ err: e }, "Failed to fetch offers");
      res.status(500).json({ error: e?.message || "Internal server error" });
    }
  });

  router.post("/listings/:listingId/offers", async (req, res) => {
    try {
      const { buyerAddress, amount, txHash } = req.body;
      if (!buyerAddress || !amount) {
        return res
          .status(400)
          .json({ error: "buyerAddress and amount are required" });
      }

      const buyer = await prisma.user.upsert({
        where: { address: buyerAddress.toLowerCase() },
        update: {},
        create: {
          id: buyerAddress.toLowerCase(),
          address: buyerAddress.toLowerCase(),
          reputationScore: 0,
        },
      });

      const offer = await prisma.offer.create({
        data: {
          listingId: req.params.listingId,
          buyerId: buyer.id,
          amount: parseFloat(amount),
          txHash,
          status: "pending",
        },
        include: { buyer: true },
      });

      res.status(201).json(offer);
    } catch (e: any) {
      log.error({ err: e }, "Failed to create offer");
      res.status(500).json({ error: e?.message || "Internal server error" });
    }
  });

  // ── Listing-level media ───────────────────────────────────────────────────

  router.post("/listings/:listingId/media", async (req, res) => {
    try {
      const { url, mediaType, order } = req.body;
      if (!url || !mediaType) {
        return res
          .status(400)
          .json({ error: "url and mediaType are required" });
      }
      const listing = await prisma.listing.findUnique({
        where: { id: req.params.listingId },
      });
      if (!listing) {
        return res.status(404).json({ error: "Listing not found" });
      }
      const media = await prisma.listingMedia.create({
        data: {
          listingId: req.params.listingId,
          url,
          mediaType,
          order: order ?? 0,
        },
      });
      res.status(201).json(media);
    } catch (e: any) {
      log.error({ err: e }, "Failed to add media to listing");
      res.status(500).json({ error: e?.message || "Internal server error" });
    }
  });

  router.delete("/listings/:listingId/media/:mediaId", async (req, res) => {
    try {
      const media = await prisma.listingMedia.findFirst({
        where: {
          id: req.params.mediaId,
          listingId: req.params.listingId,
        },
      });
      if (!media) {
        return res.status(404).json({ error: "Media not found" });
      }
      await prisma.listingMedia.delete({ where: { id: req.params.mediaId } });
      res.json({ success: true });
    } catch (e: any) {
      log.error({ err: e }, "Failed to delete media");
      res.status(500).json({ error: e?.message || "Internal server error" });
    }
  });

  router.put("/listings/:listingId/media/reorder", async (req, res) => {
    try {
      const { order } = req.body; // array of { id, order }
      if (!Array.isArray(order)) {
        return res.status(400).json({ error: "order must be an array" });
      }
      await Promise.all(
        order.map((item: { id: string; order: number }) =>
          prisma.listingMedia.update({
            where: { id: item.id },
            data: { order: item.order },
          })
        )
      );
      res.json({ success: true });
    } catch (e: any) {
      log.error({ err: e }, "Failed to reorder media");
      res.status(500).json({ error: e?.message || "Internal server error" });
    }
  });

  // ── Listing PATCH/DELETE ──────────────────────────────────────────────────

  router.patch("/listings/:id", async (req, res) => {
    try {
      const { title, description, price, status } = req.body;
      const listing = await prisma.listing.update({
        where: { id: req.params.id },
        data: {
          ...(title !== undefined && { title }),
          ...(description !== undefined && { description }),
          ...(price !== undefined && { price: parseFloat(price) }),
          ...(status !== undefined && { status }),
        },
        include: {
          media: { orderBy: { order: "asc" } },
          seller: true,
        },
      });
      res.json(listing);
    } catch (e: any) {
      if (e?.code === "P2025") {
        return res.status(404).json({ error: "Listing not found" });
      }
      log.error({ err: e }, "Failed to update listing");
      res.status(500).json({ error: e?.message || "Internal server error" });
    }
  });

  router.delete("/listings/:id", async (req, res) => {
    try {
      await prisma.listing.delete({ where: { id: req.params.id } });
      res.json({ success: true });
    } catch (e: any) {
      if (e?.code === "P2025") {
        return res.status(404).json({ error: "Listing not found" });
      }
      log.error({ err: e }, "Failed to delete listing");
      res.status(500).json({ error: e?.message || "Internal server error" });
    }
  });

  return router;
}
