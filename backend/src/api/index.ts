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
const MAX_MEDIA_SIZE = 15 * 1024 * 1024; // 15MB for video

function normalizeListingId(id: string): string {
  if (!id || typeof id !== "string") return id;
  const hex = id.startsWith("0x") ? id.slice(2) : id;
  return "0x" + hex.toLowerCase();
}

function normalizeWalletAddress(address?: string | null): string {
  return String(address || "")
    .trim()
    .toLowerCase();
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

/** Tinybar (8 decimals) to HBAR string for storage/display. */
function tinybarToHbar(tinybar: bigint | string): string {
  const tb = typeof tinybar === "string" ? BigInt(tinybar) : tinybar;
  if (tb === 0n) return "0";
  const div = 10n ** 8n;
  const whole = tb / div;
  const frac = tb % div;
  const fracStr = frac.toString().padStart(8, "0").replace(/0+$/, "") || "0";
  return fracStr === "0" ? whole.toString() : `${whole}.${fracStr}`;
}

/** Convert on-chain amount to HBAR (supports legacy wei and current tinybar units). */
function chainAmountToHbar(amount: bigint | string): string {
  const n = typeof amount === "string" ? BigInt(amount) : amount;
  if (n >= 10n ** 15n) return weiToHbar(n);
  return tinybarToHbar(n);
}

/** If value looks like wei (long digit string), convert to HBAR; else return as-is. */
function toHbarForClient(value: string | null | undefined): string {
  if (value == null || value === "") return "";
  const s = String(value).trim();
  if (/^\d+$/.test(s)) {
    const n = BigInt(s);
    if (n >= 10n ** 15n) return weiToHbar(n);
    if (s.length > 8) return tinybarToHbar(n);
  }
  return s;
}

function isUsableContractAddress(address: string | undefined): address is string {
  return !!address && /^0x[0-9a-fA-F]{40}$/.test(address) && !/^0x0{40}$/i.test(address);
}

const s3PublicBase = process.env.S3_PUBLIC_URL?.replace(/\/$/, "") ?? "";
const listingReportWebhookUrl = process.env.DISCORD_REPORT_WEBHOOK_URL?.trim() ?? "";
const listingReportMentionRoleId = process.env.DISCORD_REPORT_MENTION_ROLE_ID?.trim() ?? "";
const REPORT_WINDOW_MS = 10 * 60 * 1000;
const REPORT_MAX_PER_WINDOW = 5;
const listingReportRate = new Map<string, number[]>();

function rewriteMediaUrlForClient(url: string | null | undefined): string | null | undefined {
  if (!url || !s3PublicBase) return url;
  const m = url.match(
    /^https?:\/\/(?:localhost|127\.0\.0\.1):4000\/uploads\/([^?#]+)(?:[?#].*)?$/i,
  );
  if (!m?.[1]) return url;
  return `${s3PublicBase}/uploads/${m[1]}`;
}

function rewriteMediaUrlsForClient(urls: string[] | null | undefined): string[] | undefined {
  if (!Array.isArray(urls)) return undefined;
  return urls.map((u) => rewriteMediaUrlForClient(u) ?? u);
}

function isReportRateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (listingReportRate.get(key) ?? []).filter((ts) => now - ts < REPORT_WINDOW_MS);
  if (recent.length >= REPORT_MAX_PER_WINDOW) {
    listingReportRate.set(key, recent);
    return true;
  }
  recent.push(now);
  listingReportRate.set(key, recent);
  return false;
}

const ESCROW_ABI_VIEW = [
  "function escrows(bytes32) view returns (address buyer, address seller, uint256 amount, uint256 createdAt, uint256 timeoutAt, uint8 state)",
];
const MARKETPLACE_LISTINGS_VIEW_V2 =
  "function listings(bytes32) view returns (address seller, uint256 price, uint256 createdAt, uint8 status, bytes32 escrowId, bool requireEscrow)";
const MARKETPLACE_LISTINGS_VIEW_V1 =
  "function listings(bytes32) view returns (address seller, uint256 price, uint256 createdAt, uint8 status, bytes32 escrowId)";

type MarketplaceListingView = {
  seller: string;
  price: bigint;
  status: number;
};

async function readMarketplaceListingCompat(
  provider: ethers.JsonRpcProvider,
  marketplaceAddr: string,
  listingId: string,
): Promise<MarketplaceListingView> {
  const ifaceV2 = new ethers.Interface([MARKETPLACE_LISTINGS_VIEW_V2]);
  const ifaceV1 = new ethers.Interface([MARKETPLACE_LISTINGS_VIEW_V1]);
  const calldata = ifaceV2.encodeFunctionData("listings", [listingId]);
  const raw = await provider.call({
    to: marketplaceAddr,
    data: calldata,
  });

  try {
    const out = ifaceV2.decodeFunctionResult("listings", raw);
    return {
      seller: String(out[0]),
      price: BigInt(out[1]?.toString?.() ?? "0"),
      status: Number(out[3] ?? 0),
    };
  } catch {
    const out = ifaceV1.decodeFunctionResult("listings", raw);
    return {
      seller: String(out[0]),
      price: BigInt(out[1]?.toString?.() ?? "0"),
      status: Number(out[3] ?? 0),
    };
  }
}

function imageFilename(originalname: string): string {
  const ext = (path.extname(originalname) || ".jpg").toLowerCase().slice(0, 5);
  const safe = /^\.(jpe?g|png|gif|webp)$/.test(ext) ? ext : ".jpg";
  return `listing-${Date.now()}-${Math.random().toString(36).slice(2, 10)}${safe}`;
}

function avatarFilename(originalname: string): string {
  const ext = (path.extname(originalname) || ".jpg").toLowerCase().slice(0, 5);
  const safe = /^\.(jpe?g|png|gif|webp)$/.test(ext) ? ext : ".jpg";
  return `avatar-${Date.now()}-${Math.random().toString(36).slice(2, 10)}${safe}`;
}

function mediaFilename(originalname: string): string {
  const ext = (path.extname(originalname) || ".jpg").toLowerCase().slice(0, 8);
  const safe = /^\.(jpe?g|png|gif|webp|mp4|webm|mov)$/.test(ext) ? ext : ".bin";
  return `listing-${Date.now()}-${Math.random().toString(36).slice(2, 10)}${safe}`;
}

const memoryStorage = multer.memoryStorage();

export function apiRouter(prisma: PrismaClient, log: Logger, uploadsDir: string): Router {
  const router = Router();

  async function createSaleIfMissing(params: {
    listingId: string;
    buyer: string;
    seller: string;
    amount: string;
    txHash?: string;
  }): Promise<void> {
    const listingId = normalizeListingId(params.listingId);
    const buyer = normalizeWalletAddress(params.buyer);
    const seller = normalizeWalletAddress(params.seller);
    const amount = String(params.amount || "0");
    if (!listingId || !buyer || !seller || buyer === seller) return;

    const recentWindowStart = new Date(Date.now() - 5 * 60 * 1000);
    const existing = await prisma.sale.findFirst({
      where: {
        listingId,
        buyer,
        seller,
        amount,
        createdAt: { gte: recentWindowStart },
      },
      select: { id: true },
    });
    if (existing) return;

    await prisma.sale.create({
      data: {
        id: `sale-${Date.now()}-${listingId}`,
        listingId,
        buyer,
        seller,
        amount,
        ...(params.txHash && { txHash: params.txHash }),
      },
    });
  }

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
      const ok =
        /^image\/(jpeg|jpg|png|gif|webp)$/i.test(file.mimetype) ||
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
          if (err.code === "LIMIT_FILE_SIZE")
            return res.status(400).json({ error: "Image must be 2MB or smaller" });
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
          uploadsDir,
        );
        res.json({ imageUrl });
      } catch (e: any) {
        log.error({ err: e }, "Upload handler error");
        res.status(500).json({ error: e?.message || "Internal server error" });
      }
    });
  });

  // Top-level avatar upload route (mirrors /user/upload-avatar but avoids nested path routing issues)
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
        const filename = avatarFilename(req.file.originalname);
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
            return res.status(400).json({ error: "File must be 15MB or smaller" });
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
          uploadsDir,
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
      const listings = await prisma.listing.findMany({
        where: { status: "LISTED" },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      let auctions: Awaited<ReturnType<typeof prisma.auction.findMany>> = [];
      try {
        auctions = await prisma.auction.findMany({
          where: { status: "ACTIVE" },
          orderBy: { createdAt: "desc" },
          take: 50,
        });
      } catch (auctionErr) {
        log.warn({ err: auctionErr }, "Could not fetch auctions (table may not exist yet)");
      }
      let listingPriceOverrides = new Map<string, string>();
      let listingStatusOverrides = new Map<string, string>();
      const marketplaceAddr = process.env.MARKETPLACE_ADDRESS;
      const rpcUrl = process.env.HEDERA_RPC_URL;
      if (isUsableContractAddress(marketplaceAddr) && rpcUrl && listings.length > 0) {
        try {
          const provider = new ethers.JsonRpcProvider(rpcUrl);
          const overrides = await Promise.all(
            listings.map(async (l) => {
              try {
                const data = await readMarketplaceListingCompat(provider, marketplaceAddr, l.id);
                const priceStr = data.price.toString();
                const statusNum = Number(data.status);
                const hasSeller = data.seller && data.seller !== ethers.ZeroAddress;
                const chainAmount = BigInt(priceStr || "0");
                const statusText =
                  statusNum === 1
                    ? "LISTED"
                    : statusNum === 2
                      ? "LOCKED"
                      : statusNum === 3
                        ? "SOLD"
                        : statusNum === 4
                          ? "CANCELLED"
                          : null;
                if (priceStr && priceStr !== "0" && hasSeller && chainAmount > 0n) {
                  return [l.id, chainAmountToHbar(priceStr), statusText] as const;
                }
                return [l.id, null, statusText] as const;
              } catch {
                // ignore per-listing on-chain read errors
              }
              return null;
            }),
          );
          const pricePairs: Array<[string, string]> = [];
          const statusPairs: Array<[string, string]> = [];
          for (const o of overrides as Array<
            readonly [string, string | null, string | null] | null
          >) {
            if (!o) continue;
            if (o[1] != null) pricePairs.push([o[0], o[1]]);
            if (o[2] != null) statusPairs.push([o[0], o[2]]);
          }
          listingPriceOverrides = new Map(pricePairs);
          listingStatusOverrides = new Map(statusPairs);
        } catch (e) {
          log.warn({ err: e }, "Could not read on-chain listing prices for /listings");
        }
      }
      res.json({
        listings: listings.map((l) => ({
          ...l,
          imageUrl: rewriteMediaUrlForClient(l.imageUrl),
          mediaUrls: rewriteMediaUrlsForClient((l as any).mediaUrls) ?? (l as any).mediaUrls,
          status: listingStatusOverrides.get(l.id) ?? l.status,
          price: listingPriceOverrides.get(l.id) ?? toHbarForClient(l.price),
        })),
        auctions: auctions.map((a) => ({
          ...a,
          imageUrl: rewriteMediaUrlForClient(a.imageUrl),
          mediaUrls: rewriteMediaUrlsForClient((a as any).mediaUrls) ?? (a as any).mediaUrls,
          reservePrice: toHbarForClient(a.reservePrice),
        })),
      });
    } catch (err: unknown) {
      log.error({ err }, "Failed to fetch listings");
      const code =
        err && typeof err === "object" && "code" in err
          ? (err as { code?: string }).code
          : undefined;
      const message =
        err && typeof err === "object" && "message" in err ? String((err as Error).message) : "";
      const isTlsError =
        message.includes("SSL") ||
        message.includes("TLS") ||
        message.includes("certificate") ||
        message.includes("self signed") ||
        (code && String(code).startsWith("ERR_TLS"));
      if (code === "ECONNREFUSED" || message.includes("connect") || isTlsError) {
        res.status(503).json({
          error:
            "Database unavailable. Start PostgreSQL (e.g. docker compose up -d db) and run backend migrations.",
        });
        return;
      }
      res.status(500).json({ error: `Internal server error: ${message || String(err)}` });
    }
  });

  /**
   * Sync a listing from a createListing transaction.
   * Call this after the frontend tx confirms so the listing shows immediately
   * without waiting for the indexer (Mirror/RPC can be slow or limited on Hedera).
   */
  router.post("/sync-listing", async (req, res) => {
    const {
      txHash,
      listingId,
      seller,
      price,
      requireEscrow,
      imageUrl,
      mediaUrls,
      title,
      subtitle,
      description,
      category,
      condition,
      yearOfProduction,
      location,
    } = (req.body || {}) as {
      txHash?: string;
      listingId?: string;
      seller?: string;
      price?: string;
      requireEscrow?: boolean;
      imageUrl?: string;
      mediaUrls?: string[];
      title?: string;
      subtitle?: string;
      description?: string;
      category?: string;
      condition?: string;
      yearOfProduction?: string;
      location?: string;
    };
    const fallbackListingId =
      typeof listingId === "string" && listingId.trim()
        ? normalizeListingId(listingId.trim())
        : null;
    const fallbackSeller =
      typeof seller === "string" && /^0x[0-9a-fA-F]{40}$/.test(seller.trim())
        ? seller.trim().toLowerCase()
        : null;
    const fallbackPrice = typeof price === "string" && price.trim() ? price.trim() : null;
    const canFallbackUpsert = !!(fallbackListingId && fallbackSeller && fallbackPrice);

    const imageUrlStr = typeof imageUrl === "string" && imageUrl ? imageUrl : null;
    const mediaList =
      Array.isArray(mediaUrls) && mediaUrls.length > 0
        ? mediaUrls.filter((u): u is string => typeof u === "string" && u.length > 0)
        : imageUrlStr
          ? [imageUrlStr]
          : [];
    const titleStr = typeof title === "string" && title.trim() ? title.trim() : null;
    const subtitleStr = typeof subtitle === "string" && subtitle.trim() ? subtitle.trim() : null;
    const descriptionStr =
      typeof description === "string" && description.trim() ? description.trim() : null;
    const categoryStr = typeof category === "string" && category.trim() ? category.trim() : null;
    const conditionStr =
      typeof condition === "string" && condition.trim() ? condition.trim() : null;
    const yearStr =
      typeof yearOfProduction === "string" && yearOfProduction.trim()
        ? yearOfProduction.trim()
        : null;
    const locationStr =
      typeof location === "string" && location.trim() ? location.trim() : null;
    const requireEscrowBool = !!requireEscrow;

    const upsertFallbackListing = async () => {
      if (!canFallbackUpsert) return null;
      const txHashStr = typeof txHash === "string" && txHash.trim() ? txHash.trim() : null;
      // If the wallet returned a txHash the transaction was accepted by the network.
      // Mark confirmed so the listing is immediately visible; the indexer will
      // re-confirm and correct the price once it picks up the mirror node event.
      const confirmedByTxHash = !!txHashStr;
      const fallbackUpdateData: any = {
        status: "LISTED",
        price: fallbackPrice!,
        requireEscrow: requireEscrowBool,
        ...(confirmedByTxHash && { onChainConfirmed: true }),
        ...(txHashStr != null && { txHash: txHashStr }),
        ...(imageUrlStr != null && { imageUrl: imageUrlStr }),
        ...(mediaList.length > 0 && { mediaUrls: mediaList }),
        ...(titleStr != null && { title: titleStr }),
        ...(subtitleStr != null && { subtitle: subtitleStr }),
        ...(descriptionStr != null && { description: descriptionStr }),
        ...(categoryStr != null && { category: categoryStr }),
        ...(conditionStr != null && { condition: conditionStr }),
        ...(yearStr != null && { yearOfProduction: yearStr }),
        ...(locationStr != null && { location: locationStr }),
      };
      const fallbackCreateData: any = {
        id: fallbackListingId!,
        seller: fallbackSeller!,
        price: fallbackPrice!,
        status: "LISTED",
        requireEscrow: requireEscrowBool,
        onChainConfirmed: confirmedByTxHash,
        ...(txHashStr != null && { txHash: txHashStr }),
        ...(imageUrlStr != null && { imageUrl: imageUrlStr }),
        ...(mediaList.length > 0 && { mediaUrls: mediaList }),
        ...(titleStr != null && { title: titleStr }),
        ...(subtitleStr != null && { subtitle: subtitleStr }),
        ...(descriptionStr != null && { description: descriptionStr }),
        ...(categoryStr != null && { category: categoryStr }),
        ...(conditionStr != null && { condition: conditionStr }),
        ...(yearStr != null && { yearOfProduction: yearStr }),
        ...(locationStr != null && { location: locationStr }),
      };
      await prisma.listing.upsert({
        where: { id: fallbackListingId! },
        update: fallbackUpdateData,
        create: fallbackCreateData,
      });
      log.info(
        { listingId: fallbackListingId, seller: fallbackSeller, txHash, confirmedByTxHash },
        "Synced listing via fallback upsert",
      );
      return fallbackListingId;
    };

    if (!txHash || typeof txHash !== "string") {
      if (canFallbackUpsert) {
        const id = await upsertFallbackListing();
        return res.json({ ok: true, listingId: id, source: "fallback" });
      }
      return res.status(400).json({ error: "txHash required" });
    }
    const rpcUrl = process.env.HEDERA_RPC_URL;
    if (!rpcUrl) {
      if (canFallbackUpsert) {
        const id = await upsertFallbackListing();
        return res.json({ ok: true, listingId: id, source: "fallback" });
      }
      return res.status(503).json({ error: "HEDERA_RPC_URL not set" });
    }

    /**
     * HashPack/HashConnect SDK returns Hedera-format transaction IDs
     * (e.g. "0.0.12345@1609459200.000000000"), not EVM 0x hashes.
     * ethers.getTransactionReceipt() can't handle that format, so we resolve
     * the EVM hash via the mirror node first when the txHash looks like a
     * Hedera transaction ID.
     */
    const isHederaTxId = /^\d+\.\d+\.\d+@\d+\.\d+/.test(txHash);
    let evmTxHash: string = txHash;

    if (isHederaTxId) {
      try {
        const mirrorBase = process.env.MIRROR_URL || "https://testnet.mirrornode.hedera.com";
        // Mirror node format: replace @ with - and all dots with -
        // e.g. 0.0.12345@1609459200.123456789 → 0-0-12345-1609459200-123456789
        const mirrorTxId = txHash.replace("@", "-").replace(/\./g, "-");
        const mirrorRes = await fetch(`${mirrorBase}/api/v1/transactions/${mirrorTxId}`);
        if (mirrorRes.ok) {
          const mirrorData = (await mirrorRes.json()) as {
            transactions?: { ethereum_hash?: string; result?: string }[];
          };
          const mirrorTx = mirrorData?.transactions?.[0];
          if (mirrorTx?.result && mirrorTx.result !== "SUCCESS") {
            // Transaction was submitted but reverted — do not confirm the listing.
            log.warn(
              { txHash, result: mirrorTx.result },
              "Hedera tx was not successful; skipping sync",
            );
            if (canFallbackUpsert) {
              const id = await upsertFallbackListing();
              return res.json({ ok: true, listingId: id, source: "fallback" });
            }
            return res
              .status(400)
              .json({ error: `Transaction failed on-chain: ${mirrorTx.result}` });
          }
          if (mirrorTx?.ethereum_hash) {
            evmTxHash = mirrorTx.ethereum_hash.startsWith("0x")
              ? mirrorTx.ethereum_hash
              : `0x${mirrorTx.ethereum_hash}`;
            log.info({ hederaTxId: txHash, evmTxHash }, "Resolved Hedera tx ID to EVM hash");
          }
        }
      } catch (mirrorErr) {
        log.warn(
          { err: mirrorErr, txHash },
          "Mirror node lookup failed; proceeding with RPC fallback",
        );
      }
    }

    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const receipt = await provider.getTransactionReceipt(evmTxHash);
      if (!receipt || !receipt.logs?.length) {
        if (canFallbackUpsert) {
          const id = await upsertFallbackListing();
          return res.json({ ok: true, listingId: id, source: "fallback" });
        }
        return res.status(404).json({ error: "Transaction or logs not found" });
      }
      for (const logEntry of receipt.logs) {
        const decoded = decodeEvents(logEntry);
        if (decoded?.type !== "ItemListed") continue;
        const listingId = normalizeListingId(decoded.listingId);
        const seller = (decoded.seller || "").toLowerCase();
        const priceHbar = chainAmountToHbar(decoded.price);
        const updateData: any = {
          status: "LISTED",
          price: priceHbar,
          requireEscrow: requireEscrowBool,
          onChainConfirmed: true,
          txHash: evmTxHash,
          ...(imageUrlStr != null && { imageUrl: imageUrlStr }),
          ...(mediaList.length > 0 && { mediaUrls: mediaList }),
          ...(titleStr != null && { title: titleStr }),
          ...(subtitleStr != null && { subtitle: subtitleStr }),
          ...(descriptionStr != null && { description: descriptionStr }),
          ...(categoryStr != null && { category: categoryStr }),
          ...(conditionStr != null && { condition: conditionStr }),
          ...(yearStr != null && { yearOfProduction: yearStr }),
        };
        const createData: any = {
          id: listingId,
          seller,
          price: priceHbar,
          status: "LISTED",
          requireEscrow: requireEscrowBool,
          onChainConfirmed: true,
          txHash: evmTxHash,
          ...(imageUrlStr != null && { imageUrl: imageUrlStr }),
          ...(mediaList.length > 0 && { mediaUrls: mediaList }),
          ...(titleStr != null && { title: titleStr }),
          ...(subtitleStr != null && { subtitle: subtitleStr }),
          ...(descriptionStr != null && { description: descriptionStr }),
          ...(categoryStr != null && { category: categoryStr }),
          ...(conditionStr != null && { condition: conditionStr }),
          ...(yearStr != null && { yearOfProduction: yearStr }),
        };
        await prisma.listing.upsert({
          where: { id: listingId },
          update: updateData,
          create: createData,
        });
        log.info({ listingId, seller, txHash, evmTxHash }, "Synced listing from tx");
        return res.json({ ok: true, listingId });
      }
      if (canFallbackUpsert) {
        const id = await upsertFallbackListing();
        return res.json({ ok: true, listingId: id, source: "fallback" });
      }
      return res.status(404).json({ error: "No ItemListed event in transaction" });
    } catch (err: any) {
      log.error({ err, txHash }, "Sync listing failed");
      if (canFallbackUpsert) {
        const id = await upsertFallbackListing();
        return res.json({ ok: true, listingId: id, source: "fallback" });
      }
      return res.status(500).json({ error: err.message || "Sync failed" });
    }
  });

  /**
   * Sync a listing price update from tx so the latest on-chain price is reflected immediately.
   */
  router.post("/sync-price-update", async (req, res) => {
    const { txHash, listingId, newPrice } = (req.body || {}) as {
      txHash?: string;
      listingId?: string;
      newPrice?: string;
    };
    const fallbackListingId =
      typeof listingId === "string" && listingId.trim()
        ? normalizeListingId(listingId.trim())
        : null;
    const fallbackPrice = typeof newPrice === "string" && newPrice.trim() ? newPrice.trim() : null;
    const canFallbackUpdate = !!(fallbackListingId && fallbackPrice);

    const applyFallbackPrice = async () => {
      if (!canFallbackUpdate) return false;
      const result = await prisma.listing.updateMany({
        where: { id: fallbackListingId! },
        data: { price: fallbackPrice! },
      });
      if (result.count === 0) return false;
      log.info(
        { listingId: fallbackListingId, txHash },
        "Synced listing price via fallback update",
      );
      return true;
    };

    if (!txHash || typeof txHash !== "string") {
      if (await applyFallbackPrice()) {
        return res.json({
          ok: true,
          listingId: fallbackListingId,
          price: fallbackPrice,
          source: "fallback",
        });
      }
      return res.status(400).json({ error: "txHash required" });
    }
    const rpcUrl = process.env.HEDERA_RPC_URL;
    if (!rpcUrl) {
      if (await applyFallbackPrice()) {
        return res.json({
          ok: true,
          listingId: fallbackListingId,
          price: fallbackPrice,
          source: "fallback",
        });
      }
      return res.status(503).json({ error: "HEDERA_RPC_URL not set" });
    }
    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const receipt = await provider.getTransactionReceipt(txHash);
      if (!receipt?.logs?.length) {
        if (await applyFallbackPrice()) {
          return res.json({
            ok: true,
            listingId: fallbackListingId,
            price: fallbackPrice,
            source: "fallback",
          });
        }
        return res.status(404).json({ error: "Transaction or logs not found" });
      }
      for (const logEntry of receipt.logs) {
        const decoded = decodeEvents(logEntry);
        if (decoded?.type !== "PriceUpdated") continue;
        const listingId = normalizeListingId(decoded.listingId);
        const newPriceHbar = chainAmountToHbar(decoded.newPrice);
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
      if (await applyFallbackPrice()) {
        return res.json({
          ok: true,
          listingId: fallbackListingId,
          price: fallbackPrice,
          source: "fallback",
        });
      }
      return res.status(404).json({ error: "No PriceUpdated event in transaction" });
    } catch (err: any) {
      log.error({ err, txHash }, "Sync price update failed");
      if (await applyFallbackPrice()) {
        return res.json({
          ok: true,
          listingId: fallbackListingId,
          price: fallbackPrice,
          source: "fallback",
        });
      }
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
      // Hedera SDK returns transaction IDs in format "0.0.XXXX@seconds.nanos".
      // JSON-RPC (Hashio) requires the EVM tx hash (0x...64hex).
      // If we receive a Hedera tx ID, resolve the EVM hash via mirror node first.
      let evmTxHash = txHash;
      const isHederaTxId = /^\d+\.\d+\.\d+@\d+\.\d+$/.test(txHash);
      if (isHederaTxId) {
        const network = rpcUrl.includes("mainnet") ? "mainnet" : "testnet";
        const mirrorBase =
          network === "mainnet"
            ? "https://mainnet.mirrornode.hedera.com"
            : "https://testnet.mirrornode.hedera.com";
        // Convert "0.0.XXXX@seconds.nanos" → "0.0.XXXX-seconds-nanos"
        const [accountPart, timePart] = txHash.split("@");
        const mirrorTxId = `${accountPart}-${(timePart || "").replace(".", "-")}`;
        const mirrorRes = await fetch(
          `${mirrorBase}/api/v1/contracts/results/${encodeURIComponent(mirrorTxId)}`,
        );
        if (!mirrorRes.ok) {
          return res.status(404).json({ error: "Transaction not found in mirror node" });
        }
        const mirrorData = (await mirrorRes.json()) as { hash?: string };
        if (!mirrorData.hash) {
          return res.status(404).json({ error: "No EVM hash found for Hedera transaction" });
        }
        evmTxHash = mirrorData.hash;
      }

      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const receipt = await provider.getTransactionReceipt(evmTxHash);
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
        log.info({ listingId, txHash, evmTxHash }, "Synced cancel from tx");
        return res.json({ ok: true, listingId });
      }
      return res.status(404).json({ error: "No ListingCancelled event in transaction" });
    } catch (err: any) {
      log.error({ err, txHash }, "Sync cancel failed");
      return res.status(500).json({ error: err.message || "Sync failed" });
    }
  });

  /**
   * Cancel a listing that was never confirmed on-chain (no blockchain tx needed).
   * Only works when onChainConfirmed is false and the caller is the seller.
   */
  router.post("/listing/:id/cancel-offchain", async (req, res) => {
    const { id } = req.params;
    const { address, force } = (req.body || {}) as { address?: string; force?: boolean };
    const seller = address?.trim()?.toLowerCase();
    if (!seller) return res.status(400).json({ error: "address required" });
    try {
      const listing = await prisma.listing.findUnique({ where: { id } });
      if (!listing) return res.status(404).json({ error: "Listing not found" });
      if (listing.seller?.toLowerCase() !== seller)
        return res.status(403).json({ error: "Not the seller" });
      // Without force=true, block confirmed listings (must cancel via contract).
      // With force=true, the seller explicitly wants the listing removed from the app
      // regardless of on-chain state (e.g. contract was redeployed, tx failed, etc.).
      if (listing.onChainConfirmed && !force)
        return res.status(400).json({ error: "Listing is confirmed on-chain; cancel via contract" });
      if (listing.status === "CANCELLED")
        return res.json({ ok: true }); // already done
      await prisma.listing.update({
        where: { id },
        data: { status: "CANCELLED" },
      });
      log.info({ id, seller, force: !!force }, force ? "Force-cancelled on-chain listing" : "Cancelled off-chain unconfirmed listing");
      return res.json({ ok: true });
    } catch (err) {
      log.error({ err, id }, "Off-chain cancel failed");
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  router.post("/sync-purchase", async (req, res) => {
    const { txHash, listingId } = (req.body || {}) as { txHash?: string; listingId?: string };
    const fallbackListingId =
      typeof listingId === "string" && listingId.trim()
        ? normalizeListingId(listingId.trim())
        : null;

    const applyFallbackPurchaseStatus = async () => {
      if (!fallbackListingId) return false;
      const updated = await prisma.listing.updateMany({
        where: { id: fallbackListingId },
        data: { status: "LOCKED" },
      });
      if (updated.count === 0) return false;
      log.info(
        { listingId: fallbackListingId, txHash, nextStatus: "LOCKED" },
        "Synced purchase via fallback update",
      );
      return true;
    };

    if (!txHash || typeof txHash !== "string") {
      if (await applyFallbackPurchaseStatus()) {
        return res.json({ ok: true, listingId: fallbackListingId, source: "fallback" });
      }
      return res.status(400).json({ error: "txHash required" });
    }

    const rpcUrl = process.env.HEDERA_RPC_URL;
    if (!rpcUrl) {
      if (await applyFallbackPurchaseStatus()) {
        return res.json({ ok: true, listingId: fallbackListingId, source: "fallback" });
      }
      return res.status(503).json({ error: "HEDERA_RPC_URL not set" });
    }
    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const receipt = await provider.getTransactionReceipt(txHash);
      if (!receipt?.logs?.length) {
        if (await applyFallbackPurchaseStatus()) {
          return res.json({ ok: true, listingId: fallbackListingId, source: "fallback" });
        }
        return res.status(404).json({ error: "Transaction or logs not found" });
      }
      for (const logEntry of receipt.logs) {
        const decoded = decodeEvents(logEntry);
        if (decoded?.type !== "ItemPurchased") continue;
        const purchasedId = normalizeListingId(decoded.listingId);
        const buyer = normalizeWalletAddress(decoded.buyer);
        const seller = normalizeWalletAddress(decoded.seller);
        const amount = String(decoded.price ?? "0");

        await createSaleIfMissing({
          listingId: purchasedId,
          buyer,
          seller,
          amount,
          txHash,
        });

        // Read on-chain status to determine if escrow (LOCKED=2) or direct sale (COMPLETED=3)
        let nextStatus = "LOCKED";
        const marketplaceAddr = process.env.MARKETPLACE_ADDRESS;
        if (isUsableContractAddress(marketplaceAddr)) {
          try {
            const chainData = await readMarketplaceListingCompat(
              provider,
              marketplaceAddr,
              purchasedId,
            );
            const chainStatus = Number(chainData.status);
            // COMPLETED(3) = direct sale settled immediately; LOCKED(2) = escrow
            if (chainStatus === 3) nextStatus = "SOLD";
          } catch {
            // If chain read fails, default to LOCKED (safer; indexer will correct later)
          }
        }

        await prisma.listing.updateMany({
          where: { id: purchasedId },
          data: { status: nextStatus, buyer },
        });
        log.info({ listingId: purchasedId, txHash, buyer, nextStatus }, "Synced purchase from tx");
        return res.json({ ok: true, listingId: purchasedId, buyer, status: nextStatus });
      }
      if (await applyFallbackPurchaseStatus()) {
        return res.json({ ok: true, listingId: fallbackListingId, source: "fallback" });
      }
      return res.status(404).json({ error: "No ItemPurchased event in transaction" });
    } catch (err: any) {
      log.error({ err, txHash }, "Sync purchase failed");
      if (await applyFallbackPurchaseStatus()) {
        return res.json({ ok: true, listingId: fallbackListingId, source: "fallback" });
      }
      return res.status(500).json({ error: err.message || "Sync failed" });
    }
  });

  /**
   * Sync escrow completion state from chain.
   * Marks listing SOLD once escrow is COMPLETE.
   */
  router.post("/sync-escrow-complete", async (req, res) => {
    const { listingId } = (req.body || {}) as { listingId?: string };
    const normalizedId =
      typeof listingId === "string" && listingId.trim()
        ? normalizeListingId(listingId.trim())
        : null;
    if (!normalizedId) return res.status(400).json({ error: "listingId required" });

    const escrowAddr = process.env.ESCROW_ADDRESS;
    const rpcUrl = process.env.HEDERA_RPC_URL;
    if (!escrowAddr || !rpcUrl) {
      return res.status(503).json({ error: "Escrow/RPC not configured" });
    }

    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const contract = new ethers.Contract(escrowAddr, ESCROW_ABI_VIEW, provider);
      const data = await contract.escrows(listingIdToBytes32(normalizedId));
      const [buyer, , , , , stateNum] = data;
      const isComplete = Number(stateNum) === 2;
      if (!isComplete) {
        return res.status(409).json({ error: "Escrow is not complete yet" });
      }
      const buyerAddr = buyer && buyer !== ethers.ZeroAddress ? buyer.toLowerCase() : undefined;
      await prisma.listing.updateMany({
        where: { id: normalizedId },
        data: {
          status: "SOLD",
          exchangeConfirmedAt: new Date(),
          ...(buyerAddr && { buyer: buyerAddr }),
        } as any,
      });
      return res.json({ ok: true, listingId: normalizedId, status: "SOLD" });
    } catch (err: any) {
      log.error({ err, listingId: normalizedId }, "Sync escrow complete failed");
      return res.status(500).json({ error: err.message || "Sync failed" });
    }
  });

  /**
   * Sync an auction from createAuction transaction so it shows immediately.
   */
  router.post("/sync-auction", async (req, res) => {
    const {
      txHash,
      title,
      subtitle,
      description,
      condition,
      yearOfProduction,
      imageUrl,
      mediaUrls,
    } = (req.body || {}) as {
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
      const conditionStr =
        typeof condition === "string" && condition.trim() ? condition.trim() : null;
      const yearStr =
        typeof yearOfProduction === "string" && yearOfProduction.trim()
          ? yearOfProduction.trim()
          : null;
      for (const logEntry of receipt.logs) {
        const decoded = decodeEvents(logEntry);
        if (decoded?.type !== "AuctionCreated") continue;
        const auctionId = normalizeListingId(decoded.auctionId);
        const seller = (decoded.seller || "").toLowerCase();
        const titleStr = typeof title === "string" && title.trim() ? title.trim() : null;
        const descriptionStr =
          typeof description === "string" && description.trim() ? description.trim() : null;
        const imageUrlStr = typeof imageUrl === "string" && imageUrl ? imageUrl : null;
        const mediaList =
          Array.isArray(mediaUrls) && mediaUrls.length > 0
            ? mediaUrls.filter((u): u is string => typeof u === "string" && u.length > 0)
            : imageUrlStr
              ? [imageUrlStr]
              : [];
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
      const id =
        rawId.startsWith("0x") && rawId.length === 66
          ? normalizeListingId(rawId)
          : listingIdToBytes32(rawId);
      const listing = await prisma.listing.findUnique({
        where: { id },
      });
      if (!listing) return res.status(404).json({ error: "Listing not found" });

      let onChainPrice: string | null = null;
      let onChainStatus: string | null = null;
      const marketplaceAddr = process.env.MARKETPLACE_ADDRESS;
      const rpcUrl = process.env.HEDERA_RPC_URL;
      if (isUsableContractAddress(marketplaceAddr) && rpcUrl) {
        try {
          const provider = new ethers.JsonRpcProvider(rpcUrl);
          const data = await readMarketplaceListingCompat(provider, marketplaceAddr, id);
          const priceStr = data.price.toString();
          const statusNum = Number(data.status);
          const hasSeller = data.seller && data.seller !== ethers.ZeroAddress;
          const chainAmount = BigInt(priceStr || "0");
          onChainStatus =
            statusNum === 1
              ? "LISTED"
              : statusNum === 2
                ? "LOCKED"
                : statusNum === 3
                  ? "SOLD"
                  : statusNum === 4
                    ? "CANCELLED"
                    : null;
          if (priceStr && priceStr !== "0" && hasSeller && chainAmount > 0n) {
            onChainPrice = priceStr;
          }
        } catch (e) {
          log.warn({ err: e, listingId: id }, "Could not read on-chain listing price");
        }
      }

      const priceForClient = onChainPrice
        ? chainAmountToHbar(onChainPrice)
        : toHbarForClient(listing.price);

      res.json({
        listing: {
          ...listing,
          imageUrl: rewriteMediaUrlForClient((listing as any).imageUrl),
          mediaUrls:
            rewriteMediaUrlsForClient((listing as any).mediaUrls) ?? (listing as any).mediaUrls,
          status: onChainStatus ?? listing.status,
          price: priceForClient,
        },
      });
    } catch (err) {
      log.error({ err }, "Failed to fetch listing");
      res.status(500).json({ error: "Internal server error" });
    }
  });

  router.post("/listing/:id/report", async (req, res) => {
    try {
      if (!listingReportWebhookUrl) {
        return res.status(503).json({ error: "Reporting is not configured yet." });
      }
      const id = normalizeListingId(req.params.id ?? "");
      const { reporterAddress, reason, details } = (req.body || {}) as {
        reporterAddress?: string;
        reason?: string;
        details?: string;
      };
      const reporter = (reporterAddress || "").trim().toLowerCase();
      if (!/^0x[0-9a-f]{40}$/.test(reporter)) {
        return res.status(400).json({ error: "Valid reporterAddress is required." });
      }
      const allowedReasons = new Set(["scam", "counterfeit", "prohibited", "abuse", "other"]);
      const reportReason = String(reason || "")
        .trim()
        .toLowerCase();
      if (!allowedReasons.has(reportReason)) {
        return res.status(400).json({ error: "Invalid report reason." });
      }
      const reportDetails = typeof details === "string" ? details.trim().slice(0, 1000) : "";
      const listing = await prisma.listing.findUnique({ where: { id } });
      if (!listing) return res.status(404).json({ error: "Listing not found" });
      if (listing.seller.toLowerCase() === reporter) {
        return res.status(400).json({ error: "You cannot report your own listing." });
      }
      const originIpRaw = String(
        req.headers["x-forwarded-for"] || req.socket.remoteAddress || req.ip || "",
      )
        .split(",")[0]
        ?.trim();
      const rateKey = `${reporter}:${originIpRaw || "ip-unknown"}`;
      if (isReportRateLimited(rateKey)) {
        return res
          .status(429)
          .json({ error: "Too many reports right now. Please try again shortly." });
      }

      const listingUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://hashpop.io"}/listing/${encodeURIComponent(id)}`;
      const mentionPrefix = listingReportMentionRoleId ? `<@&${listingReportMentionRoleId}> ` : "";
      const payload = {
        content: `${mentionPrefix}New listing report submitted`,
        embeds: [
          {
            title: "Listing report",
            color: 0xff4d4f,
            fields: [
              { name: "Listing", value: id, inline: false },
              { name: "Reason", value: reportReason, inline: true },
              { name: "Reporter", value: reporter, inline: true },
              { name: "Seller", value: listing.seller.toLowerCase(), inline: true },
              { name: "Listing URL", value: listingUrl, inline: false },
              {
                name: "Details",
                value: reportDetails || "No additional details provided.",
                inline: false,
              },
            ],
            timestamp: new Date().toISOString(),
          },
        ],
      };
      const discordRes = await fetch(listingReportWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!discordRes.ok) {
        const text = await discordRes.text().catch(() => "");
        log.error({ status: discordRes.status, body: text }, "Discord report webhook failed");
        return res.status(502).json({ error: "Could not forward report to moderation channel." });
      }
      return res.json({ ok: true });
    } catch (err) {
      log.error({ err }, "Failed to report listing");
      return res.status(500).json({ error: "Internal server error" });
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
      const {
        title,
        subtitle,
        description,
        category,
        condition,
        yearOfProduction,
        imageUrl,
        mediaUrls,
        sellerAddress,
        trackingNumber,
        trackingCarrier,
        requireEscrow,
        location,
      } = (req.body || {}) as {
        title?: string;
        subtitle?: string;
        description?: string;
        category?: string;
        condition?: string;
        yearOfProduction?: string;
        imageUrl?: string;
        mediaUrls?: string[];
        sellerAddress?: string;
        trackingNumber?: string;
        trackingCarrier?: string;
        requireEscrow?: boolean;
        location?: string;
      };
      const listing = await prisma.listing.findUnique({ where: { id } });
      if (!listing) return res.status(404).json({ error: "Listing not found" });
      const sellerLower =
        sellerAddress && typeof sellerAddress === "string" ? sellerAddress.toLowerCase() : "";
      if (sellerLower !== listing.seller.toLowerCase()) {
        return res.status(403).json({ error: "Only the seller can edit this listing" });
      }
      const update: {
        title?: string | null;
        subtitle?: string | null;
        description?: string | null;
        category?: string | null;
        condition?: string | null;
        yearOfProduction?: string | null;
        location?: string | null;
        price?: string;
        imageUrl?: string | null;
        mediaUrls?: string[];
        trackingNumber?: string | null;
        trackingCarrier?: string | null;
        shippedAt?: Date | null;
        requireEscrow?: boolean;
      } = {};
      if (title !== undefined) update.title = title === "" ? null : title;
      if (subtitle !== undefined) update.subtitle = subtitle === "" ? null : subtitle;
      if (description !== undefined) update.description = description === "" ? null : description;
      if (category !== undefined) update.category = category === "" ? null : category;
      if (condition !== undefined) update.condition = condition === "" ? null : condition;
      if (yearOfProduction !== undefined)
        update.yearOfProduction = yearOfProduction === "" ? null : yearOfProduction;
      if (location !== undefined) update.location = location === "" ? null : location;
      // Intentionally ignore direct price writes here.
      // Listing price must be synced from on-chain events/tx-sync endpoints only.
      if (mediaUrls !== undefined && Array.isArray(mediaUrls)) {
        update.mediaUrls = mediaUrls.filter(
          (u): u is string => typeof u === "string" && u.length > 0,
        );
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
      if (trackingNumber !== undefined) {
        const tn = String(trackingNumber || "").trim();
        update.trackingNumber = tn || null;
        update.shippedAt = tn ? new Date() : null;
      }
      if (trackingCarrier !== undefined) {
        const tc = String(trackingCarrier || "").trim();
        update.trackingCarrier = tc || null;
      }
      if (requireEscrow !== undefined) {
        update.requireEscrow = !!requireEscrow;
      }
      const updated = await prisma.listing.update({
        where: { id },
        data: update,
      });
      res.json({
        listing: {
          ...updated,
          imageUrl: rewriteMediaUrlForClient((updated as any).imageUrl),
          mediaUrls:
            rewriteMediaUrlsForClient((updated as any).mediaUrls) ?? (updated as any).mediaUrls,
        },
      });
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
          imageUrl: rewriteMediaUrlForClient((auction as any).imageUrl),
          mediaUrls:
            rewriteMediaUrlsForClient((auction as any).mediaUrls) ?? (auction as any).mediaUrls,
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
      const {
        title,
        subtitle,
        description,
        condition,
        yearOfProduction,
        imageUrl,
        mediaUrls,
        sellerAddress,
      } = (req.body || {}) as {
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
      const sellerLower =
        sellerAddress && typeof sellerAddress === "string" ? sellerAddress.toLowerCase() : "";
      if (sellerLower !== auction.seller.toLowerCase()) {
        return res.status(403).json({ error: "Only the seller can edit this auction" });
      }
      const update: {
        title?: string | null;
        subtitle?: string | null;
        description?: string | null;
        condition?: string | null;
        yearOfProduction?: string | null;
        imageUrl?: string | null;
        mediaUrls?: string[];
      } = {};
      if (title !== undefined) update.title = title === "" ? null : title;
      if (subtitle !== undefined) update.subtitle = subtitle === "" ? null : subtitle;
      if (description !== undefined) update.description = description === "" ? null : description;
      if (condition !== undefined) update.condition = condition === "" ? null : condition;
      if (yearOfProduction !== undefined)
        update.yearOfProduction = yearOfProduction === "" ? null : yearOfProduction;
      if (mediaUrls !== undefined && Array.isArray(mediaUrls)) {
        update.mediaUrls = mediaUrls.filter(
          (u): u is string => typeof u === "string" && u.length > 0,
        );
      } else if (imageUrl !== undefined && imageUrl !== "") {
        const a = auction as { mediaUrls?: string[]; imageUrl?: string | null };
        const existing = a.mediaUrls?.length ? a.mediaUrls : a.imageUrl ? [a.imageUrl] : [];
        update.mediaUrls = [...existing, imageUrl];
      }
      const updated = await prisma.auction.update({
        where: { id },
        data: update,
      });
      res.json({
        auction: {
          ...updated,
          imageUrl: rewriteMediaUrlForClient((updated as any).imageUrl),
          mediaUrls:
            rewriteMediaUrlsForClient((updated as any).mediaUrls) ?? (updated as any).mediaUrls,
        },
      });
    } catch (err) {
      log.error({ err }, "Failed to update auction");
      res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
    }
  });

  router.get("/user/:address/listings", async (req, res) => {
    try {
      const { address } = req.params;
      const addrLower = address?.toLowerCase() ?? "";
      const [activeListings, archivedListings, activeAuctions, archivedAuctions] =
        await Promise.all([
          prisma.listing.findMany({
            where: { seller: addrLower, status: "LISTED" },
            orderBy: { createdAt: "desc" },
          }),
          prisma.listing.findMany({
            where: {
              seller: addrLower,
              status: { in: ["CANCELLED", "LOCKED", "COMPLETED", "SOLD"] },
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
        active: activeListings.map((l) => ({
          ...l,
          imageUrl: rewriteMediaUrlForClient((l as any).imageUrl),
          mediaUrls: rewriteMediaUrlsForClient((l as any).mediaUrls) ?? (l as any).mediaUrls,
          price: toHbarForClient(l.price),
          itemType: "listing" as const,
        })),
        archived: archivedListings.map((l) => ({
          ...l,
          imageUrl: rewriteMediaUrlForClient((l as any).imageUrl),
          mediaUrls: rewriteMediaUrlsForClient((l as any).mediaUrls) ?? (l as any).mediaUrls,
          price: toHbarForClient(l.price),
          itemType: "listing" as const,
        })),
        activeAuctions: activeAuctions.map((a) => ({
          ...a,
          imageUrl: rewriteMediaUrlForClient((a as any).imageUrl),
          mediaUrls: rewriteMediaUrlsForClient((a as any).mediaUrls) ?? (a as any).mediaUrls,
          reservePrice: toHbarForClient(a.reservePrice),
        })),
        archivedAuctions: archivedAuctions.map((a) => ({
          ...a,
          imageUrl: rewriteMediaUrlForClient((a as any).imageUrl),
          mediaUrls: rewriteMediaUrlsForClient((a as any).mediaUrls) ?? (a as any).mediaUrls,
          reservePrice: toHbarForClient(a.reservePrice),
        })),
      });
    } catch (err) {
      log.error({ err }, "Failed to fetch user listings");
      res.status(500).json({ error: "Internal server error" });
    }
  });

  router.get("/user/:address/purchases", async (req, res) => {
    try {
      const { address } = req.params;
      const addrLower = address?.toLowerCase() ?? "";
      const sales = await prisma.sale.findMany({
        where: {
          OR: [{ buyer: addrLower }, { seller: addrLower }],
        },
        include: {
          listing: true,
          auction: true,
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      res.json({
        purchases: sales.map((s) => ({
          id: s.id,
          listingId: s.listingId,
          auctionId: s.auctionId,
          buyer: s.buyer,
          seller: s.seller,
          amount: toHbarForClient(s.amount),
          txHash: s.txHash ?? null,
          createdAt: s.createdAt,
          role: s.buyer.toLowerCase() === addrLower ? "buyer" : "seller",
          listing: s.listing
            ? {
                id: s.listing.id,
                title: s.listing.title,
                status: s.listing.status,
                imageUrl: rewriteMediaUrlForClient(s.listing.imageUrl),
              }
            : null,
          auction: s.auction
            ? {
                id: s.auction.id,
                title: s.auction.title,
                status: s.auction.status,
                imageUrl: rewriteMediaUrlForClient(s.auction.imageUrl),
              }
            : null,
        })),
      });
    } catch (err) {
      log.error({ err }, "Failed to fetch purchases");
      res.status(500).json({ error: "Internal server error" });
    }
  });

  router.get("/wishlist/counts", async (_req, res) => {
    try {
      const rows = await prisma.wishlistItem.groupBy({
        by: ["itemId"],
        _count: { itemId: true },
      });
      const counts: Record<string, number> = {};
      for (const r of rows) counts[r.itemId] = r._count.itemId;
      res.json({ counts });
    } catch (err) {
      log.error({ err }, "Failed to fetch wishlist counts");
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
      if (!userAddress || !id)
        return res.status(400).json({ error: "address and itemId required" });
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
      if (!address || !itemId)
        return res.status(400).json({ error: "address and itemId required" });
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
          reputationScore: 0,
        },
      });
      res.json({ ok: true, address: addrLower });
    } catch (err) {
      log.error({ err }, "Failed to register user");
      res.status(500).json({ error: "Internal server error" });
    }
  });

  router.post("/user/public-key", async (req, res) => {
    try {
      const {
        address: rawAddr,
        publicKey,
        signature,
      } = (req.body || {}) as {
        address?: string;
        publicKey?: string;
        signature?: string;
      };
      if (!rawAddr || !publicKey || !signature) {
        return res.status(400).json({ error: "address, publicKey, and signature required" });
      }
      const addr = rawAddr.trim().toLowerCase();
      const expectedMessage = `hashpop.pubkey:${publicKey}`;
      let recoveredAddress: string;
      try {
        recoveredAddress = ethers.verifyMessage(expectedMessage, signature).toLowerCase();
      } catch {
        return res.status(400).json({ error: "Invalid signature" });
      }
      if (recoveredAddress !== addr) {
        return res.status(403).json({ error: "Signature does not match address" });
      }
      await prisma.user.upsert({
        where: { id: addr },
        update: { publicKey },
        create: { id: addr, address: addr, publicKey, reputationScore: 0 },
      });
      res.json({ success: true });
    } catch (err) {
      log.error({ err }, "Failed to register public key");
      res.status(500).json({ error: "Internal server error" });
    }
  });

  router.get("/user/:address/public-key", async (req, res) => {
    try {
      const addr = req.params.address?.trim().toLowerCase();
      if (!addr) return res.status(400).json({ error: "address required" });
      const user = await prisma.user.findFirst({ where: { address: addr } });
      res.json({ publicKey: user?.publicKey ?? null });
    } catch (err) {
      log.error({ err }, "Failed to fetch public key");
      res.status(500).json({ error: "Internal server error" });
    }
  });

  router.post("/messages", async (req, res) => {
    try {
      const { fromAddress, toAddress, body, listingId, encrypted, nonce, type, offerAmount } = (req.body || {}) as {
        fromAddress?: string;
        toAddress?: string;
        body?: string;
        listingId?: string;
        encrypted?: boolean;
        nonce?: string;
        type?: string;
        offerAmount?: string;
      };
      const from = fromAddress?.trim().toLowerCase();
      const to = toAddress?.trim().toLowerCase();
      const text = typeof body === "string" ? body.trim() : "";
      if (!from || !to)
        return res.status(400).json({ error: "fromAddress and toAddress required" });
      if (!text) return res.status(400).json({ error: "body required" });
      if (from === to) return res.status(400).json({ error: "Cannot message yourself" });

      const msgType = type === "offer" ? "offer" : "message";

      const listingInput = typeof listingId === "string" ? listingId.trim() : "";
      let normalizedListingId: string | null = null;

      if (listingInput) {
        normalizedListingId =
          listingInput.startsWith("0x") && listingInput.length === 66
            ? normalizeListingId(listingInput)
            : listingIdToBytes32(listingInput);
        const listing = await prisma.listing.findUnique({ where: { id: normalizedListingId } });
        if (!listing) return res.status(404).json({ error: "Listing not found" });
      }

      const msg = await prisma.message.create({
        data: {
          fromAddress: from,
          toAddress: to,
          body: text,
          listingId: normalizedListingId,
          encrypted: encrypted === true,
          nonce: encrypted === true && nonce ? nonce : null,
          type: msgType,
          offerAmount: msgType === "offer" && offerAmount ? String(offerAmount) : null,
          offerStatus: msgType === "offer" ? "pending" : null,
        },
      });
      res.status(201).json({ message: msg });
    } catch (err) {
      log.error({ err }, "Failed to create message");
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Mark messages in a thread as read
  router.post("/messages/mark-read", async (req, res) => {
    try {
      const { address, other, listingId } = (req.body || {}) as {
        address?: string;
        other?: string;
        listingId?: string;
      };
      const addr = address?.trim().toLowerCase();
      const otherAddr = other?.trim().toLowerCase();
      if (!addr || !otherAddr) return res.status(400).json({ error: "address and other required" });

      const listingInput = typeof listingId === "string" ? listingId.trim() : "";
      let normalizedListingId: string | null = null;
      if (listingInput) {
        normalizedListingId =
          listingInput.startsWith("0x") && listingInput.length === 66
            ? normalizeListingId(listingInput)
            : listingIdToBytes32(listingInput);
      }

      await prisma.message.updateMany({
        where: {
          fromAddress: otherAddr,
          toAddress: addr,
          listingId: normalizedListingId,
          read: false,
        },
        data: { read: true },
      });
      res.json({ ok: true });
    } catch (err) {
      log.error({ err }, "Failed to mark messages as read");
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Respond to an offer (accept or decline)
  router.post("/messages/:id/offer-response", async (req, res) => {
    try {
      const { id } = req.params;
      const { address, action } = (req.body || {}) as { address?: string; action?: string };
      const addr = address?.trim().toLowerCase();
      if (!addr) return res.status(400).json({ error: "address required" });
      if (action !== "accepted" && action !== "declined")
        return res.status(400).json({ error: "action must be accepted or declined" });

      const msg = await prisma.message.findUnique({ where: { id } });
      if (!msg) return res.status(404).json({ error: "Message not found" });
      if (msg.type !== "offer") return res.status(400).json({ error: "Not an offer message" });
      if (msg.toAddress !== addr) return res.status(403).json({ error: "Forbidden" });
      if (msg.offerStatus !== "pending") return res.status(400).json({ error: "Offer already resolved" });

      const updated = await prisma.message.update({
        where: { id },
        data: { offerStatus: action },
      });
      res.json({ message: updated });
    } catch (err) {
      log.error({ err }, "Failed to respond to offer");
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Unread message count
  router.get("/messages/unread-count", async (req, res) => {
    try {
      const address = (req.query.address as string)?.trim()?.toLowerCase();
      if (!address) return res.status(400).json({ error: "address required" });
      const count = await prisma.message.count({
        where: { toAddress: address, read: false },
      });
      res.json({ count });
    } catch (err) {
      log.error({ err }, "Failed to fetch unread count");
      res.status(500).json({ error: "Internal server error" });
    }
  });

  router.get("/messages/inbox", async (req, res) => {
    try {
      const address = (req.query.address as string)?.trim()?.toLowerCase();
      if (!address) return res.status(400).json({ error: "address required" });
      const messages = await prisma.message.findMany({
        where: {
          OR: [{ fromAddress: address }, { toAddress: address }],
        },
        orderBy: { createdAt: "desc" },
      });

      // Collect unique listing IDs for metadata fetch
      const listingIds = [...new Set(messages.map((m) => m.listingId).filter(Boolean) as string[])];
      const listings = listingIds.length
        ? await prisma.listing.findMany({
            where: { id: { in: listingIds } },
            select: { id: true, title: true, imageUrl: true, price: true, mediaUrls: true },
          })
        : [];
      const listingMap = new Map(listings.map((l) => [l.id, l]));

      const seen = new Map<string, { last: (typeof messages)[0]; preview: string; unreadCount: number }>();
      for (const m of messages) {
        const other = m.fromAddress === address ? m.toAddress : m.fromAddress;
        const key = `${other}-${m.listingId ?? ""}`;
        if (!seen.has(key)) {
          let preview: string;
          if (m.type === "offer") {
            preview = `Offer: ${m.offerAmount} HBAR`;
          } else if (m.encrypted) {
            preview = "[Encrypted message]";
          } else {
            preview = m.body.slice(0, 80);
          }
          seen.set(key, { last: m, preview, unreadCount: 0 });
        }
        // Count unread messages sent to this user
        if (m.toAddress === address && !m.read) {
          const entry = seen.get(key)!;
          entry.unreadCount += 1;
        }
      }
      const conversations = Array.from(seen.entries()).map(([key, v]) => {
        const dash = key.indexOf("-");
        const otherAddress = dash >= 0 ? key.slice(0, dash) : key;
        const listingId = dash >= 0 ? key.slice(dash + 1) || null : null;
        const listing = listingId ? listingMap.get(listingId) : null;
        return {
          otherAddress,
          listingId,
          lastMessage: v.last,
          preview: v.preview,
          unreadCount: v.unreadCount,
          listing: listing
            ? {
                title: listing.title,
                imageUrl: listing.imageUrl || (listing.mediaUrls?.[0] ?? null),
                price: listing.price,
              }
            : null,
        };
      });
      const sorted = conversations.sort(
        (a, b) =>
          new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime(),
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
      const listingIdRaw = (req.query.listingId as string)?.trim() || "";
      if (!address || !other) return res.status(400).json({ error: "address and other required" });

      let listingId: string | null = null;
      if (listingIdRaw) {
        listingId =
          listingIdRaw.startsWith("0x") && listingIdRaw.length === 66
            ? normalizeListingId(listingIdRaw)
            : listingIdToBytes32(listingIdRaw);
      }

      const where: Record<string, unknown> = {
        OR: [
          { fromAddress: address, toAddress: other },
          { fromAddress: other, toAddress: address },
        ],
      };
      if (listingId) {
        where.listingId = listingId;
      } else {
        where.listingId = null;
      }

      // Fetch listing metadata if applicable
      const listing = listingId
        ? await prisma.listing.findUnique({
            where: { id: listingId },
            select: { id: true, title: true, imageUrl: true, price: true, mediaUrls: true, seller: true, status: true },
          })
        : null;

      const messages = await prisma.message.findMany({
        where,
        orderBy: { createdAt: "asc" },
      });
      res.json({ messages, listing });
    } catch (err) {
      log.error({ err }, "Failed to fetch thread");
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // All offer messages for a wallet (received + sent), with listing metadata
  router.get("/messages/offers", async (req, res) => {
    try {
      const address = (req.query.address as string)?.trim().toLowerCase();
      if (!address) return res.status(400).json({ error: "address required" });

      const offers = await prisma.message.findMany({
        where: { type: "offer", OR: [{ fromAddress: address }, { toAddress: address }] },
        orderBy: { createdAt: "desc" },
      });

      const listingIds = [...new Set(offers.map((o) => o.listingId).filter(Boolean))] as string[];
      const listings =
        listingIds.length > 0
          ? await prisma.listing.findMany({
              where: { id: { in: listingIds } },
              select: { id: true, title: true, imageUrl: true, price: true, seller: true, status: true },
            })
          : [];
      const listingMap = Object.fromEntries(listings.map((l) => [l.id, l]));

      res.json({
        offers: offers.map((o) => ({
          ...o,
          listing: o.listingId ? (listingMap[o.listingId] ?? null) : null,
        })),
      });
    } catch (err) {
      log.error({ err }, "Failed to fetch offers");
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
        return res
          .status(400)
          .json({ error: "reviewerAddress, ratedAddress, and saleId are required" });
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

      const message = `hashpop.rate:${saleRef}:${rated}:${ratingScore}`;
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

      const [activeListings, totalSalesFromSales, ratingAgg, completedBuys] = await Promise.all([
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
        prisma.sale.count({
          where: {
            buyer: addrLower,
            OR: [
              { listing: { is: { status: "COMPLETED" } } },
              { auction: { is: { status: "SETTLED" } } },
            ],
          },
        }),
      ]);

      const ratingCount = ratingAgg._count._all ?? 0;
      const ratingAverage = ratingAgg._avg.score ?? null;
      // Reputation comes only from:
      // 1) completed purchases, and
      // 2) received ratings after completed sales.
      const reputationFromBuys = completedBuys;
      const reputationFromRatings = ratingAverage == null ? 0 : Math.round(ratingAverage * 10);
      const computedReputation = reputationFromBuys + reputationFromRatings;

      if (!user) {
        return res.json({
          address,
          totalSales: totalSalesFromSales,
          activeListings,
          reputation: 0,
          ratingCount,
          ratingAverage,
          profileImageUrl: null,
        });
      }

      res.json({
        address: user.address,
        totalSales: user.totalSales ?? totalSalesFromSales,
        activeListings,
        reputation: computedReputation,
        successful: user.successfulCompletions,
        ratingCount,
        ratingAverage,
        profileImageUrl: user.profileImageUrl ?? null,
      });
    } catch (err) {
      log.error({ err }, "Failed to fetch user");
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Upload / update profile avatar
  router.post("/user/upload-avatar", (req, res) => {
    const avatarUpload = multer({ storage: memoryStorage, limits: { fileSize: 5 * 1024 * 1024 } }).single("avatar");
    avatarUpload(req, res, async (err: any) => {
      try {
        if (err) {
          log.warn({ err, code: err?.code }, "Avatar upload error");
          if (err.code === "LIMIT_FILE_SIZE")
            return res.status(400).json({ error: "Image must be 2 MB or smaller" });
          return res.status(400).json({ error: err.message || "Upload failed" });
        }
        const address = (req.body?.address as string | undefined)?.trim().toLowerCase();
        if (!address) return res.status(400).json({ error: "address required" });
        if (!req.file) return res.status(400).json({ error: "avatar file required" });
        const filename = avatarFilename(req.file.originalname);
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

  router.get("/debug/mirror-logs", async (req, res) => {
    const marketplaceAddress = process.env.MARKETPLACE_ADDRESS;
    const auctionHouseAddress = process.env.AUCTION_HOUSE_ADDRESS;
    if (!marketplaceAddress || !auctionHouseAddress) {
      return res.json({ error: "MARKETPLACE_ADDRESS or AUCTION_HOUSE_ADDRESS not set" });
    }
    try {
      const events = await fetchMirrorEvents(marketplaceAddress, auctionHouseAddress, 0);
      const eventsWithDecoded = events.map((ev: any) => {
        const topic0 = ev.topics?.[0] ?? ev.topic0 ?? null;
        const decoded = decodeEvents(ev);
        return {
          topic0: topic0 ? String(topic0).toLowerCase() : null,
          decodedType: decoded?.type ?? null,
          timestamp: ev.timestamp,
        };
      });
      const itemListedCount = eventsWithDecoded.filter(
        (e: any) => e.decodedType === "ItemListed",
      ).length;
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

  router.delete("/debug/clear-history", async (req, res) => {
    try {
      const sales = await prisma.sale.deleteMany({});
      const bids = await prisma.bid.deleteMany({});
      const ratings = await prisma.rating.deleteMany({});
      const messages = await prisma.message.deleteMany({});
      const wishlist = await prisma.wishlistItem.deleteMany({});
      const users = await prisma.user.deleteMany({});

      // Reset indexer state so it doesn't re-index old purchase events
      const stateFile = path.join(process.cwd(), ".indexer-state.json");
      const nowSec = Math.floor(Date.now() / 1000);
      try {
        fs.writeFileSync(
          stateFile,
          JSON.stringify({ lastProcessedTimestamp: nowSec, lastProcessedBlock: 999999999 }),
          "utf8",
        );
      } catch {}

      log.info(
        { sales: sales.count, bids: bids.count, ratings: ratings.count, messages: messages.count },
        "Cleared history (kept listings)",
      );
      return res.json({
        ok: true,
        cleared: {
          sales: sales.count,
          bids: bids.count,
          ratings: ratings.count,
          messages: messages.count,
          wishlist: wishlist.count,
          users: users.count,
        },
      });
    } catch (err: any) {
      log.error({ err }, "Clear history failed");
      return res.status(500).json({ error: err.message });
    }
  });

  return router;
}
