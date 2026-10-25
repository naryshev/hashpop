import type { Request, RequestHandler, Response } from "express";
import type { Logger } from "pino";
import type { PrismaClient } from "./generated/prisma/client";
import {
  authenticateWalletRequest,
  prismaNonceStore,
  walletOwns,
  type WalletGuardDeps,
  type WalletIdentity,
} from "./walletAuth";
import {
  authenticateWalletSession,
  prismaSessionStore,
  sessionSecretFromEnv,
  WALLET_SESSION_HEADER,
  type SessionStore,
} from "./walletSession";

type GuardDeps = WalletGuardDeps & {
  prisma: PrismaClient;
  log: Logger;
  /** Shared with the handlers. `null` means the id is malformed. */
  resolveListingId: (raw: string) => string | null;
  sessionStore?: SessionStore;
  sessionSecret?: string;
};

/**
 * Bound to the route registration, not to `req.path`. Express 4 matches
 * `/Sync-Listing` and `/sync-listing/` to the same route, but `req.path`
 * keeps the caller's casing and trailing slash, so a path-string allowlist
 * misses them.
 */
export type WalletRouteKind =
  | "mint-session"
  | "revoke-session"
  | "upload"
  | "sync-listing"
  | "sync-purchase"
  | "sync-cancel"
  | "sync-price-update"
  | "sync-escrow-complete"
  | "sync-offer"
  | "sync-offer-action"
  | "listing-edit"
  | "listing-report"
  | "listing-dispute"
  | "shipping-write"
  | "shipping-read"
  | "wishlist-write"
  | "wishlist-read"
  | "user-register"
  | "user-public-key"
  | "messages-write"
  | "messages-inbox"
  | "messages-thread"
  | "ratings"
  | "profile-write"
  | "user-offers"
  | "user-purchases"
  | "listing-offers"
  | "profile-read";

type AuthMode = "signature" | "session" | "session-only" | "optional";

type Decision = { ok: true } | { ok: false; status: number; error: string };

const OFFER_ACTIONS = new Set(["accept", "reject", "cancel"]);

function modeFor(kind: WalletRouteKind): AuthMode {
  switch (kind) {
    case "mint-session":
    case "listing-edit":
    case "sync-cancel":
    case "sync-price-update":
    case "shipping-write":
    case "profile-write":
      return "signature";
    case "upload":
      return "session-only";
    case "listing-offers":
    case "profile-read":
      return "optional";
    default:
      return "session";
  }
}

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

function headerPresent(req: Request, name: string): boolean {
  const value = req.headers[name];
  if (Array.isArray(value)) return Boolean(value[0]?.trim());
  return Boolean(value?.trim());
}

function hasFreshSignature(req: Request): boolean {
  return (
    headerPresent(req, "x-hashpop-account") &&
    headerPresent(req, "x-hashpop-signature") &&
    headerPresent(req, "x-hashpop-issued-at") &&
    headerPresent(req, "x-hashpop-nonce")
  );
}

function param(req: Request, name: string): string | null {
  const value = req.params[name];
  return typeof value === "string" ? str(value) : null;
}

function listingIdOrReject(raw: string | null, deps: GuardDeps): { id: string } | Decision {
  if (!raw) return { ok: false, status: 400, error: "Invalid listing id" };
  const id = deps.resolveListingId(raw);
  if (!id) return { ok: false, status: 400, error: "Invalid listing id" };
  return { id };
}

async function authorizeKind(
  kind: WalletRouteKind,
  req: Request,
  wallet: WalletIdentity,
  deps: GuardDeps,
): Promise<Decision> {
  const body = bodyOf(req);

  switch (kind) {
    case "mint-session":
    case "revoke-session":
    case "upload":
    case "sync-purchase":
    case "sync-cancel":
    case "listing-offers":
    case "profile-read":
      return { ok: true };

    case "sync-listing": {
      const mismatch = claimedOk(wallet, str(body.seller) ?? str(body.sellerAddress));
      if (mismatch) return mismatch;
      const rawId = str(body.listingId);
      if (!rawId) return { ok: true };
      const parsed = listingIdOrReject(rawId, deps);
      if ("ok" in parsed) return parsed;
      const listing = await deps.prisma.listing.findUnique({ where: { id: parsed.id } });
      if (listing && !walletOwns(wallet, listing.seller)) {
        return { ok: false, status: 403, error: "Only the seller can sync this listing" };
      }
      return { ok: true };
    }

    case "sync-price-update": {
      const rawId = str(body.listingId);
      if (!rawId) return { ok: true };
      const parsed = listingIdOrReject(rawId, deps);
      if ("ok" in parsed) return parsed;
      const listing = await deps.prisma.listing.findUnique({ where: { id: parsed.id } });
      if (!listing) return { ok: false, status: 404, error: "Listing not found" };
      if (!walletOwns(wallet, listing.seller)) {
        return { ok: false, status: 403, error: "Only the seller can update this listing" };
      }
      return { ok: true };
    }

    case "listing-edit": {
      const parsed = listingIdOrReject(param(req, "id"), deps);
      if ("ok" in parsed) return parsed;
      const listing = await deps.prisma.listing.findUnique({ where: { id: parsed.id } });
      if (!listing) return { ok: false, status: 404, error: "Listing not found" };
      if (!walletOwns(wallet, listing.seller)) {
        return { ok: false, status: 403, error: "Only the seller can edit this listing" };
      }
      return { ok: true };
    }

    case "sync-escrow-complete": {
      const rawId = str(body.listingId);
      if (!rawId) return { ok: true };
      const parsed = listingIdOrReject(rawId, deps);
      if ("ok" in parsed) return parsed;
      const listing = await deps.prisma.listing.findUnique({ where: { id: parsed.id } });
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

    case "sync-offer": {
      const mismatch = claimedOk(wallet, str(body.buyer) ?? str(body.buyerAddress));
      if (mismatch) return mismatch;
      const rawId = str(body.listingId);
      if (!rawId) return { ok: true };
      const parsed = listingIdOrReject(rawId, deps);
      if ("ok" in parsed) return parsed;
      return { ok: true };
    }

    case "sync-offer-action": {
      const action = str(body.action)?.toLowerCase() ?? "";
      if (!OFFER_ACTIONS.has(action)) {
        return { ok: false, status: 400, error: "Invalid offer action" };
      }
      const parsed = listingIdOrReject(str(body.listingId), deps);
      if ("ok" in parsed) return parsed;
      if (action === "accept" || action === "reject") {
        const listing = await deps.prisma.listing.findUnique({ where: { id: parsed.id } });
        if (!listing) return { ok: false, status: 404, error: "Listing not found" };
        if (!walletOwns(wallet, listing.seller)) {
          return { ok: false, status: 403, error: "Only the seller can accept or reject an offer" };
        }
        return { ok: true };
      }
      const mismatch = claimedOk(wallet, str(body.buyer));
      if (mismatch) return mismatch;
      const offer = await deps.prisma.offer.findUnique({
        where: { listingId_buyer: { listingId: parsed.id, buyer: wallet.evmAddress } },
      });
      if (!offer || !walletOwns(wallet, offer.buyer)) {
        return { ok: false, status: 403, error: "Only the buyer can cancel this offer" };
      }
      return { ok: true };
    }

    case "listing-report":
      return claimedOk(wallet, str(body.reporterAddress)) ?? { ok: true };

    case "listing-dispute": {
      const mismatch = claimedOk(wallet, str(body.openerAddress));
      if (mismatch) return mismatch;
      const parsed = listingIdOrReject(param(req, "id"), deps);
      if ("ok" in parsed) return parsed;
      const listing = await deps.prisma.listing.findUnique({ where: { id: parsed.id } });
      if (!listing) return { ok: false, status: 404, error: "Listing not found" };
      if (!walletOwns(wallet, listing.seller) && !walletOwns(wallet, listing.buyer)) {
        return { ok: false, status: 403, error: "Only the buyer or seller can open a dispute" };
      }
      return { ok: true };
    }

    case "shipping-write":
      return claimedOk(wallet, str(body.buyerAddress)) ?? { ok: true };

    case "wishlist-write": {
      const claimed = req.method === "DELETE" ? str(req.query.address) : str(body.address);
      return claimedOk(wallet, claimed) ?? { ok: true };
    }

    case "user-register":
    case "user-public-key":
      return claimedOk(wallet, str(body.address)) ?? { ok: true };

    case "messages-write":
      return claimedOk(wallet, str(body.fromAddress)) ?? { ok: true };

    case "ratings":
      return claimedOk(wallet, str(body.reviewerAddress)) ?? { ok: true };

    case "profile-write": {
      const paramAddress = param(req, "address");
      if (!paramAddress || !walletOwns(wallet, paramAddress)) {
        return { ok: false, status: 403, error: "Only the account owner can edit this profile" };
      }
      return { ok: true };
    }

    case "shipping-read":
      return claimedOk(wallet, str(req.query.requester)) ?? { ok: true };

    case "messages-inbox":
    case "messages-thread":
    case "wishlist-read":
      return claimedOk(wallet, str(req.query.address)) ?? { ok: true };

    case "user-offers":
    case "user-purchases": {
      const paramAddress = param(req, "address");
      if (!paramAddress || !walletOwns(wallet, paramAddress)) {
        return {
          ok: false,
          status: 403,
          error: "Signed account does not match the acting address",
        };
      }
      return { ok: true };
    }

    default:
      return { ok: false, status: 500, error: "Internal server error" };
  }
}

function resourceId(req: Request): string | null {
  const listing = param(req, "id");
  if (listing) return listing;
  const user = param(req, "address");
  if (user) return user;
  const body = bodyOf(req);
  return str(body.listingId) || str(body.itemId) || str(body.saleId) || str(req.query.itemId);
}

function auditWrite(res: Response, req: Request, wallet: WalletIdentity, deps: GuardDeps): void {
  res.on("finish", () => {
    if (res.statusCode >= 400 || req.method === "GET") return;
    void deps.prisma.walletAuditLog
      .create({
        data: {
          method: req.method,
          path: req.path,
          resourceId: resourceId(req),
          accountId: wallet.accountId,
          evmAddress: wallet.evmAddress,
        },
      })
      .catch((err: unknown) => {
        deps.log.warn({ err }, "Wallet audit log write failed");
      });
  });
}

export function createWalletRouteAuth(deps: GuardDeps): (kind: WalletRouteKind) => RequestHandler {
  const nonceStore = deps.nonceStore ?? prismaNonceStore(deps.prisma);
  const sessionStore = deps.sessionStore ?? prismaSessionStore(deps.prisma);
  const sessionSecret = sessionSecretFromEnv(deps.sessionSecret);

  return (kind) => async (req, res, next) => {
    const mode = modeFor(kind);
    if (mode === "optional") {
      if (headerPresent(req, WALLET_SESSION_HEADER)) {
        const auth = await authenticateWalletSession(req, {
          secret: sessionSecret,
          store: sessionStore,
          now: deps.now?.() ?? Date.now(),
        });
        if (!auth.ok) {
          res.status(auth.status).json({ error: auth.error });
          return;
        }
        req.wallet = auth.wallet;
        req.walletSessionId = auth.sessionId;
      }
      next();
      return;
    }

    // Uploads are session-only. A signature over an empty multipart body
    // would not cover the file bytes, so it is not an auth path.
    const auth =
      mode === "session-only"
        ? await authenticateWalletSession(req, {
            secret: sessionSecret,
            store: sessionStore,
            now: deps.now?.() ?? Date.now(),
          })
        : mode === "signature" || hasFreshSignature(req)
          ? await authenticateWalletRequest(req, { ...deps, nonceStore })
          : await authenticateWalletSession(req, {
              secret: sessionSecret,
              store: sessionStore,
              now: deps.now?.() ?? Date.now(),
            });
    if (!auth.ok) {
      res.status(auth.status).json({ error: auth.error });
      return;
    }
    req.wallet = auth.wallet;
    req.walletSessionId = auth.sessionId;

    let allowed: Decision;
    try {
      allowed = await authorizeKind(kind, req, auth.wallet, deps);
    } catch (err) {
      deps.log.error({ err }, "Wallet ownership check failed");
      res.status(500).json({ error: "Internal server error" });
      return;
    }
    if (!allowed.ok) {
      res.status(allowed.status).json({ error: allowed.error });
      return;
    }
    auditWrite(res, req, auth.wallet, deps);
    next();
  };
}
