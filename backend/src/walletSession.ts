import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Request } from "express";
import type { WalletAuthResult, WalletIdentity } from "./walletAuth";

/** A session stands in for a HashPack prompt for this long. */
export const WALLET_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export const WALLET_SESSION_HEADER = "x-hashpop-session";

export type SessionRow = {
  accountId: string;
  expiresAt: Date;
};

export type SessionStore = {
  save(row: { id: string; accountId: string; expiresAt: Date }): Promise<void>;
  get(id: string): Promise<SessionRow | null>;
  revoke(id: string): Promise<void>;
};

type SessionPayload = {
  v: 1;
  sid: string;
  accountId: string;
  evmAddress: string;
  aliases: string[];
  exp: number;
};

type SessionDelegate = {
  walletSession: {
    deleteMany(args: { where: { expiresAt: { lt: Date } } }): Promise<unknown>;
    upsert(args: {
      where: { id: string };
      create: { id: string; accountId: string; expiresAt: Date };
      update: { accountId: string; expiresAt: Date };
    }): Promise<unknown>;
    findUnique(args: { where: { id: string } }): Promise<SessionRow | null>;
    delete(args: { where: { id: string } }): Promise<unknown>;
  };
};

function headerValue(value: string | string[] | undefined): string | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function sessionSecretFromEnv(explicit?: string): string {
  const value = (explicit ?? process.env.WALLET_SESSION_SECRET ?? "").trim();
  return value;
}

export function issueWalletSessionToken(
  wallet: WalletIdentity,
  sid: string,
  expiresAtMs: number,
  secret: string,
): string {
  const body: SessionPayload = {
    v: 1,
    sid,
    accountId: wallet.accountId,
    evmAddress: wallet.evmAddress,
    aliases: wallet.aliases,
    exp: expiresAtMs,
  };
  const payload = Buffer.from(JSON.stringify(body)).toString("base64url");
  return `${payload}.${signPayload(payload, secret)}`;
}

/**
 * Read the account a session token claims, without checking the signature.
 * Used only so a rejected request can be attributed. Never log `token`.
 */
export function peekWalletSessionAccount(
  token: string,
): { accountId: string; evmAddress: string | null } | null {
  const payload = token.split(".")[0];
  if (!payload || token.split(".").length !== 2) return null;
  try {
    const body = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      accountId?: unknown;
      evmAddress?: unknown;
    };
    if (typeof body.accountId !== "string" || !body.accountId.trim()) return null;
    const evmAddress = typeof body.evmAddress === "string" ? body.evmAddress : null;
    return { accountId: body.accountId.trim(), evmAddress };
  } catch {
    return null;
  }
}

export function readWalletSessionToken(
  token: string,
  secret: string,
  now: number,
): { ok: true; payload: SessionPayload } | { ok: false; status: number; error: string } {
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { ok: false, status: 401, error: "Wallet session invalid" };
  }
  const [payload, sig] = parts;
  const expected = signPayload(payload, secret);
  const got = Buffer.from(sig);
  const want = Buffer.from(expected);
  if (got.length !== want.length || !timingSafeEqual(got, want)) {
    return { ok: false, status: 401, error: "Wallet session invalid" };
  }
  let body: SessionPayload;
  try {
    body = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionPayload;
  } catch {
    return { ok: false, status: 401, error: "Wallet session invalid" };
  }
  if (
    body.v !== 1 ||
    !body.sid ||
    !body.accountId ||
    !body.evmAddress ||
    !Array.isArray(body.aliases)
  ) {
    return { ok: false, status: 401, error: "Wallet session invalid" };
  }
  if (!Number.isFinite(body.exp) || body.exp <= now) {
    return { ok: false, status: 401, error: "Wallet session expired" };
  }
  return { ok: true, payload: body };
}

export async function createWalletSession(
  wallet: WalletIdentity,
  store: SessionStore,
  secret: string,
  now: number,
): Promise<{ token: string; expiresAt: number; sid: string }> {
  const sid = randomBytes(16).toString("base64url");
  const expiresAt = now + WALLET_SESSION_TTL_MS;
  await store.save({ id: sid, accountId: wallet.accountId, expiresAt: new Date(expiresAt) });
  return {
    sid,
    expiresAt,
    token: issueWalletSessionToken(wallet, sid, expiresAt, secret),
  };
}

export async function authenticateWalletSession(
  req: Pick<Request, "headers">,
  opts: { secret: string; store: SessionStore; now: number },
): Promise<WalletAuthResult & { sessionId?: string }> {
  const token = headerValue(req.headers[WALLET_SESSION_HEADER])?.trim() ?? "";
  if (!token) return { ok: false, status: 401, error: "Wallet session required" };
  if (!opts.secret) return { ok: false, status: 401, error: "Wallet session required" };
  const verified = readWalletSessionToken(token, opts.secret, opts.now);
  if (!verified.ok) return verified;
  let row: SessionRow | null = null;
  try {
    row = await opts.store.get(verified.payload.sid);
  } catch {
    return { ok: false, status: 500, error: "Could not load wallet session" };
  }
  if (!row || row.accountId !== verified.payload.accountId) {
    return { ok: false, status: 401, error: "Wallet session revoked" };
  }
  if (row.expiresAt.getTime() <= opts.now) {
    return { ok: false, status: 401, error: "Wallet session expired" };
  }
  return {
    ok: true,
    sessionId: verified.payload.sid,
    wallet: {
      accountId: verified.payload.accountId,
      evmAddress: verified.payload.evmAddress,
      aliases: verified.payload.aliases.map((alias) => alias.toLowerCase()),
    },
  };
}

export function prismaSessionStore(prisma: SessionDelegate): SessionStore {
  return {
    async save(row) {
      await prisma.walletSession.deleteMany({ where: { expiresAt: { lt: new Date() } } });
      await prisma.walletSession.upsert({
        where: { id: row.id },
        create: row,
        update: { accountId: row.accountId, expiresAt: row.expiresAt },
      });
    },
    async get(id) {
      return prisma.walletSession.findUnique({ where: { id } });
    },
    async revoke(id) {
      await prisma.walletSession.delete({ where: { id } }).catch(() => undefined);
    },
  };
}

export function memorySessionStore(): SessionStore {
  const rows = new Map<string, SessionRow>();
  return {
    async save(row) {
      rows.set(row.id, { accountId: row.accountId, expiresAt: row.expiresAt });
    },
    async get(id) {
      return rows.get(id) ?? null;
    },
    async revoke(id) {
      rows.delete(id);
    },
  };
}
