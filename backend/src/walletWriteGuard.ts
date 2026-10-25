import type { Request, RequestHandler } from "express";
import type { Logger } from "pino";
import type { PrismaClient } from "./generated/prisma/client";
import {
  authenticateWalletRequest,
  preferredWalletAddress,
  prismaNonceStore,
  walletOwns,
  type WalletGuardDeps,
  type WalletIdentity,
} from "./walletAuth";

type GuardDeps = WalletGuardDeps & {
  prisma: PrismaClient;
  log: Logger;
  resolveListingId: (raw: string) => string;
};

type Decision = { ok: true } | { ok: false; status: number; error: string };

function bodyOf(req: Request): Record<string, unknown> {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
    return req.body as Record<string, unknown>;
  }
  return {};
}

function str(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function claimedOk(wallet: WalletIdentity, claimed: string | null): Decision | null {
  if (!claimed) return null;
  if (walletOwns(wallet, claimed)) return null;
  return { ok: false, status: 403, error: "Signed account does not match the acting address" };
}

function listingIdFromPath(path: string): string | null {
  const match = path.match(/^\/listing\/([^/]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function userAddressFromPath(path: string): string | null {
  const match = path.match(/^\/user\/([^/]+)\/profile$/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

async function authorize(
  req: Request,
  wallet: WalletIdentity,
  deps: GuardDeps,
): Promise<Decision | "skip"> {
  const method = (req.method || "GET").toUpperCase();
  const path = req.path || "/";
  const body = bodyOf(req);

  if (method === "POST" && (path === "/upload-listing-image" || path === "/upload-listing-media")) {
    return { ok: true };
  }
  if (method === "POST" && path === "/sync-cancel") return { ok: true };
  if (method === "POST" && path === "/sync-purchase") return { ok: true };

  if (method === "POST" && path === "/sync-listing") {
    const mismatch = claimedOk(wallet, str(body.seller) ?? str(body.sellerAddress));
    if (mismatch) return mismatch;
    const rawId = str(body.listingId);
    if (!rawId) return { ok: true };
    const listing = await deps.prisma.listing.findUnique({
      where: { id: deps.resolveListingId(rawId) },
    });
    if (listing && !walletOwns(wallet, listing.seller)) {
      return { ok: false, status: 403, error: "Only the seller can sync this listing" };
    }
    return { ok: true };
  }

  if (method === "POST" && path === "/sync-price-update") {
    const rawId = str(body.listingId);
    if (!rawId) return { ok: true };
    const listing = await deps.prisma.listing.findUnique({
      where: { id: deps.resolveListingId(rawId) },
    });
    if (!listing) return { ok: false, status: 404, error: "Listing not found" };
    if (!walletOwns(wallet, listing.seller)) {
      return { ok: false, status: 403, error: "Only the seller can update this listing" };
    }
    return { ok: true };
  }

  if (
    (method === "PATCH" && /^\/listing\/[^/]+$/.test(path)) ||
    (method === "POST" && /^\/listing\/[^/]+\/cancel-offchain$/.test(path))
  ) {
    const rawId = listingIdFromPath(path);
    if (!rawId) return { ok: false, status: 400, error: "Listing id required" };
    const listing = await deps.prisma.listing.findUnique({
      where: { id: deps.resolveListingId(rawId) },
    });
    if (!listing) return { ok: false, status: 404, error: "Listing not found" };
    if (!walletOwns(wallet, listing.seller)) {
      return { ok: false, status: 403, error: "Only the seller can edit this listing" };
    }
    return { ok: true };
  }

  if (method === "POST" && path === "/sync-escrow-complete") {
    const rawId = str(body.listingId);
    if (!rawId) return { ok: true };
    const listing = await deps.prisma.listing.findUnique({
      where: { id: deps.resolveListingId(rawId) },
    });
    if (!listing) return { ok: false, status: 404, error: "Listing not found" };
    if (!walletOwns(wallet, listing.seller) && !walletOwns(wallet, listing.buyer)) {
      return {
        ok: false,
        status: 403,
        error: "Only the buyer or seller can mark this listing sold",
      };
    }
    return { ok: true };
  }

  if (method === "POST" && path === "/sync-offer") {
    const mismatch = claimedOk(wallet, str(body.buyer) ?? str(body.buyerAddress));
    if (mismatch) return mismatch;
    return { ok: true };
  }

  if (method === "POST" && path === "/sync-offer-action") {
    const action = str(body.action);
    const rawId = str(body.listingId);
    if (!action || !rawId) return { ok: true };
    const listingId = deps.resolveListingId(rawId);
    if (action === "accept" || action === "reject") {
      const listing = await deps.prisma.listing.findUnique({ where: { id: listingId } });
      if (!listing) return { ok: false, status: 404, error: "Listing not found" };
      if (!walletOwns(wallet, listing.seller)) {
        return { ok: false, status: 403, error: "Only the seller can accept or reject an offer" };
      }
      return { ok: true };
    }
    if (action === "cancel") {
      const mismatch = claimedOk(wallet, str(body.buyer));
      if (mismatch) return mismatch;
      const buyer = preferredWalletAddress(wallet, str(body.buyer));
      const offer = await deps.prisma.offer.findUnique({
        where: { listingId_buyer: { listingId, buyer } },
      });
      if (offer && !walletOwns(wallet, offer.buyer)) {
        return { ok: false, status: 403, error: "Only the buyer can cancel this offer" };
      }
      return { ok: true };
    }
    return { ok: true };
  }

  if (method === "POST" && /^\/listing\/[^/]+\/report$/.test(path)) {
    const mismatch = claimedOk(wallet, str(body.reporterAddress));
    if (mismatch) return mismatch;
    return { ok: true };
  }

  if (method === "POST" && /^\/listing\/[^/]+\/dispute$/.test(path)) {
    const mismatch = claimedOk(wallet, str(body.openerAddress));
    if (mismatch) return mismatch;
    const rawId = listingIdFromPath(path);
    if (!rawId) return { ok: false, status: 400, error: "Listing id required" };
    const listing = await deps.prisma.listing.findUnique({
      where: { id: deps.resolveListingId(rawId) },
    });
    if (!listing) return { ok: false, status: 404, error: "Listing not found" };
    if (!walletOwns(wallet, listing.seller) && !walletOwns(wallet, listing.buyer)) {
      return { ok: false, status: 403, error: "Only the buyer or seller can open a dispute" };
    }
    return { ok: true };
  }

  if (method === "POST" && /^\/listing\/[^/]+\/shipping-address$/.test(path)) {
    const mismatch = claimedOk(wallet, str(body.buyerAddress));
    if (mismatch) return mismatch;
    return { ok: true };
  }

  if (method === "POST" && path === "/wishlist") {
    const mismatch = claimedOk(wallet, str(body.address));
    if (mismatch) return mismatch;
    return { ok: true };
  }

  if (method === "DELETE" && path === "/wishlist") {
    const mismatch = claimedOk(wallet, str(req.query.address));
    if (mismatch) return mismatch;
    return { ok: true };
  }

  if (method === "POST" && (path === "/user/register" || path === "/user/public-key")) {
    const mismatch = claimedOk(wallet, str(body.address));
    if (mismatch) return mismatch;
    return { ok: true };
  }

  if (method === "POST" && path === "/messages") {
    const mismatch = claimedOk(wallet, str(body.fromAddress));
    if (mismatch) return mismatch;
    return { ok: true };
  }

  if (method === "POST" && path === "/ratings") {
    const mismatch = claimedOk(wallet, str(body.reviewerAddress));
    if (mismatch) return mismatch;
    return { ok: true };
  }

  if (method === "PATCH" && /^\/user\/[^/]+\/profile$/.test(path)) {
    const param = userAddressFromPath(path);
    if (!param || !walletOwns(wallet, param)) {
      return { ok: false, status: 403, error: "Only the account owner can edit this profile" };
    }
    return { ok: true };
  }

  return "skip";
}

function resourceId(req: Request): string | null {
  const fromListing = listingIdFromPath(req.path || "");
  if (fromListing) return fromListing;
  const fromUser = userAddressFromPath(req.path || "");
  if (fromUser) return fromUser;
  const body = bodyOf(req);
  return str(body.listingId) || str(body.itemId) || str(body.saleId) || str(req.query.itemId);
}

export function createWalletWriteGuard(deps: GuardDeps): RequestHandler {
  const nonceStore = deps.nonceStore ?? prismaNonceStore(deps.prisma);
  return async (req, res, next) => {
    if (!isProtectedRoute(req)) {
      next();
      return;
    }

    const auth = await authenticateWalletRequest(req, { ...deps, nonceStore });
    if (!auth.ok) {
      res.status(auth.status).json({ error: auth.error });
      return;
    }
    req.wallet = auth.wallet;

    let allowed: Decision | "skip";
    try {
      allowed = await authorize(req, auth.wallet, deps);
    } catch (err) {
      deps.log.error({ err }, "Wallet ownership check failed");
      res.status(500).json({ error: "Internal server error" });
      return;
    }
    if (allowed !== "skip" && !allowed.ok) {
      res.status(allowed.status).json({ error: allowed.error });
      return;
    }

    res.on("finish", () => {
      if (res.statusCode >= 400) return;
      void deps.prisma.walletAuditLog
        .create({
          data: {
            method: req.method,
            path: req.path,
            resourceId: resourceId(req),
            accountId: auth.wallet.accountId,
            evmAddress: auth.wallet.evmAddress,
          },
        })
        .catch((err: unknown) => {
          deps.log.warn({ err }, "Wallet audit log write failed");
        });
    });
    next();
  };
}

/** Routes whose acting identity must come from the signed wallet, not the body. */
export function isProtectedRoute(req: Pick<Request, "method" | "path">): boolean {
  const method = (req.method || "GET").toUpperCase();
  const path = req.path || "/";
  if (method === "POST" && path === "/upload-listing-image") return true;
  if (method === "POST" && path === "/upload-listing-media") return true;
  if (method === "POST" && path === "/sync-listing") return true;
  if (method === "POST" && path === "/sync-price-update") return true;
  if (method === "POST" && path === "/sync-cancel") return true;
  if (method === "POST" && /^\/listing\/[^/]+\/cancel-offchain$/.test(path)) return true;
  if (method === "POST" && path === "/sync-purchase") return true;
  if (method === "POST" && path === "/sync-escrow-complete") return true;
  if (method === "POST" && path === "/sync-offer") return true;
  if (method === "POST" && path === "/sync-offer-action") return true;
  if (method === "POST" && /^\/listing\/[^/]+\/report$/.test(path)) return true;
  if (method === "POST" && /^\/listing\/[^/]+\/dispute$/.test(path)) return true;
  if (method === "POST" && /^\/listing\/[^/]+\/shipping-address$/.test(path)) return true;
  if (method === "PATCH" && /^\/listing\/[^/]+$/.test(path)) return true;
  if ((method === "POST" || method === "DELETE") && path === "/wishlist") return true;
  if (method === "POST" && path === "/user/register") return true;
  if (method === "POST" && path === "/user/public-key") return true;
  if (method === "POST" && path === "/messages") return true;
  if (method === "POST" && path === "/ratings") return true;
  if (method === "PATCH" && /^\/user\/[^/]+\/profile$/.test(path)) return true;
  return false;
}
