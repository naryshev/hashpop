import { createHash } from "node:crypto";
import type { Request } from "express";
import { ethers } from "ethers";
import {
  hederaAccountToEvmAlias,
  parseMirrorAccountKey,
  verifyHederaSignedMessage,
  type AccountKey,
} from "./adminAuth";

/** Messages older than this are rejected. */
export const WALLET_AUTH_MAX_AGE_MS = 5 * 60 * 1000;
/** Small clock skew. Timestamps further ahead than this are rejected. */
export const WALLET_AUTH_FUTURE_SKEW_MS = 30 * 1000;
const ACCOUNT_CACHE_MS = 60 * 1000;
const ACCOUNT_MISS_CACHE_MS = 15 * 1000;
const HEDERA_ACCOUNT_RE = /^\d+\.\d+\.\d+$/;

export type WalletIdentity = {
  accountId: string;
  /** Mirror `evm_address`, or the long-zero alias when the mirror omits one. */
  evmAddress: string;
  /** Every comparable form (EVM, long-zero, account id), lowercase. */
  aliases: string[];
};

export type AccountIdentity = {
  key: AccountKey | null;
  evmAddress: string | null;
};

export type AccountIdentityFetcher = (accountId: string) => Promise<AccountIdentity | null>;

export type NonceStore = {
  /** Persist a nonce until `expiresAt`. Return `replay` if it was already stored. */
  consume(nonce: string, accountId: string, expiresAt: Date): Promise<"ok" | "replay">;
};

export type WalletAuthFailure = { ok: false; status: number; error: string };
export type WalletAuthSuccess = { ok: true; wallet: WalletIdentity };
export type WalletAuthResult = WalletAuthSuccess | WalletAuthFailure;

export type WalletGuardDeps = {
  now?: () => number;
  fetchAccount?: AccountIdentityFetcher;
  nonceStore?: NonceStore;
};

declare global {
  namespace Express {
    interface Request {
      rawBody?: Buffer;
      wallet?: WalletIdentity;
    }
  }
}

/**
 * Canonical signed payload. Keep in sync with frontend/lib/walletAuthMessage.ts.
 * Lines are separated by `\n` and contain no extra whitespace.
 */
export function canonicalWalletAuthMessage(input: {
  accountId: string;
  method: string;
  path: string;
  bodyHash: string;
  issuedAt: number;
  nonce: string;
}): string {
  return [
    "hashpop.wallet.v1",
    `account:${input.accountId}`,
    `method:${input.method.toUpperCase()}`,
    `path:${input.path}`,
    `body:${input.bodyHash}`,
    `iat:${input.issuedAt}`,
    `nonce:${input.nonce}`,
  ].join("\n");
}

export function sha256Hex(bytes: Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Path + query exactly as the client requested it (`req.originalUrl`). */
export function canonicalServerPath(req: Pick<Request, "originalUrl" | "url">): string {
  const raw = req.originalUrl || req.url || "/";
  return raw.startsWith("/") ? raw : `/${raw}`;
}

export function walletOwns(wallet: WalletIdentity, value: string | null | undefined): boolean {
  if (!value) return false;
  return wallet.aliases.includes(value.trim().toLowerCase());
}

/** Prefer the caller's claimed form when it is one of this wallet's aliases. */
export function preferredWalletAddress(wallet: WalletIdentity, claimed?: string | null): string {
  if (claimed && walletOwns(wallet, claimed)) return claimed.trim().toLowerCase();
  return wallet.evmAddress;
}

function headerValue(value: string | string[] | undefined): string | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function aliasesFor(
  accountId: string,
  evmAddress: string | null,
  key: AccountKey | null,
): string[] {
  const aliases = new Set<string>();
  aliases.add(accountId.trim().toLowerCase());
  const longZero = hederaAccountToEvmAlias(accountId);
  if (longZero) aliases.add(longZero);
  if (evmAddress && /^0x[0-9a-f]{40}$/.test(evmAddress)) aliases.add(evmAddress);
  if (key?.type === "ECDSA_SECP256K1") {
    try {
      const hex = key.key.startsWith("0x") ? key.key : `0x${key.key}`;
      aliases.add(ethers.computeAddress(hex).toLowerCase());
    } catch {
      // Unparseable key material simply contributes no extra alias.
    }
  }
  return [...aliases];
}

function primaryEvm(
  accountId: string,
  evmAddress: string | null,
  key: AccountKey | null,
): string | null {
  if (evmAddress && /^0x[0-9a-f]{40}$/.test(evmAddress)) return evmAddress;
  if (key?.type === "ECDSA_SECP256K1") {
    try {
      const hex = key.key.startsWith("0x") ? key.key : `0x${key.key}`;
      return ethers.computeAddress(hex).toLowerCase();
    } catch {
      // fall through to the long-zero alias
    }
  }
  return hederaAccountToEvmAlias(accountId);
}

const accountCache = new Map<string, { at: number; value: AccountIdentity | null }>();

export function clearWalletAccountCache(): void {
  accountCache.clear();
}

/** Mirror `/api/v1/accounts/{id}` with a short cache. Handles ED25519 and ECDSA keys. */
export async function fetchMirrorAccount(
  accountId: string,
  mirrorBase = process.env.MIRROR_URL || "https://testnet.mirrornode.hedera.com",
): Promise<AccountIdentity | null> {
  const id = accountId.trim();
  const cacheKey = id.toLowerCase();
  const cached = accountCache.get(cacheKey);
  const now = Date.now();
  if (cached) {
    const ttl = cached.value?.key ? ACCOUNT_CACHE_MS : ACCOUNT_MISS_CACHE_MS;
    if (now - cached.at < ttl) return cached.value;
  }
  const url = `${mirrorBase.replace(/\/$/, "")}/api/v1/accounts/${encodeURIComponent(id)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
  if (!res.ok) {
    const miss = { key: null, evmAddress: null };
    accountCache.set(cacheKey, { at: now, value: miss });
    return miss;
  }
  const body = (await res.json()) as {
    evm_address?: string;
    key?: { _type?: string; key?: string };
  };
  let evmAddress: string | null = null;
  if (typeof body.evm_address === "string" && body.evm_address.trim()) {
    const raw = body.evm_address.trim().toLowerCase();
    const hex = raw.startsWith("0x") ? raw : `0x${raw}`;
    if (/^0x[0-9a-f]{40}$/.test(hex)) evmAddress = hex;
  }
  const value = { key: parseMirrorAccountKey(body.key), evmAddress };
  accountCache.set(cacheKey, { at: now, value });
  return value;
}

export async function authenticateWalletRequest(
  req: Pick<Request, "headers" | "method" | "originalUrl" | "url" | "rawBody">,
  deps?: WalletGuardDeps,
): Promise<WalletAuthResult> {
  const accountId = headerValue(req.headers["x-hashpop-account"])?.trim() ?? "";
  const signature = headerValue(req.headers["x-hashpop-signature"])?.trim() ?? "";
  const issuedRaw = headerValue(req.headers["x-hashpop-issued-at"])?.trim() ?? "";
  const nonce = headerValue(req.headers["x-hashpop-nonce"])?.trim() ?? "";
  if (!accountId || !signature || !issuedRaw || !nonce) {
    return { ok: false, status: 401, error: "Wallet signature required" };
  }
  if (!HEDERA_ACCOUNT_RE.test(accountId)) {
    return { ok: false, status: 401, error: "Wallet signature required" };
  }
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(nonce)) {
    return { ok: false, status: 401, error: "Wallet signature required" };
  }
  if (!/^\d+$/.test(issuedRaw)) {
    return { ok: false, status: 401, error: "Wallet signature required" };
  }
  const issuedAt = Number(issuedRaw);
  const now = deps?.now?.() ?? Date.now();
  if (issuedAt > now + WALLET_AUTH_FUTURE_SKEW_MS) {
    return { ok: false, status: 401, error: "Wallet signature timestamp is in the future" };
  }
  if (now - issuedAt > WALLET_AUTH_MAX_AGE_MS) {
    return { ok: false, status: 401, error: "Wallet signature expired" };
  }

  const bodyHash = sha256Hex(req.rawBody ?? Buffer.alloc(0));
  const path = canonicalServerPath(req);
  const message = canonicalWalletAuthMessage({
    accountId,
    method: req.method || "GET",
    path,
    bodyHash,
    issuedAt,
    nonce,
  });

  const fetchAccount = deps?.fetchAccount ?? fetchMirrorAccount;
  let identity: AccountIdentity | null = null;
  try {
    identity = await fetchAccount(accountId);
  } catch {
    identity = null;
  }
  if (!identity?.key) {
    return { ok: false, status: 401, error: "Could not load the wallet key for this account" };
  }
  if (!verifyHederaSignedMessage(message, signature, identity.key)) {
    return { ok: false, status: 401, error: "Invalid wallet signature" };
  }

  const nonceStore = deps?.nonceStore;
  if (nonceStore) {
    const expiresAt = new Date(issuedAt + WALLET_AUTH_MAX_AGE_MS + WALLET_AUTH_FUTURE_SKEW_MS);
    let consumed: "ok" | "replay";
    try {
      consumed = await nonceStore.consume(nonce, accountId, expiresAt);
    } catch {
      return { ok: false, status: 500, error: "Could not store wallet nonce" };
    }
    if (consumed === "replay") {
      return { ok: false, status: 401, error: "Wallet signature replayed" };
    }
  }

  const evmAddress = primaryEvm(accountId, identity.evmAddress, identity.key);
  if (!evmAddress) {
    return { ok: false, status: 401, error: "Could not derive an address for this account" };
  }

  return {
    ok: true,
    wallet: {
      accountId,
      evmAddress,
      aliases: aliasesFor(accountId, evmAddress, identity.key),
    },
  };
}

type NonceDelegate = {
  authNonce: {
    deleteMany(args: { where: { expiresAt: { lt: Date } } }): Promise<unknown>;
    create(args: { data: { nonce: string; accountId: string; expiresAt: Date } }): Promise<unknown>;
  };
};

export function prismaNonceStore(prisma: NonceDelegate): NonceStore {
  return {
    async consume(nonce, accountId, expiresAt) {
      await prisma.authNonce.deleteMany({ where: { expiresAt: { lt: new Date() } } });
      try {
        await prisma.authNonce.create({ data: { nonce, accountId, expiresAt } });
        return "ok";
      } catch (err) {
        const code = (err as { code?: string } | null)?.code;
        if (code === "P2002") return "replay";
        throw err;
      }
    },
  };
}
