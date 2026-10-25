import { generateKeyPairSync, randomUUID, sign as signEd25519 } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import express from "express";
import { SigningKey, Wallet, getBytes, hexlify, keccak256 } from "ethers";
import { prefixHederaMessage, type AccountKey } from "../adminAuth";
import { apiRouter } from "../api";
import {
  authenticateWalletRequest,
  canonicalWalletAuthMessage,
  clearWalletAccountCache,
  fetchMirrorAccount,
  MIRROR_ACCOUNT_CACHE_MS,
  MIRROR_FETCH_TIMEOUT_MS,
  sha256Hex,
  WALLET_AUTH_MAX_AGE_MS,
  type AccountIdentity,
  type NonceStore,
} from "../walletAuth";
import { canonicalListingId } from "../listingId";
import { resolveMirrorBase } from "../mirrorUrl";
import { memorySessionStore, WALLET_SESSION_TTL_MS } from "../walletSession";

const OWNER = `0x${"11".repeat(20)}`;
const BUYER = `0x${"22".repeat(20)}`;
const LISTING = `0x${"ab".repeat(32)}`;
const OWNER_ACCOUNT = "0.0.42";
const BUYER_ACCOUNT = "0.0.99";

const ownerKeys = generateKeyPairSync("ed25519");
const buyerKeys = generateKeyPairSync("ed25519");

function rawEd25519(publicKey: ReturnType<typeof generateKeyPairSync>["publicKey"]): string {
  const der = Buffer.from(publicKey.export({ format: "der", type: "spki" }));
  return der.subarray(der.length - 32).toString("hex");
}

const ownerKey: AccountKey = { type: "ED25519", key: rawEd25519(ownerKeys.publicKey) };
const buyerKey: AccountKey = { type: "ED25519", key: rawEd25519(buyerKeys.publicKey) };

function signHedera(
  privateKey: ReturnType<typeof generateKeyPairSync>["privateKey"],
  message: string,
): string {
  const signature = signEd25519(null, Buffer.from(prefixHederaMessage(message)), privateKey);
  return `0x${signature.toString("hex")}`;
}

let clock = 1_700_000_000_000;

function memoryNonces(): NonceStore {
  const seen = new Set<string>();
  return {
    async consume(nonce) {
      if (seen.has(nonce)) return "replay";
      seen.add(nonce);
      return "ok";
    },
  };
}

const nonceStore = memoryNonces();
const sessionStore = memorySessionStore();
const SESSION_SECRET = "test-wallet-session-secret";

async function fetchAccount(accountId: string): Promise<AccountIdentity | null> {
  if (accountId === OWNER_ACCOUNT) return { key: ownerKey, evmAddress: OWNER };
  if (accountId === BUYER_ACCOUNT) return { key: buyerKey, evmAddress: BUYER };
  return { key: null, evmAddress: null };
}

const listingRow = {
  id: LISTING,
  seller: OWNER,
  buyer: BUYER,
  price: "1",
  status: "LISTED",
  onChainConfirmed: false,
  title: "Hat",
  subtitle: null,
  description: null,
  imageUrl: null,
  mediaUrls: [] as string[],
  requireEscrow: false,
  disputeStatus: null,
  category: null,
  condition: null,
  yearOfProduction: null,
  trackingNumber: null,
  trackingCarrier: null,
  city: null,
  locationLat: null,
  locationLng: null,
  variants: null,
};

const userRow = {
  address: OWNER,
  displayName: null as string | null,
  bio: null as string | null,
  avatarUrl: null as string | null,
  kycStatus: "UNVERIFIED",
  kycSubmittedAt: null as Date | null,
  kycLegalName: null as string | null,
  kycDateOfBirth: null as string | null,
  kycCountry: null as string | null,
  kycIdType: null as string | null,
  kycIdNumber: null as string | null,
  kycAddressLine1: null as string | null,
  kycAddressLine2: null as string | null,
  kycCity: null as string | null,
  kycRegion: null as string | null,
  kycPostalCode: null as string | null,
};

const listingUpserts: Array<{ where?: { id?: string }; create?: { seller?: string } }> = [];
const offerStatusWrites: Array<{ where?: { buyer?: string }; data?: { status?: string } }> = [];

const prisma = {
  listing: {
    findUnique: async () => ({ ...listingRow }),
    findMany: async () => [],
    update: async ({ data }: { data: Record<string, unknown> }) => ({ ...listingRow, ...data }),
    updateMany: async () => ({ count: 1 }),
    upsert: async (args: { where?: { id?: string }; create?: { seller?: string } }) => {
      listingUpserts.push(args);
      return { ...listingRow };
    },
    delete: async () => ({ ...listingRow }),
    count: async () => 0,
  },
  offer: {
    upsert: async () => ({ id: "offer", listingId: LISTING, buyer: OWNER, status: "ACTIVE" }),
    updateMany: async (args: { where?: { buyer?: string }; data?: { status?: string } }) => {
      offerStatusWrites.push(args);
      return { count: 1 };
    },
    findUnique: async () => ({ buyer: OWNER }),
    findMany: async () => [],
  },
  user: {
    upsert: async ({
      create,
      update,
    }: {
      create?: Record<string, unknown>;
      update?: Record<string, unknown>;
    }) => ({
      ...userRow,
      ...(update ?? create),
    }),
    findUnique: async () => ({
      ...userRow,
      kycLegalName: "Ada Lovelace",
      kycAddressLine1: "12 Secret St",
      kycIdNumber: "SECRET-ID",
    }),
    findFirst: async () => null,
  },
  wishlistItem: {
    upsert: async () => ({ id: "w" }),
    deleteMany: async () => ({ count: 1 }),
    findMany: async () => [],
  },
  message: {
    create: async ({ data }: { data: Record<string, unknown> }) => ({
      id: "m",
      createdAt: new Date(),
      ...data,
    }),
    findMany: async () => [],
  },
  shippingAddress: {
    upsert: async ({ create }: { create: Record<string, unknown> }) => ({ id: "s", ...create }),
    findUnique: async () => null,
  },
  sale: {
    findMany: async () => [],
    findUnique: async () => ({
      id: "sale-1",
      buyer: OWNER,
      seller: BUYER,
      listingId: null,
      auctionId: null,
      amount: "1",
    }),
  },
  rating: {
    create: async ({ data }: { data: Record<string, unknown> }) => ({ id: "r", ...data }),
  },
  walletAuditLog: { create: async () => ({ id: "audit" }) },
  authNonce: {
    create: async () => ({}),
    deleteMany: async () => ({ count: 0 }),
  },
};

const log = {
  info() {},
  warn() {},
  error() {},
  debug() {},
};

let server: Server;
let base: string;

function authHeaders(input: {
  method: string;
  path: string;
  body?: unknown;
  accountId?: string;
  privateKey?: ReturnType<typeof generateKeyPairSync>["privateKey"];
  issuedAt?: number;
  nonce?: string;
  bodyHash?: string;
  signature?: string;
}): Record<string, string> {
  const accountId = input.accountId ?? OWNER_ACCOUNT;
  const bodyText = input.body === undefined ? "" : JSON.stringify(input.body);
  const bodyHash = input.bodyHash ?? sha256Hex(bodyText);
  const issuedAt = input.issuedAt ?? clock;
  const nonce = input.nonce ?? randomUUID();
  const message = canonicalWalletAuthMessage({
    accountId,
    method: input.method,
    path: input.path,
    bodyHash,
    issuedAt,
    nonce,
  });
  const signature =
    input.signature ?? signHedera(input.privateKey ?? ownerKeys.privateKey, message);
  const headers: Record<string, string> = {
    "x-hashpop-account": accountId,
    "x-hashpop-issued-at": String(issuedAt),
    "x-hashpop-nonce": nonce,
    "x-hashpop-signature": signature,
  };
  if (input.body !== undefined) headers["content-type"] = "application/json";
  return headers;
}

async function call(
  method: string,
  path: string,
  body?: unknown,
  headers?: Record<string, string>,
): Promise<{ status: number; json: any }> {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

const forgedBody = { sellerAddress: OWNER, title: "forged" };

const coveredRoutes: { method: string; path: string; body?: unknown }[] = [
  { method: "POST", path: "/api/upload-listing-image" },
  { method: "POST", path: "/api/upload-listing-media" },
  {
    method: "POST",
    path: "/api/sync-listing",
    body: { ...forgedBody, seller: OWNER, listingId: LISTING, price: "1" },
  },
  {
    method: "POST",
    path: "/api/sync-price-update",
    body: { ...forgedBody, listingId: LISTING, newPrice: "2" },
  },
  { method: "POST", path: "/api/sync-cancel", body: { ...forgedBody, txHash: "0xabc" } },
  {
    method: "POST",
    path: `/api/listing/${LISTING}/cancel-offchain`,
    body: { ...forgedBody, address: OWNER },
  },
  { method: "POST", path: "/api/sync-purchase", body: { ...forgedBody, listingId: LISTING } },
  {
    method: "POST",
    path: "/api/sync-escrow-complete",
    body: { ...forgedBody, listingId: LISTING },
  },
  {
    method: "POST",
    path: "/api/sync-offer",
    body: { ...forgedBody, listingId: LISTING, buyer: OWNER, amount: "1" },
  },
  {
    method: "POST",
    path: "/api/sync-offer-action",
    body: { ...forgedBody, listingId: LISTING, buyer: BUYER, action: "accept" },
  },
  {
    method: "POST",
    path: `/api/listing/${LISTING}/report`,
    body: { ...forgedBody, reporterAddress: BUYER, reason: "scam" },
  },
  {
    method: "POST",
    path: `/api/listing/${LISTING}/dispute`,
    body: { ...forgedBody, openerAddress: OWNER, reason: "item never arrived" },
  },
  {
    method: "POST",
    path: `/api/listing/${LISTING}/shipping-address`,
    body: {
      ...forgedBody,
      buyerAddress: BUYER,
      name: "Ada Lovelace",
      line1: "12 Computation Ave",
      city: "London",
      postalCode: "SW1A1AA",
      country: "GB",
    },
  },
  { method: "PATCH", path: `/api/listing/${LISTING}`, body: forgedBody },
  {
    method: "POST",
    path: "/api/wishlist",
    body: { ...forgedBody, address: OWNER, itemId: LISTING },
  },
  { method: "DELETE", path: `/api/wishlist?address=${OWNER}&itemId=${LISTING}` },
  { method: "POST", path: "/api/user/register", body: { ...forgedBody, address: OWNER } },
  {
    method: "POST",
    path: "/api/user/public-key",
    body: { ...forgedBody, address: OWNER, publicKey: "pk", signature: "0x11" },
  },
  {
    method: "POST",
    path: "/api/messages",
    body: { ...forgedBody, fromAddress: OWNER, toAddress: BUYER, body: "hello" },
  },
  {
    method: "POST",
    path: "/api/ratings",
    body: {
      ...forgedBody,
      reviewerAddress: OWNER,
      ratedAddress: BUYER,
      saleId: "sale-1",
      score: 5,
      signature: "0x11",
    },
  },
  {
    method: "PATCH",
    path: `/api/user/${OWNER}/profile`,
    body: { ...forgedBody, displayName: "forged" },
  },
];

beforeAll(async () => {
  process.env.SHIPPING_ADDRESS_KEY = "test-shipping-key-16";
  const uploadsDir = mkdtempSync(join(tmpdir(), "hashpop-uploads-"));
  const app = express();
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        (req as express.Request).rawBody = buf;
      },
    }),
  );
  app.use(
    "/api",
    apiRouter(prisma as never, log as never, uploadsDir, {
      now: () => clock,
      fetchAccount,
      nonceStore,
      sessionStore,
      sessionSecret: SESSION_SECRET,
    }),
  );
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  base = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

describe("seller and owner writes require a wallet signature", () => {
  it.each(coveredRoutes)(
    "$method $path rejects a forged sellerAddress with no signature",
    async (route) => {
      const res = await call(route.method, route.path, route.body);
      expect([401, 403]).toContain(res.status);
    },
  );

  it.each(coveredRoutes)("$method $path rejects an invalid signature", async (route) => {
    const headers = authHeaders({
      method: route.method,
      path: route.path,
      body: route.body,
      signature: `0x${"ab".repeat(64)}`,
    });
    const res = await call(route.method, route.path, route.body, headers);
    expect(res.status).toBe(401);
  });

  it("rejects a signature from the wrong account key", async () => {
    const path = `/api/listing/${LISTING}`;
    const body = { sellerAddress: OWNER, title: "nope" };
    const headers = authHeaders({
      method: "PATCH",
      path,
      body,
      accountId: OWNER_ACCOUNT,
      privateKey: buyerKeys.privateKey,
    });
    const res = await call("PATCH", path, body, headers);
    expect(res.status).toBe(401);
  });

  it("rejects a stale timestamp", async () => {
    const path = `/api/listing/${LISTING}`;
    const body = { sellerAddress: OWNER, title: "old" };
    const headers = authHeaders({
      method: "PATCH",
      path,
      body,
      issuedAt: clock - WALLET_AUTH_MAX_AGE_MS - 1_000,
    });
    const res = await call("PATCH", path, body, headers);
    expect(res.status).toBe(401);
    expect(res.json.error).toMatch(/expired/i);
  });

  it("rejects a timestamp in the future", async () => {
    const path = `/api/listing/${LISTING}`;
    const body = { sellerAddress: OWNER, title: "future" };
    const headers = authHeaders({
      method: "PATCH",
      path,
      body,
      issuedAt: clock + 2 * 60 * 1000,
    });
    const res = await call("PATCH", path, body, headers);
    expect(res.status).toBe(401);
    expect(res.json.error).toMatch(/future/i);
  });

  it("rejects a replayed nonce", async () => {
    const path = `/api/listing/${LISTING}`;
    const body = { sellerAddress: OWNER, title: "once" };
    const headers = authHeaders({ method: "PATCH", path, body, nonce: "replay-nonce-test" });
    const first = await call("PATCH", path, body, headers);
    const second = await call("PATCH", path, body, headers);
    expect(first.status).toBe(200);
    expect(second.status).toBe(401);
    expect(second.json.error).toMatch(/replay/i);
  });

  it("rejects a body that does not match the signed hash", async () => {
    const path = `/api/listing/${LISTING}`;
    const body = { sellerAddress: OWNER, title: "real" };
    const headers = authHeaders({
      method: "PATCH",
      path,
      body,
      bodyHash: sha256Hex(JSON.stringify({ sellerAddress: OWNER, title: "other" })),
    });
    const res = await call("PATCH", path, body, headers);
    expect(res.status).toBe(401);
  });

  it("rejects a valid signature from an account that does not own the listing", async () => {
    const path = `/api/listing/${LISTING}`;
    const body = { sellerAddress: OWNER, title: "stolen" };
    const headers = authHeaders({
      method: "PATCH",
      path,
      body,
      accountId: BUYER_ACCOUNT,
      privateKey: buyerKeys.privateKey,
    });
    const res = await call("PATCH", path, body, headers);
    expect(res.status).toBe(403);
  });

  it("accepts a valid owner signature on listing edit", async () => {
    const path = `/api/listing/${LISTING}`;
    const body = { sellerAddress: OWNER, title: "Kept by seller" };
    const headers = authHeaders({ method: "PATCH", path, body });
    const res = await call("PATCH", path, body, headers);
    expect(res.status).toBe(200);
    expect(res.json.listing.title).toBe("Kept by seller");
  });

  it("accepts the owner on the other seller and owner writes", async () => {
    const cases: {
      method: string;
      path: string;
      body?: unknown;
      accountId?: string;
      key?: typeof ownerKeys.privateKey;
      ok: number[];
    }[] = [
      {
        method: "POST",
        path: "/api/sync-listing",
        body: { seller: OWNER, listingId: LISTING, price: "3", title: "synced" },
        ok: [200],
      },
      {
        method: "POST",
        path: "/api/sync-price-update",
        body: { listingId: LISTING, newPrice: "4" },
        ok: [200],
      },
      {
        method: "POST",
        path: `/api/listing/${LISTING}/cancel-offchain`,
        body: { address: OWNER },
        ok: [200],
      },
      {
        method: "POST",
        path: "/api/sync-offer",
        body: { listingId: LISTING, buyer: OWNER, amount: "2" },
        ok: [200],
      },
      {
        method: "POST",
        path: "/api/sync-offer-action",
        body: { listingId: LISTING, buyer: BUYER, action: "accept" },
        ok: [200],
      },
      {
        method: "POST",
        path: "/api/sync-offer-action",
        body: { listingId: LISTING, buyer: OWNER, action: "cancel" },
        ok: [200],
      },
      {
        method: "POST",
        path: `/api/listing/${LISTING}/dispute`,
        body: { openerAddress: OWNER, reason: "item never arrived" },
        ok: [200],
      },
      {
        method: "POST",
        path: `/api/listing/${LISTING}/shipping-address`,
        body: {
          buyerAddress: BUYER,
          name: "Ada Lovelace",
          line1: "12 Computation Ave",
          city: "London",
          postalCode: "SW1A1AA",
          country: "GB",
        },
        accountId: BUYER_ACCOUNT,
        key: buyerKeys.privateKey,
        ok: [200],
      },
      {
        method: "POST",
        path: "/api/wishlist",
        body: { address: OWNER, itemId: LISTING },
        ok: [200],
      },
      { method: "DELETE", path: `/api/wishlist?address=${OWNER}&itemId=${LISTING}`, ok: [200] },
      { method: "POST", path: "/api/user/register", body: { address: OWNER }, ok: [200] },
      {
        method: "POST",
        path: "/api/user/public-key",
        body: { address: OWNER, publicKey: "pk", signature: "0x11" },
        ok: [200],
      },
      {
        method: "POST",
        path: "/api/messages",
        body: { fromAddress: OWNER, toAddress: BUYER, body: "hello" },
        ok: [201],
      },
      {
        method: "POST",
        path: "/api/ratings",
        body: { reviewerAddress: OWNER, ratedAddress: BUYER, saleId: "sale-1", score: 5 },
        ok: [201],
      },
      {
        method: "PATCH",
        path: `/api/user/${OWNER}/profile`,
        body: { displayName: "Ada" },
        ok: [200],
      },
      { method: "POST", path: "/api/upload-listing-image", ok: [400] },
      { method: "POST", path: "/api/upload-listing-media", ok: [400] },
      { method: "POST", path: "/api/sync-purchase", body: { listingId: LISTING }, ok: [400] },
      { method: "POST", path: "/api/sync-cancel", body: {}, ok: [400] },
      {
        method: "POST",
        path: "/api/sync-escrow-complete",
        body: { listingId: LISTING },
        ok: [503],
      },
      {
        method: "POST",
        path: `/api/listing/${LISTING}/report`,
        body: { reporterAddress: BUYER, reason: "scam" },
        accountId: BUYER_ACCOUNT,
        key: buyerKeys.privateKey,
        ok: [503],
      },
    ];

    for (const route of cases) {
      const headers = authHeaders({
        method: route.method,
        path: route.path,
        body: route.body,
        accountId: route.accountId,
        privateKey: route.key,
      });
      if (route.path.includes("upload-listing")) {
        const minted = await call(
          "POST",
          "/api/wallet/session",
          {},
          authHeaders({
            method: "POST",
            path: "/api/wallet/session",
            body: {},
            accountId: route.accountId,
            privateKey: route.key,
          }),
        );
        if (minted.status !== 200) {
          throw new Error(`session mint -> ${minted.status} ${JSON.stringify(minted.json)}`);
        }
        const res = await call(route.method, route.path, route.body, {
          "x-hashpop-session": minted.json.token,
        });
        if (!route.ok.includes(res.status)) {
          throw new Error(
            `${route.method} ${route.path} -> ${res.status} ${JSON.stringify(res.json)}`,
          );
        }
        continue;
      }
      const res = await call(route.method, route.path, route.body, headers);
      if (!route.ok.includes(res.status)) {
        throw new Error(
          `${route.method} ${route.path} -> ${res.status} ${JSON.stringify(res.json)}`,
        );
      }
    }
  });
});

describe("wallet sessions for private reads and frequent writes", () => {
  const privateReads = [
    { method: "GET", path: `/api/listing/${LISTING}/shipping-address?requester=${OWNER}` },
    { method: "GET", path: `/api/messages/inbox?address=${OWNER}` },
    { method: "GET", path: `/api/messages/thread?address=${OWNER}&other=${BUYER}` },
    { method: "GET", path: `/api/wishlist?address=${OWNER}` },
    { method: "GET", path: `/api/user/${OWNER}/offers` },
    { method: "GET", path: `/api/user/${OWNER}/purchases` },
  ];

  const highValue = [
    { method: "PATCH", path: `/api/listing/${LISTING}`, body: { title: "session" } },
    { method: "POST", path: "/api/sync-cancel", body: {} },
    {
      method: "POST",
      path: `/api/listing/${LISTING}/cancel-offchain`,
      body: { address: OWNER },
    },
    {
      method: "POST",
      path: "/api/sync-price-update",
      body: { listingId: LISTING, newPrice: "9" },
    },
    {
      method: "POST",
      path: `/api/listing/${LISTING}/shipping-address`,
      body: {
        buyerAddress: BUYER,
        name: "Ada Lovelace",
        line1: "12 Computation Ave",
        city: "London",
        postalCode: "SW1A1AA",
        country: "GB",
      },
    },
    { method: "PATCH", path: `/api/user/${OWNER}/profile`, body: { displayName: "session" } },
  ];

  async function mint(accountId = OWNER_ACCOUNT, key = ownerKeys.privateKey): Promise<string> {
    const path = "/api/wallet/session";
    const body = {};
    const headers = authHeaders({ method: "POST", path, body, accountId, privateKey: key });
    const res = await call("POST", path, body, headers);
    expect(res.status).toBe(200);
    expect(typeof res.json.token).toBe("string");
    return res.json.token as string;
  }

  it.each(privateReads)("$method $path rejects a forged account with no session", async (route) => {
    const res = await call(route.method, route.path);
    expect(res.status).toBe(401);
  });

  it.each(privateReads)("$method $path rejects a session for the wrong account", async (route) => {
    const token = await mint(BUYER_ACCOUNT, buyerKeys.privateKey);
    const res = await call(route.method, route.path, undefined, { "x-hashpop-session": token });
    expect(res.status).toBe(403);
  });

  it("reads the caller's own inbox and wishlist with a session", async () => {
    const token = await mint();
    const inbox = await call("GET", `/api/messages/inbox?address=${OWNER}`, undefined, {
      "x-hashpop-session": token,
    });
    const wishlist = await call("GET", `/api/wishlist?address=${OWNER}`, undefined, {
      "x-hashpop-session": token,
    });
    expect(inbox.status).toBe(200);
    expect(inbox.json.conversations).toEqual([]);
    expect(wishlist.status).toBe(200);
    expect(wishlist.json.items).toEqual([]);
  });

  it("rejects a tampered session token", async () => {
    const token = await mint();
    const tampered = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`;
    const res = await call("GET", `/api/messages/inbox?address=${OWNER}`, undefined, {
      "x-hashpop-session": tampered,
    });
    expect(res.status).toBe(401);
    expect(res.json.error).toMatch(/invalid/i);
  });

  it("rejects an expired session token", async () => {
    const token = await mint();
    const previous = clock;
    clock = previous + WALLET_SESSION_TTL_MS + 1_000;
    try {
      const res = await call("GET", `/api/wishlist?address=${OWNER}`, undefined, {
        "x-hashpop-session": token,
      });
      expect(res.status).toBe(401);
      expect(res.json.error).toMatch(/expired/i);
    } finally {
      clock = previous;
    }
  });

  it("rejects a session revoked on disconnect", async () => {
    const token = await mint();
    const revoked = await call("DELETE", "/api/wallet/session", undefined, {
      "x-hashpop-session": token,
    });
    expect(revoked.status).toBe(200);
    const res = await call("GET", `/api/user/${OWNER}/purchases`, undefined, {
      "x-hashpop-session": token,
    });
    expect(res.status).toBe(401);
    expect(res.json.error).toMatch(/revoked/i);
  });

  it.each(highValue)("$method $path rejects a session-only request", async (route) => {
    const token = await mint();
    const res = await call(route.method, route.path, route.body, { "x-hashpop-session": token });
    expect(res.status).toBe(401);
    expect(res.json.error).toMatch(/signature/i);
  });

  it("lets a session add a wishlist item", async () => {
    const token = await mint();
    const res = await call(
      "POST",
      "/api/wishlist",
      { address: OWNER, itemId: LISTING },
      { "x-hashpop-session": token },
    );
    expect(res.status).toBe(200);
  });

  it("keeps public pages readable without a wallet", async () => {
    const listings = await call("GET", "/api/listings");
    const listing = await call("GET", `/api/listing/${LISTING}`);
    const profile = await call("GET", `/api/user/${OWNER}/profile`);
    const offers = await call("GET", `/api/listing/${LISTING}/offers`);
    expect(listings.status).not.toBe(401);
    expect(listing.status).toBe(200);
    expect(profile.status).toBe(200);
    expect(profile.json.displayName).toBeNull();
    expect(profile.json.kyc.legalName).toBeUndefined();
    expect(profile.json.kyc.addressLine1).toBeUndefined();
    expect(profile.json.kyc.idNumber).toBeUndefined();
    expect(offers.status).toBe(200);
    expect(offers.json.offers).toEqual([]);
  });

  it("returns KYC only to the profile owner", async () => {
    const owner = await mint();
    const other = await mint(BUYER_ACCOUNT, buyerKeys.privateKey);
    const own = await call("GET", `/api/user/${OWNER}/profile`, undefined, {
      "x-hashpop-session": owner,
    });
    const foreign = await call("GET", `/api/user/${OWNER}/profile`, undefined, {
      "x-hashpop-session": other,
    });
    expect(own.status).toBe(200);
    expect(own.json.kyc.legalName).toBe("Ada Lovelace");
    expect(foreign.status).toBe(200);
    expect(foreign.json.kyc.legalName).toBeUndefined();
  });
});

describe("route matching, listing ids, and offer actions", () => {
  const bypasses = [
    {
      method: "POST",
      path: "/api/Sync-Listing",
      body: { seller: OWNER, listingId: LISTING, price: "1" },
    },
    {
      method: "POST",
      path: "/api/MESSAGES",
      body: { fromAddress: OWNER, toAddress: BUYER, body: "hi" },
    },
    {
      method: "POST",
      path: "/api/messages/",
      body: { fromAddress: OWNER, toAddress: BUYER, body: "hi" },
    },
    {
      method: "POST",
      path: "/api/sync-offer-action/",
      body: { listingId: LISTING, buyer: BUYER, action: "accept" },
    },
    {
      method: "POST",
      path: "/api/sync-offer/",
      body: { listingId: LISTING, buyer: OWNER, amount: "1" },
    },
    { method: "GET", path: `/api/listing/${LISTING}/shipping-address/` },
    { method: "GET", path: "/api/wishlist/" },
    { method: "POST", path: "/api/user/register/", body: { address: OWNER } },
    { method: "POST", path: "/api/upload-listing-image/" },
    { method: "GET", path: `/api/messages/inbox?address=${OWNER}` },
    { method: "GET", path: `/api/messages/thread?address=${OWNER}&other=${BUYER}` },
    { method: "GET", path: `/api/MESSAGES/INBOX?address=${OWNER}` },
  ];

  it.each(bypasses)(
    "$method $path stays behind auth despite case or a trailing slash",
    async (route) => {
      const before = listingUpserts.length;
      const res = await call(route.method, route.path, route.body);
      expect(res.status).toBe(401);
      expect(listingUpserts.length).toBe(before);
      expect(res.json.seller ?? res.json.address ?? res.json.conversations).toBeUndefined();
    },
  );

  it("still checks ownership when the path casing does not match the route string", async () => {
    const path = "/api/Sync-Listing";
    const body = { seller: BUYER, listingId: LISTING, price: "9", title: "stolen" };
    const headers = authHeaders({
      method: "POST",
      path,
      body,
      accountId: BUYER_ACCOUNT,
      privateKey: buyerKeys.privateKey,
    });
    const before = listingUpserts.length;
    const res = await call("POST", path, body, headers);
    expect(res.status).toBe(403);
    expect(listingUpserts.length).toBe(before);
  });

  it("does not let an unprefixed listing id overwrite the seller's row", async () => {
    const bare = LISTING.slice(2);
    expect(bare.startsWith("0x")).toBe(false);
    expect(canonicalListingId(bare)).toBe(LISTING);
    const path = "/api/sync-listing";
    const body = { seller: BUYER, listingId: bare, price: "1", title: "overwrite" };
    const headers = authHeaders({
      method: "POST",
      path,
      body,
      accountId: BUYER_ACCOUNT,
      privateKey: buyerKeys.privateKey,
    });
    const before = listingUpserts.length;
    const res = await call("POST", path, body, headers);
    expect(res.status).toBe(403);
    expect(listingUpserts.length).toBe(before);
  });

  it("syncs an unprefixed id onto the canonical row for the real seller", async () => {
    const path = "/api/sync-listing";
    const body = { seller: OWNER, listingId: LISTING.slice(2), price: "3", title: "same row" };
    const headers = authHeaders({ method: "POST", path, body });
    const res = await call("POST", path, body, headers);
    expect(res.status).toBe(200);
    const written = listingUpserts.at(-1);
    expect(written?.where?.id).toBe(LISTING);
    expect(written?.create?.seller).toBe(OWNER);
  });

  it("rejects a malformed listing id before writing", async () => {
    const path = "/api/sync-listing";
    const body = { seller: OWNER, listingId: `0x${"ab".repeat(31)}`, price: "1" };
    const headers = authHeaders({ method: "POST", path, body });
    const before = listingUpserts.length;
    const res = await call("POST", path, body, headers);
    expect(res.status).toBe(400);
    expect(listingUpserts.length).toBe(before);
  });

  it("rejects an offer action outside accept, reject, and cancel", async () => {
    const path = "/api/sync-offer-action";
    const body = { listingId: LISTING, buyer: BUYER, action: "nope" };
    const headers = authHeaders({ method: "POST", path, body });
    const before = offerStatusWrites.length;
    const res = await call("POST", path, body, headers);
    expect(res.status).toBe(400);
    expect(offerStatusWrites.length).toBe(before);
  });

  it("does not let a non-buyer cancel an offer by naming the buyer in the body", async () => {
    const path = "/api/sync-offer-action";
    const body = { listingId: LISTING, buyer: BUYER, action: "cancel" };
    const headers = authHeaders({
      method: "POST",
      path,
      body,
      accountId: BUYER_ACCOUNT,
      privateKey: buyerKeys.privateKey,
    });
    const before = offerStatusWrites.length;
    const res = await call("POST", path, body, headers);
    expect(res.status).toBe(403);
    expect(offerStatusWrites.length).toBe(before);
  });

  it("reads the session account and ignores a query address", async () => {
    const path = "/api/wallet/session";
    const minted = await call("POST", path, {}, authHeaders({ method: "POST", path, body: {} }));
    expect(minted.status).toBe(200);
    const inbox = await call("GET", `/api/messages/inbox?address=${BUYER}`, undefined, {
      "x-hashpop-session": minted.json.token,
    });
    expect(inbox.status).toBe(403);
    const own = await call("GET", "/api/messages/inbox", undefined, {
      "x-hashpop-session": minted.json.token,
    });
    expect(own.status).toBe(200);
    expect(own.json.conversations).toEqual([]);
    const wishlist = await call("GET", "/api/WISHLIST/", undefined, {
      "x-hashpop-session": minted.json.token,
    });
    expect(wishlist.status).toBe(200);
    expect(wishlist.json.items).toEqual([]);
  });

  it("does not accept an empty-body signature as an upload", async () => {
    const path = "/api/upload-listing-image";
    const headers = authHeaders({ method: "POST", path });
    const signed = await call("POST", path, undefined, headers);
    expect(signed.status).toBe(401);
    const minted = await call(
      "POST",
      "/api/wallet/session",
      {},
      authHeaders({ method: "POST", path: "/api/wallet/session", body: {} }),
    );
    const uploaded = await call("POST", path, undefined, {
      "x-hashpop-session": minted.json.token,
    });
    expect(uploaded.status).toBe(400);
  });
});

describe("mirror account keys", () => {
  it("derives the mirror from HEDERA_NETWORK and refuses a silent testnet default", () => {
    expect(resolveMirrorBase({ HEDERA_NETWORK: "mainnet" })).toBe(
      "https://mainnet.mirrornode.hedera.com",
    );
    expect(resolveMirrorBase({ HEDERA_NETWORK: "testnet" })).toBe(
      "https://testnet.mirrornode.hedera.com",
    );
    expect(resolveMirrorBase({ MIRROR_URL: "https://mirror.example/" })).toBe(
      "https://mirror.example",
    );
    expect(() => resolveMirrorBase({ NODE_ENV: "production" })).toThrow(/MIRROR_URL/);
    expect(() => resolveMirrorBase({})).toThrow(/MIRROR_URL/);
    expect(MIRROR_ACCOUNT_CACHE_MS).toBe(5 * 60 * 1000);
    expect(MIRROR_FETCH_TIMEOUT_MS).toBeLessThan(8_000);
  });

  it("reads ED25519 and ECDSA keys and the evm address from the mirror payload", async () => {
    clearWalletAccountCache();
    const ed = "cd".repeat(32);
    const ecdsa = `02${"ab".repeat(32)}`;
    const fetchMock = vi.fn(async (url: string | URL) => {
      const id = String(url);
      if (id.endsWith("/0.0.7")) {
        return new Response(
          JSON.stringify({ evm_address: OWNER, key: { _type: "ED25519", key: ed } }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({ evm_address: BUYER, key: { _type: "ECDSA_SECP256K1", key: ecdsa } }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    try {
      await expect(fetchMirrorAccount("0.0.7", "https://mirror.test")).resolves.toEqual({
        key: { type: "ED25519", key: ed },
        evmAddress: OWNER,
      });
      clearWalletAccountCache();
      await expect(fetchMirrorAccount("0.0.8", "https://mirror.test")).resolves.toEqual({
        key: { type: "ECDSA_SECP256K1", key: ecdsa },
        evmAddress: BUYER,
      });
    } finally {
      vi.unstubAllGlobals();
      clearWalletAccountCache();
    }
  });

  it("accepts an ECDSA HIP-820 signature for the account key", async () => {
    const wallet = Wallet.createRandom();
    const issuedAt = clock;
    const nonce = "ecdsa-nonce-1";
    const path = "/api/listing/x";
    const bodyHash = sha256Hex("");
    const message = canonicalWalletAuthMessage({
      accountId: "0.0.5",
      method: "POST",
      path,
      bodyHash,
      issuedAt,
      nonce,
    });
    const digest = keccak256(Buffer.from(prefixHederaMessage(message)));
    const signed = wallet.signingKey.sign(digest);
    const compact = Buffer.concat([
      Buffer.from(getBytes(signed.r)),
      Buffer.from(getBytes(signed.s)),
    ]);
    const compressed = SigningKey.computePublicKey(wallet.signingKey.publicKey, true).slice(2);
    const result = await authenticateWalletRequest(
      {
        method: "POST",
        originalUrl: path,
        url: path,
        rawBody: Buffer.alloc(0),
        headers: {
          "x-hashpop-account": "0.0.5",
          "x-hashpop-issued-at": String(issuedAt),
          "x-hashpop-nonce": nonce,
          "x-hashpop-signature": hexlify(compact),
        },
      },
      {
        now: () => clock,
        nonceStore: memoryNonces(),
        fetchAccount: async () => ({
          key: { type: "ECDSA_SECP256K1", key: compressed },
          evmAddress: wallet.address.toLowerCase(),
        }),
      },
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.wallet.aliases).toContain(wallet.address.toLowerCase());
  });
});
