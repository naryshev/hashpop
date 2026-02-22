import path from "path";
import { Router } from "express";
import multer from "multer";
import { PrismaClient } from "@prisma/client";
import type { Logger } from "pino";
import { ethers } from "ethers";
import { fetchMirrorEvents } from "../mirror";
import { decodeEvents, EXPECTED_TOPIC0_ITEM_LISTED } from "../indexer/decoder";
import { saveUpload } from "../storage";

const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB
const MAX_MEDIA_SIZE = 15 * 1024 * 1024; // 15MB for video

function normalizeListingId(id: string): string {
  if (!id || typeof id !== "string") return id;
  const hex = id.startsWith("0x") ? id.slice(2) : id;
  return "0x" + hex.toLowerCase();
}

/** Convert listing id (0x...64 hex or string) to bytes32 for contract calls. */
function listingIdToBytes32(id: string): string {
  if (!id || typeof id !== "string") return "0x" + "0".repeat(64);
  if (id.startsWith("0x")) {
    const body = id.slice(2).toLowerCase();
    if (/^[0-9a-f]*$/.test(body) && body.length > 0 && body.length <= 64) {
      return "0x" + body.padEnd(64, "0");
    }
  }
  const hex = Buffer.from(id, "utf8").toString("hex").padEnd(64, "0").slice(0, 64);
  return "0x" + hex;
}

/** Wei (18 decimals) to HBAR string for storage/display. */
function weiToHbar(wei: bigint | string): string {
  const w = typeof wei === "string" ? BigInt(wei) : wei;
  if (w === 0n) return "0";
  const div = 10n ** 18n;
  const whole = w / div;
  const frac = w % div;
  const fracStr = frac.toString().padStart(18, "0").slice(0, 18).replace(/0+$/, "") || "0";
  return fracStr === "0" ? whole.toString() : `${whole}.${fracStr}`;
}

/** If value looks like wei (long digit string), convert to HBAR; else return as-is. */
function toHbarForClient(value: string | null | undefined): string {
  if (value == null || value === "") return "";
  const s = String(value).trim();
  if (s.length > 15 && /^\d+$/.test(s)) return weiToHbar(s);
  return s;
}

const ESCROW_ABI_VIEW = [
  "function escrows(bytes32) view returns (address buyer, address seller, uint256 amount, uint256 createdAt, uint256 timeoutAt, uint8 state)",
];
const MARKETPLACE_ABI_VIEW = [
  "function listings(bytes32) view returns (address seller, uint256 price, uint256 createdAt, uint8 status, bytes32 escrowId)",
];

function imageFilename(originalname: string): string {
  const ext = (path.extname(originalname) || ".jpg").toLowerCase().slice(0, 5);
  const safe = /^\.(jpe?g|png|gif|webp)$/.test(ext) ? ext : ".jpg";
  return `listing-${Date.now()}-${Math.random().toString(36).slice(2, 10)}${safe}`;
}

function deriveMessageTopicId(addressA: string, addressB: string, listingId?: string | null): string {
  const [left, right] = [addressA.toLowerCase(), addressB.toLowerCase()].sort();
  const scope = listingId?.trim() || "global";
  const key = `${left}:${right}:${scope}`;
  return `hcs-sim-${ethers.keccak256(ethers.toUtf8Bytes(key)).slice(2, 18)}`;
}
function mediaFilename(originalname: string): string {
  const ext = (path.extname(originalname) || ".jpg").toLowerCase().slice(0, 8);
  const safe = /^\.(jpe?g|png|gif|webp|mp4|webm|mov)$/.test(ext) ? ext : ".bin";
  return `listing-${Date.now()}-${Math.random().toString(36).slice(2, 10)}${safe}`;
}

const memoryStorage = multer.memoryStorage();

export function apiRouter(prisma: PrismaClient, log: Logger, uploadsDir: string): Router {
  const router = Router();

  const upload = multer({
    storage: memoryStorage,
    limits: { fileSize: MAX_IMAGE_SIZE },
    fileFilter: (_req, file, cb) => {
      const ok = /^image\/(jpeg|jpg|png|gif|webp)$/i.test(file.mimetype);
      if (ok) cb(null, true);
      else cb(new Error("Only JPEG, PNG, GIF, or WebP images allowed"));
    },
  });

  const uploadMedia = multer({
    storage: memoryStorage,
    limits: { fileSize: MAX_MEDIA_SIZE },
    fileFilter: (_req, file, cb) => {
      const ok = /^image\/(jpeg|jpg|png|gif|webp)$/i.test(file.mimetype) ||
        /^video\/(mp4|webm|quicktime)$/i.test(file.mimetype);
      if (ok) cb(null, true);
      else cb(new Error("Only images (JPEG, PNG, GIF, WebP) or videos (MP4, WebM, MOV) allowed"));
    },
  });

  router.post("/upload-listing-image", (req, res) => {
    upload.single("image")(req, res, async (err: any) => {
      try {
        if (err) {
          log.warn({ err, code: err?.code }, "Upload error");
          if (err.code === "LIMIT_FILE_SIZE") return res.status(400).json({ error: "Image must be 2MB or smaller" });
          return res.status(400).json({ error: err.message || "Upload failed" });
        }
        if (!req.file?.buffer) return res.status(400).json({ error: "No image file" });
        const baseUrl = `${req.protocol}://${req.get("host")}`;
        const filename = imageFilename(req.file.originalname);
        const imageUrl = await saveUpload(
          req.file.buffer,
          filename,
          req.file.mimetype,
          baseUrl,
          uploadsDir
        );
        res.json({ imageUrl });
      } catch (e: any) {
        log.error({ err: e }, "Upload handler error");
        res.status(500).json({ error: e?.message || "Internal server error" });
      }
    });
  });

  router.post("/upload-listing-media", (req, res) => {
    uploadMedia.single("media")(req, res, async (err: any) => {
      try {
        if (err) {
          log.warn({ err, code: err?.code }, "Upload media error");
          if (err.code === "LIMIT_FILE_SIZE") return res.status(400).json({ error: "File must be 15MB or smaller" });
          return res.status(400).json({ error: err.message || "Upload failed" });
        }
        if (!req.file?.buffer) return res.status(400).json({ error: "No file" });
        const baseUrl = `${req.protocol}://${req.get("host")}`;
        const filename = mediaFilename(req.file.originalname);
        const mediaUrl = await saveUpload(
          req.file.buffer,
          filename,
          req.file.mimetype,
          baseUrl,
          uploadsDir
        );
        res.json({ mediaUrl });
      } catch (e: any) {
        log.error({ err: e }, "Upload media handler error");
        res.status(500).json({ error: e?.message || "Internal server error" });
      }
    });
  });

  router.get("/listings", async (req, res) => {
    try {
      const [listings, auctions] = await Promise.all([
        prisma.listing.findMany({
          where: { status: "LISTED" },
          orderBy: { createdAt: "desc" },
          take: 50,
        }),
        prisma.auction.findMany({
          where: { status: "ACTIVE" },
          orderBy: { createdAt: "desc" },
          take: 50,
        }),
      ]);
      let listingPriceOverrides = new Map<string, string>();
      const marketplaceAddr = process.env.MARKETPLACE_ADDRESS;
      const rpcUrl = process.env.HEDERA_RPC_URL;
      if (marketplaceAddr && rpcUrl && listings.length > 0) {
        try {
          const provider = new ethers.JsonRpcProvider(rpcUrl);
          const contract = new ethers.Contract(marketplaceAddr, MARKETPLACE_ABI_VIEW, provider);
          const overrides = await Promise.all(
            listings.map(async (l) => {
              try {
                const data = await contract.listings(l.id);
                const [seller, price, , status] = data;
                const priceStr = price != null ? price.toString() : "";
                const isListed = Number(status) === 1;
                const hasSeller = seller && seller !== ethers.ZeroAddress;
                const priceWei = BigInt(priceStr || "0");
                if (priceStr && priceStr !== "0" && isListed && hasSeller && priceWei >= 10n ** 15n) {
                  return [l.id, weiToHbar(priceStr)] as const;
                }
              } catch {
                // ignore per-listing on-chain read errors
              }
              return null;
            })
          );
          listingPriceOverrides = new Map(overrides.filter((x): x is readonly [string, string] => x !== null));
        } catch (e) {
          log.warn({ err: e }, "Could not read on-chain listing prices for /listings");
        }
      }
      res.json({
        listings: listings.map((l) => ({
          ...l,
          price: listingPriceOverrides.get(l.id) ?? toHbarForClient(l.price),
        })),
        auctions: auctions.map((a) => ({ ...a, reservePrice: toHbarForClient(a.reservePrice) })),
      });
    } catch (err) {
      log.error({ err }, "Failed to fetch listings");
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * Sync a listing from a createListing transaction.
   * Call this after the frontend tx confirms so the listing shows immediately
   * without waiting for the indexer (Mirror/RPC can be slow or limited on Hedera).
   */
  router.post("/sync-listing", async (req, res) => {
    const { txHash, imageUrl, mediaUrls, title, subtitle, description, category, condition, yearOfProduction } = (req.body || {}) as {
      txHash?: string;
      imageUrl?: string;
      mediaUrls?: string[];
      title?: string;
      subtitle?: string;
      description?: string;
      category?: string;
      condition?: string;
      yearOfProduction?: string;
    };
    if (!txHash || typeof txHash !== "string") {
      return res.status(400).json({ error: "txHash required" });
    }
    const rpcUrl = process.env.HEDERA_RPC_URL;
    if (!rpcUrl) {
      return res.status(503).json({ error: "HEDERA_RPC_URL not set" });
    }
    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const receipt = await provider.getTransactionReceipt(txHash);
      if (!receipt || !receipt.logs?.length) {
        return res.status(404).json({ error: "Transaction or logs not found" });
      }
      for (const logEntry of receipt.logs) {
        const decoded = decodeEvents(logEntry);
        if (decoded?.type !== "ItemListed") continue;
        const listingId = normalizeListingId(decoded.listingId);
        const seller = (decoded.seller || "").toLowerCase();
        const imageUrlStr = typeof imageUrl === "string" && imageUrl ? imageUrl : null;
        const mediaList =
          Array.isArray(mediaUrls) && mediaUrls.length > 0
            ? mediaUrls.filter((u): u is string => typeof u === "string" && u.length > 0)
            : imageUrlStr
              ? [imageUrlStr]
              : [];
        const titleStr = typeof title === "string" && title.trim() ? title.trim() : null;
        const subtitleStr = typeof subtitle === "string" && subtitle.trim() ? subtitle.trim() : null;
        const descriptionStr = typeof description === "string" && description.trim() ? description.trim() : null;
        const categoryStr = typeof category === "string" && category.trim() ? category.trim() : null;
        const conditionStr = typeof condition === "string" && condition.trim() ? condition.trim() : null;
        const yearStr = typeof yearOfProduction === "string" && yearOfProduction.trim() ? yearOfProduction.trim() : null;
        const priceHbar = weiToHbar(decoded.price);
        await prisma.listing.upsert({
          where: { id: listingId },
          update: {
            status: "LISTED",
            price: priceHbar,
            ...(imageUrlStr != null && { imageUrl: imageUrlStr }),
            ...(mediaList.length > 0 && { mediaUrls: mediaList }),
            ...(titleStr != null && { title: titleStr }),
            ...(subtitleStr != null && { subtitle: subtitleStr }),
            ...(descriptionStr != null && { description: descriptionStr }),
            ...(categoryStr != null && { category: categoryStr }),
            ...(conditionStr != null && { condition: conditionStr }),
            ...(yearStr != null && { yearOfProduction: yearStr }),
          },
          create: {
            id: listingId,
            seller,
            price: priceHbar,
            status: "LISTED",
            ...(imageUrlStr != null && { imageUrl: imageUrlStr }),
            ...(mediaList.length > 0 && { mediaUrls: mediaList }),
            ...(titleStr != null && { title: titleStr }),
            ...(subtitleStr != null && { subtitle: subtitleStr }),
            ...(descriptionStr != null && { description: descriptionStr }),
            ...(categoryStr != null && { category: categoryStr }),
            ...(conditionStr != null && { condition: conditionStr }),
            ...(yearStr != null && { yearOfProduction: yearStr }),
          },
        });
        log.info({ listingId, seller, txHash }, "Synced listing from tx");
        return res.json({ ok: true, listingId });
      }
      return res.status(404).json({ error: "No ItemListed event in transaction" });
    } catch (err: any) {
      log.error({ err, txHash }, "Sync listing failed");
      return res.status(500).json({ error: err.message || "Sync failed" });
    }
  });

  /**
   * Sync a listing price update from tx so the latest on-chain price is reflected immediately.
   */
  router.post("/sync-price-update", async (req, res) => {
    const { txHash } = (req.body || {}) as { txHash?: string };
    if (!txHash || typeof txHash !== "string") {
      return res.status(400).json({ error: "txHash required" });
    }
    const rpcUrl = process.env.HEDERA_RPC_URL;
    if (!rpcUrl) {
      return res.status(503).json({ error: "HEDERA_RPC_URL not set" });
    }
    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const receipt = await provider.getTransactionReceipt(txHash);
      if (!receipt?.logs?.length) {
        return res.status(404).json({ error: "Transaction or logs not found" });
      }
      for (const logEntry of receipt.logs) {
        const decoded = decodeEvents(logEntry);
        if (decoded?.type !== "PriceUpdated") continue;
        const listingId = normalizeListingId(decoded.listingId);
        const newPriceHbar = weiToHbar(decoded.newPrice);
        const result = await prisma.listing.updateMany({
          where: { id: listingId },
          data: { price: newPriceHbar },
        });
        if (result.count === 0) {
          log.warn({ listingId, txHash }, "Sync price update: listing missing");
          return res.status(404).json({ error: "Listing not found for price update event" });
        }
        log.info({ listingId, txHash }, "Synced listing price update from tx");
        return res.json({ ok: true, listingId, price: newPriceHbar });
      }
      return res.status(404).json({ error: "No PriceUpdated event in transaction" });
    } catch (err: any) {
      log.error({ err, txHash }, "Sync price update failed");
      return res.status(500).json({ error: err.message || "Sync failed" });
    }
  });

  /**
   * Sync a listing cancellation from tx so dashboard count updates immediately.
   */
  router.post("/sync-cancel", async (req, res) => {
    const { txHash } = (req.body || {}) as { txHash?: string };
    if (!txHash || typeof txHash !== "string") {
      return res.status(400).json({ error: "txHash required" });
    }
    const rpcUrl = process.env.HEDERA_RPC_URL;
    if (!rpcUrl) {
      return res.status(503).json({ error: "HEDERA_RPC_URL not set" });
    }
    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const receipt = await provider.getTransactionReceipt(txHash);
      if (!receipt?.logs?.length) {
        return res.status(404).json({ error: "Transaction or logs not found" });
      }
      for (const logEntry of receipt.logs) {
        const decoded = decodeEvents(logEntry);
        if (decoded?.type !== "ListingCancelled") continue;
        const listingId = normalizeListingId(decoded.listingId);
        await prisma.listing.updateMany({
          where: { id: listingId },
          data: { status: "CANCELLED" },
        });
        log.info({ listingId, txHash }, "Synced cancel from tx");
        return res.json({ ok: true, listingId });
      }
      return res.status(404).json({ error: "No ListingCancelled event in transaction" });
    } catch (err: any) {
      log.error({ err, txHash }, "Sync cancel failed");
      return res.status(500).json({ error: err.message || "Sync failed" });
    }
  });

  /**
   * Sync an auction from createAuction transaction so it shows immediately.
   */
  router.post("/sync-auction", async (req, res) => {
    const { txHash, title, subtitle, description, condition, yearOfProduction, imageUrl, mediaUrls } = (req.body || {}) as {
      txHash?: string;
      title?: string;
      subtitle?: string;
      description?: string;
      condition?: string;
      yearOfProduction?: string;
      imageUrl?: string;
      mediaUrls?: string[];
    };
    if (!txHash || typeof txHash !== "string") {
      return res.status(400).json({ error: "txHash required" });
    }
    const rpcUrl = process.env.HEDERA_RPC_URL;
    if (!rpcUrl) {
      return res.status(503).json({ error: "HEDERA_RPC_URL not set" });
    }
    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const receipt = await provider.getTransactionReceipt(txHash);
      if (!receipt?.logs?.length) {
        return res.status(404).json({ error: "Transaction or logs not found" });
      }
      const subtitleStr = typeof subtitle === "string" && subtitle.trim() ? subtitle.trim() : null;
      const conditionStr = typeof condition === "string" && condition.trim() ? condition.trim() : null;
      const yearStr = typeof yearOfProduction === "string" && yearOfProduction.trim() ? yearOfProduction.trim() : null;
      for (const logEntry of receipt.logs) {
        const decoded = decodeEvents(logEntry);
        if (decoded?.type !== "AuctionCreated") continue;
        const auctionId = normalizeListingId(decoded.auctionId);
        const seller = (decoded.seller || "").toLowerCase();
        const titleStr = typeof title === "string" && title.trim() ? title.trim() : null;
        const descriptionStr = typeof description === "string" && description.trim() ? description.trim() : null;
        const imageUrlStr = typeof imageUrl === "string" && imageUrl ? imageUrl : null;
        const mediaList = Array.isArray(mediaUrls) && mediaUrls.length > 0
          ? mediaUrls.filter((u): u is string => typeof u === "string" && u.length > 0)
          : imageUrlStr ? [imageUrlStr] : [];
        const extra = {
          ...(titleStr != null && { title: titleStr }),
          ...(subtitleStr != null && { subtitle: subtitleStr }),
          ...(descriptionStr != null && { description: descriptionStr }),
          ...(conditionStr != null && { condition: conditionStr }),
          ...(yearStr != null && { yearOfProduction: yearStr }),
          ...(imageUrlStr != null && { imageUrl: imageUrlStr }),
          ...(mediaList.length > 0 && { mediaUrls: mediaList }),
        };
        await prisma.auction.upsert({
          where: { id: auctionId },
          update: { status: "ACTIVE", ...extra },
          create: {
            id: auctionId,
            seller,
            reservePrice: weiToHbar(decoded.reservePrice),
            startTime: decoded.startTime,
            endTime: decoded.endTime,
            status: "ACTIVE",
            ...extra,
          },
        });
        log.info({ auctionId, seller, txHash }, "Synced auction from tx");
        return res.json({ ok: true, auctionId });
      }
      return res.status(404).json({ error: "No AuctionCreated event in transaction" });
    } catch (err: any) {
      log.error({ err, txHash }, "Sync auction failed");
      return res.status(500).json({ error: err.message || "Sync failed" });
    }
  });

  router.get("/listing/:id", async (req, res) => {
    try {
      const rawId = req.params.id ?? "";
      const id = rawId.startsWith("0x") && rawId.length === 66 ? normalizeListingId(rawId) : listingIdToBytes32(rawId);
      const listing = await prisma.listing.findUnique({
        where: { id },
      });
      if (!listing) return res.status(404).json({ error: "Listing not found" });

      let onChainPrice: string | null = null;
      const marketplaceAddr = process.env.MARKETPLACE_ADDRESS;
      const rpcUrl = process.env.HEDERA_RPC_URL;
      if (marketplaceAddr && rpcUrl) {
        try {
          const provider = new ethers.JsonRpcProvider(rpcUrl);
          const contract = new ethers.Contract(marketplaceAddr, MARKETPLACE_ABI_VIEW, provider);
          const data = await contract.listings(id);
          const [seller, price, , status] = data;
          const priceStr = price != null ? price.toString() : "";
          const isListed = Number(status) === 1;
          const hasSeller = seller && seller !== ethers.ZeroAddress;
          const priceWei = BigInt(priceStr || "0");
          if (priceStr && priceStr !== "0" && isListed && hasSeller && priceWei >= 10n ** 15n) {
            onChainPrice = priceStr;
          }
        } catch (e) {
          log.warn({ err: e, listingId: id }, "Could not read on-chain listing price");
        }
      }

      const priceForClient = onChainPrice ? weiToHbar(onChainPrice) : toHbarForClient(listing.price);

      res.json({
        listing: {
          ...listing,
          price: priceForClient,
        },
      });
    } catch (err) {
      log.error({ err }, "Failed to fetch listing");
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * GET /api/escrow/:listingId — read escrow state from chain (buyer, seller, amount, state, timeoutAt).
   * State: 0 = AWAITING_SHIPMENT, 1 = AWAITING_CONFIRMATION, 2 = COMPLETE.
   * Returns 404 if no escrow (buyer is zero).
   */
  router.get("/escrow/:listingId", async (req, res) => {
    const escrowAddr = process.env.ESCROW_ADDRESS;
    const rpcUrl = process.env.HEDERA_RPC_URL;
    if (!escrowAddr || !rpcUrl) {
      return res.status(503).json({ error: "Escrow/RPC not configured" });
    }
    try {
      const rawId = req.params.listingId ?? "";
      const listingIdBytes32 = listingIdToBytes32(rawId);
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const contract = new ethers.Contract(escrowAddr, ESCROW_ABI_VIEW, provider);
      const data = await contract.escrows(listingIdBytes32);
      const [buyer, seller, amount, createdAt, timeoutAt, stateNum] = data;
      if (!buyer || buyer === ethers.ZeroAddress) {
        return res.status(404).json({ error: "No escrow for this listing" });
      }
      const stateNames = ["AWAITING_SHIPMENT", "AWAITING_CONFIRMATION", "COMPLETE"];
      res.json({
        buyer: buyer.toLowerCase(),
        seller: seller.toLowerCase(),
        amount: amount.toString(),
        createdAt: Number(createdAt),
        timeoutAt: Number(timeoutAt),
        state: stateNames[Number(stateNum)] ?? "UNKNOWN",
      });
    } catch (err) {
      log.error({ err }, "Failed to fetch escrow");
      res.status(500).json({ error: "Internal server error" });
    }
  });

  router.patch("/listing/:id", async (req, res) => {
    try {
      const id = normalizeListingId(req.params.id ?? "");
      const { title, subtitle, description, category, condition, yearOfProduction, imageUrl, mediaUrls, sellerAddress } = (req.body || {}) as {
        title?: string;
        subtitle?: string;
        description?: string;
        category?: string;
        condition?: string;
        yearOfProduction?: string;
        imageUrl?: string;
        mediaUrls?: string[];
        sellerAddress?: string;
      };
      const listing = await prisma.listing.findUnique({ where: { id } });
      if (!listing) return res.status(404).json({ error: "Listing not found" });
      const sellerLower = sellerAddress && typeof sellerAddress === "string" ? sellerAddress.toLowerCase() : "";
      if (sellerLower !== listing.seller.toLowerCase()) {
        return res.status(403).json({ error: "Only the seller can edit this listing" });
      }
      const update: { title?: string | null; subtitle?: string | null; description?: string | null; category?: string | null; condition?: string | null; yearOfProduction?: string | null; price?: string; imageUrl?: string | null; mediaUrls?: string[] } = {};
      if (title !== undefined) update.title = title === "" ? null : title;
      if (subtitle !== undefined) update.subtitle = subtitle === "" ? null : subtitle;
      if (description !== undefined) update.description = description === "" ? null : description;
      if (category !== undefined) update.category = category === "" ? null : category;
      if (condition !== undefined) update.condition = condition === "" ? null : condition;
      if (yearOfProduction !== undefined) update.yearOfProduction = yearOfProduction === "" ? null : yearOfProduction;
      // Intentionally ignore direct price writes here.
      // Listing price must be synced from on-chain events/tx-sync endpoints only.
      if (mediaUrls !== undefined && Array.isArray(mediaUrls)) {
        update.mediaUrls = mediaUrls.filter((u): u is string => typeof u === "string" && u.length > 0);
      } else if (imageUrl !== undefined && imageUrl !== "") {
        const record = listing as { imageUrl?: string | null; mediaUrls?: string[] };
        const existing =
          record.mediaUrls && record.mediaUrls.length > 0
            ? record.mediaUrls
            : record.imageUrl
              ? [record.imageUrl]
              : [];
        update.mediaUrls = [...existing, imageUrl];
      }
      const updated = await prisma.listing.update({
        where: { id },
        data: update,
      });
      res.json({ listing: updated });
    } catch (err) {
      log.error({ err }, "Failed to update listing");
      res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
    }
  });

  router.get("/auction/:id", async (req, res) => {
    try {
      const id = normalizeListingId(req.params.id ?? "");
      const auction = await prisma.auction.findUnique({
        where: { id },
        include: { bids: { orderBy: { createdAt: "desc" }, take: 20 } },
      });
      if (!auction) return res.status(404).json({ error: "Auction not found" });
      res.json({
        auction: {
          ...auction,
          reservePrice: toHbarForClient(auction.reservePrice),
        },
      });
    } catch (err) {
      log.error({ err }, "Failed to fetch auction");
      res.status(500).json({ error: "Internal server error" });
    }
  });

  router.patch("/auction/:id", async (req, res) => {
    try {
      const id = normalizeListingId(req.params.id ?? "");
      const { title, subtitle, description, condition, yearOfProduction, imageUrl, mediaUrls, sellerAddress } = (req.body || {}) as {
        title?: string;
        subtitle?: string;
        description?: string;
        condition?: string;
        yearOfProduction?: string;
        imageUrl?: string;
        mediaUrls?: string[];
        sellerAddress?: string;
      };
      const auction = await prisma.auction.findUnique({ where: { id } });
      if (!auction) return res.status(404).json({ error: "Auction not found" });
      const sellerLower = sellerAddress && typeof sellerAddress === "string" ? sellerAddress.toLowerCase() : "";
      if (sellerLower !== auction.seller.toLowerCase()) {
        return res.status(403).json({ error: "Only the seller can edit this auction" });
      }
      const update: { title?: string | null; subtitle?: string | null; description?: string | null; condition?: string | null; yearOfProduction?: string | null; imageUrl?: string | null; mediaUrls?: string[] } = {};
      if (title !== undefined) update.title = title === "" ? null : title;
      if (subtitle !== undefined) update.subtitle = subtitle === "" ? null : subtitle;
      if (description !== undefined) update.description = description === "" ? null : description;
      if (condition !== undefined) update.condition = condition === "" ? null : condition;
      if (yearOfProduction !== undefined) update.yearOfProduction = yearOfProduction === "" ? null : yearOfProduction;
      if (mediaUrls !== undefined && Array.isArray(mediaUrls)) {
        update.mediaUrls = mediaUrls.filter((u): u is string => typeof u === "string" && u.length > 0);
      } else if (imageUrl !== undefined && imageUrl !== "") {
        const a = auction as { mediaUrls?: string[]; imageUrl?: string | null };
        const existing = a.mediaUrls?.length ? a.mediaUrls : a.imageUrl ? [a.imageUrl] : [];
        update.mediaUrls = [...existing, imageUrl];
      }
      const updated = await prisma.auction.update({
        where: { id },
        data: update,
      });
      res.json({ auction: updated });
    } catch (err) {
      log.error({ err }, "Failed to update auction");
      res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
    }
  });

  router.get("/user/:address/listings", async (req, res) => {
    try {
      const { address } = req.params;
      const addrLower = address?.toLowerCase() ?? "";
      const [activeListings, archivedListings, activeAuctions, archivedAuctions] = await Promise.all([
        prisma.listing.findMany({
          where: { seller: addrLower, status: "LISTED" },
          orderBy: { createdAt: "desc" },
        }),
        prisma.listing.findMany({
          where: {
            seller: addrLower,
            status: { in: ["CANCELLED", "LOCKED", "COMPLETED"] },
          },
          orderBy: { updatedAt: "desc" },
        }),
        prisma.auction.findMany({
          where: { seller: addrLower, status: "ACTIVE" },
          orderBy: { createdAt: "desc" },
        }),
        prisma.auction.findMany({
          where: {
            seller: addrLower,
            status: { not: "ACTIVE" },
          },
          orderBy: { updatedAt: "desc" },
        }),
      ]);
      res.json({
        active: activeListings.map((l) => ({ ...l, price: toHbarForClient(l.price), itemType: "listing" as const })),
        archived: archivedListings.map((l) => ({ ...l, price: toHbarForClient(l.price), itemType: "listing" as const })),
        activeAuctions: activeAuctions.map((a) => ({ ...a, reservePrice: toHbarForClient(a.reservePrice) })),
        archivedAuctions: archivedAuctions.map((a) => ({ ...a, reservePrice: toHbarForClient(a.reservePrice) })),
      });
    } catch (err) {
      log.error({ err }, "Failed to fetch user listings");
      res.status(500).json({ error: "Internal server error" });
    }
  });

  router.get("/wishlist", async (req, res) => {
    try {
      const address = (req.query.address as string)?.trim()?.toLowerCase();
      if (!address) return res.status(400).json({ error: "address required" });
      const items = await prisma.wishlistItem.findMany({
        where: { userAddress: address },
        orderBy: { createdAt: "desc" },
      });
      res.json({ items });
    } catch (err) {
      log.error({ err }, "Failed to fetch wishlist");
      res.status(500).json({ error: "Internal server error" });
    }
  });

  router.post("/wishlist", async (req, res) => {
    try {
      const { address, itemId, itemType } = (req.body || {}) as {
        address?: string;
        itemId?: string;
        itemType?: string;
      };
      const userAddress = address?.trim()?.toLowerCase();
      const id = itemId?.trim();
      const type = itemType === "auction" ? "auction" : "listing";
      if (!userAddress || !id) return res.status(400).json({ error: "address and itemId required" });
      await prisma.wishlistItem.upsert({
        where: {
          userAddress_itemId: { userAddress, itemId: id },
        },
        create: { userAddress, itemId: id, itemType: type },
        update: {},
      });
      res.json({ ok: true });
    } catch (err) {
      log.error({ err }, "Failed to add wishlist");
      res.status(500).json({ error: "Internal server error" });
    }
  });

  router.delete("/wishlist", async (req, res) => {
    try {
      const address = (req.query.address as string)?.trim()?.toLowerCase();
      const itemId = (req.query.itemId as string)?.trim();
      if (!address || !itemId) return res.status(400).json({ error: "address and itemId required" });
      await prisma.wishlistItem.deleteMany({
        where: { userAddress: address, itemId },
      });
      res.json({ ok: true });
    } catch (err) {
      log.error({ err }, "Failed to remove wishlist");
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
        where: { id: addrLower },
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

  router.post("/messages", async (req, res) => {
    try {
      const { fromAddress, toAddress, body, listingId } = (req.body || {}) as {
        fromAddress?: string;
        toAddress?: string;
        body?: string;
        listingId?: string;
      };
      const from = fromAddress?.trim().toLowerCase();
      const to = toAddress?.trim().toLowerCase();
      const text = typeof body === "string" ? body.trim() : "";
      if (!from || !to) return res.status(400).json({ error: "fromAddress and toAddress required" });
      if (!text) return res.status(400).json({ error: "body required" });
      const msg = await prisma.message.create({
        data: {
          fromAddress: from,
          toAddress: to,
          body: text,
          listingId: listingId?.trim() || null,
        },
      });
      const topicId = deriveMessageTopicId(from, to, listingId?.trim() || null);
      res.status(201).json({ message: msg, topicId });
    } catch (err) {
      log.error({ err }, "Failed to create message");
      res.status(500).json({ error: "Internal server error" });
    }
  });

  router.get("/messages/inbox", async (req, res) => {
    try {
      const address = (req.query.address as string)?.trim()?.toLowerCase();
      if (!address) return res.status(400).json({ error: "address required" });
      const messages = await prisma.message.findMany({
        where: { OR: [{ fromAddress: address }, { toAddress: address }] },
        orderBy: { createdAt: "desc" },
      });
      const seen = new Map<string, { last: typeof messages[0]; preview: string }>();
      for (const m of messages) {
        const other = m.fromAddress === address ? m.toAddress : m.fromAddress;
        const key = `${other}-${m.listingId ?? ""}`;
        if (!seen.has(key)) seen.set(key, { last: m, preview: m.body.slice(0, 80) });
      }
      const conversations = Array.from(seen.entries()).map(([key, v]) => {
        const dash = key.indexOf("-");
        const otherAddress = dash >= 0 ? key.slice(0, dash) : key;
        const listingId = dash >= 0 ? key.slice(dash + 1) || null : null;
        return {
          otherAddress,
          listingId,
          topicId: deriveMessageTopicId(address, otherAddress, listingId),
          lastMessage: v.last,
          preview: v.preview,
        };
      });
      const sorted = conversations.sort(
        (a, b) => new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime()
      );
      res.json({ conversations: sorted });
    } catch (err) {
      log.error({ err }, "Failed to fetch inbox");
      res.status(500).json({ error: "Internal server error" });
    }
  });

  router.get("/messages/thread", async (req, res) => {
    try {
      const address = (req.query.address as string)?.trim()?.toLowerCase();
      const other = (req.query.other as string)?.trim()?.toLowerCase();
      const listingId = (req.query.listingId as string)?.trim() || undefined;
      if (!address || !other) return res.status(400).json({ error: "address and other required" });
      const where = {
        OR: [
          { fromAddress: address, toAddress: other },
          { fromAddress: other, toAddress: address },
        ],
        ...(listingId && { listingId }),
      };
      const messages = await prisma.message.findMany({
        where,
        orderBy: { createdAt: "asc" },
      });
      res.json({ messages, topicId: deriveMessageTopicId(address, other, listingId ?? null) });
    } catch (err) {
      log.error({ err }, "Failed to fetch thread");
      res.status(500).json({ error: "Internal server error" });
    }
  });

  router.post("/ratings", async (req, res) => {
    try {
      const {
        reviewerAddress,
        ratedAddress,
        saleId,
        listingId,
        auctionId,
        score,
        comment,
        signature,
      } = (req.body || {}) as {
        reviewerAddress?: string;
        ratedAddress?: string;
        saleId?: string;
        listingId?: string;
        auctionId?: string;
        score?: number;
        comment?: string;
        signature?: string;
      };

      const reviewer = reviewerAddress?.trim().toLowerCase();
      const rated = ratedAddress?.trim().toLowerCase();
      const saleRef = saleId?.trim();
      const ratingScore = Number(score);
      if (!reviewer || !rated || !saleRef) {
        return res.status(400).json({ error: "reviewerAddress, ratedAddress, and saleId are required" });
      }
      if (reviewer === rated) {
        return res.status(400).json({ error: "Cannot rate yourself" });
      }
      if (!Number.isInteger(ratingScore) || ratingScore < 1 || ratingScore > 5) {
        return res.status(400).json({ error: "score must be an integer between 1 and 5" });
      }
      if (!signature || typeof signature !== "string") {
        return res.status(400).json({ error: "signature is required" });
      }

      const message = `hashmart.rate:${saleRef}:${rated}:${ratingScore}`;
      let recovered = "";
      try {
        recovered = ethers.verifyMessage(message, signature).toLowerCase();
      } catch {
        return res.status(400).json({ error: "Invalid signature format" });
      }
      if (recovered !== reviewer) {
        return res.status(401).json({ error: "Signature does not match reviewerAddress" });
      }

      const sale = await prisma.sale.findUnique({ where: { id: saleRef } });
      if (!sale) return res.status(404).json({ error: "Sale not found" });
      const participants = [sale.buyer.toLowerCase(), sale.seller.toLowerCase()];
      if (!participants.includes(reviewer) || !participants.includes(rated)) {
        return res.status(403).json({ error: "Only sale participants can rate each other" });
      }

      if (sale.listingId) {
        const listing = await prisma.listing.findUnique({ where: { id: sale.listingId } });
        if (!listing || listing.status !== "COMPLETED") {
          return res.status(409).json({ error: "Rating allowed only after listing completion" });
        }
      }
      if (sale.auctionId) {
        const auction = await prisma.auction.findUnique({ where: { id: sale.auctionId } });
        if (!auction || auction.status !== "SETTLED") {
          return res.status(409).json({ error: "Rating allowed only after auction settlement" });
        }
      }

      const created = await prisma.rating.create({
        data: {
          reviewerAddress: reviewer,
          ratedAddress: rated,
          saleId: saleRef,
          listingId: listingId?.trim() || sale.listingId || null,
          auctionId: auctionId?.trim() || sale.auctionId || null,
          score: ratingScore,
          comment: typeof comment === "string" && comment.trim() ? comment.trim() : null,
        },
      });
      return res.status(201).json({ rating: created });
    } catch (err: any) {
      if (err?.code === "P2002") {
        return res.status(409).json({ error: "You already submitted a rating for this sale" });
      }
      log.error({ err }, "Failed to create rating");
      return res.status(500).json({ error: err?.message || "Internal server error" });
    }
  });

  router.get("/ratings/:address", async (req, res) => {
    try {
      const address = req.params.address?.toLowerCase() || "";
      if (!address) return res.status(400).json({ error: "address required" });
      const [count, avg, latest] = await Promise.all([
        prisma.rating.count({ where: { ratedAddress: address } }),
        prisma.rating.aggregate({
          where: { ratedAddress: address },
          _avg: { score: true },
        }),
        prisma.rating.findMany({
          where: { ratedAddress: address },
          orderBy: { createdAt: "desc" },
          take: 10,
        }),
      ]);
      res.json({
        count,
        averageScore: avg._avg.score ?? null,
        ratings: latest,
      });
    } catch (err) {
      log.error({ err }, "Failed to fetch ratings");
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

      const [activeListings, totalSalesFromSales, ratingAgg] = await Promise.all([
        prisma.listing.count({
          where: { status: "LISTED", seller: addrLower },
        }),
        prisma.sale.count({
          where: { seller: addrLower },
        }),
        prisma.rating.aggregate({
          where: { ratedAddress: addrLower },
          _count: { _all: true },
          _avg: { score: true },
        }),
      ]);

      if (!user) {
        return res.json({
          address,
          totalSales: totalSalesFromSales,
          activeListings,
          reputation: "N/A",
          ratingCount: ratingAgg._count._all ?? 0,
          ratingAverage: ratingAgg._avg.score ?? null,
        });
      }

      res.json({
        address: user.address,
        totalSales: user.totalSales ?? totalSalesFromSales,
        activeListings,
        reputation: user.reputationScore,
        successful: user.successfulCompletions,
        ratingCount: ratingAgg._count._all ?? 0,
        ratingAverage: ratingAgg._avg.score ?? null,
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

  router.delete("/debug/clear-listings", async (req, res) => {
    try {
      await prisma.sale.deleteMany({});
      const result = await prisma.listing.deleteMany({});
      log.info({ deleted: result.count }, "Cleared all listings (and sales)");
      return res.json({ ok: true, deleted: result.count });
    } catch (err: any) {
      log.error({ err }, "Clear listings failed");
      return res.status(500).json({ error: err.message });
    }
  });

  return router;
}
