import { createPublicKey, verify as cryptoVerify } from "node:crypto";
import { ethers } from "ethers";

export const ADMIN_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export type AdminAuthRequest = {
  headers: Record<string, string | string[] | undefined>;
};

export type AdminAuthResult =
  | { ok: true; address: string }
  | { ok: false; error: string; status: number };

const HEDERA_ACCOUNT_RE = /^(\d+)\.(\d+)\.(\d+)$/;

/** `0.0.N` → long-zero-padded EVM alias. Shard/realm are ignored (0.0.N form). */
export function hederaAccountToEvmAlias(accountId: string): string | null {
  const match = accountId.trim().toLowerCase().match(HEDERA_ACCOUNT_RE);
  if (!match) return null;
  return `0x${BigInt(match[3]).toString(16).padStart(40, "0")}`;
}

function normalizeEvmHex(value: string): string | null {
  if (!value.startsWith("0x")) return null;
  const hex = value.slice(2);
  if (!/^[0-9a-f]+$/.test(hex) || hex.length > 40) return null;
  return `0x${hex.padStart(40, "0")}`;
}

/** All comparable forms of one allowlist/candidate entry (lowercase, EVM-padded). */
export function adminIdentityAliases(raw: string): string[] {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return [];
  const aliases = new Set<string>([trimmed]);
  const fromHedera = hederaAccountToEvmAlias(trimmed);
  if (fromHedera) aliases.add(fromHedera);
  const fromEvm = normalizeEvmHex(trimmed);
  if (fromEvm) aliases.add(fromEvm);
  return [...aliases];
}

export function parseAdminAllowlist(raw: string): Set<string> {
  const set = new Set<string>();
  for (const part of raw.split(",")) {
    for (const alias of adminIdentityAliases(part)) set.add(alias);
  }
  return set;
}

export function isAdminAddress(
  addr: string | null | undefined,
  allowlist = process.env.ADMIN_ADDRESSES ?? "",
): boolean {
  if (!addr) return false;
  const allowed = parseAdminAllowlist(allowlist);
  return adminIdentityAliases(addr).some((id) => allowed.has(id));
}

function headerValue(value: string | string[] | undefined): string | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

type DecodedAdminToken =
  | { ok: true; address: string; t: number; signature: string }
  | { ok: false; error: string; status: number };

function decodeAdminToken(req: AdminAuthRequest): DecodedAdminToken {
  const raw = headerValue(req.headers["x-admin-token"]);
  if (!raw) {
    return { ok: false, error: "Missing admin token", status: 401 };
  }
  let parsed: { address?: unknown; t?: unknown; signature?: unknown };
  try {
    parsed = JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
  } catch {
    return { ok: false, error: "Malformed admin token", status: 401 };
  }
  const { address, t, signature } = parsed;
  if (typeof address !== "string" || typeof t !== "number" || typeof signature !== "string") {
    return { ok: false, error: "Malformed admin token", status: 401 };
  }
  return { ok: true, address, t, signature };
}

export type AccountKey = {
  type: "ED25519" | "ECDSA_SECP256K1";
  /** Raw public key hex, without a 0x prefix. */
  key: string;
};

export type AccountKeyFetcher = (address: string) => Promise<AccountKey | null>;

/** HIP-820 / hashconnect `prefixMessageToSign`: JS string length, not UTF-8 byte length. */
export function prefixHederaMessage(message: string): string {
  return `\x19Hedera Signed Message:\n${message.length}${message}`;
}

function hexToBytes(hex: string): Uint8Array | null {
  const raw = hex.trim().toLowerCase().replace(/^0x/, "");
  if (!raw || raw.length % 2 !== 0 || !/^[0-9a-f]+$/.test(raw)) return null;
  return ethers.getBytes(`0x${raw}`);
}

function extractEd25519(hex: string): string | null {
  if (hex.length === 64) return hex;
  if (hex.startsWith("1220") && hex.length === 68) return hex.slice(4);
  const der = "302a300506032b6570032100";
  if (hex.startsWith(der) && hex.length === der.length + 64) return hex.slice(der.length);
  return null;
}

function extractEcdsa(hex: string): string | null {
  if (hex.length === 66) return hex;
  if (hex.startsWith("04") && hex.length === 130) return hex;
  if (hex.length === 128) return `04${hex}`;
  if (hex.startsWith("3a21") && hex.length === 70) return hex.slice(4);
  return null;
}

/** Mirror REST `key` object. Raw hex, protobuf, or SPKI DER. */
export function parseMirrorAccountKey(
  key: { _type?: string; key?: string } | null | undefined,
): AccountKey | null {
  if (!key?._type || !key.key) return null;
  const type = key._type.toUpperCase();
  const hex = key.key.trim().toLowerCase().replace(/^0x/, "");
  if (!/^[0-9a-f]+$/.test(hex)) return null;
  if (type === "ED25519") {
    const raw = extractEd25519(hex);
    return raw ? { type: "ED25519", key: raw } : null;
  }
  if (type === "ECDSA_SECP256K1") {
    const raw = extractEcdsa(hex);
    return raw ? { type: "ECDSA_SECP256K1", key: raw } : null;
  }
  return null;
}

function verifyEd25519(message: Buffer, signature: Uint8Array, publicKey: Uint8Array): boolean {
  if (publicKey.length !== 32 || signature.length !== 64) return false;
  const spki = Buffer.concat([
    Buffer.from("302a300506032b6570032100", "hex"),
    Buffer.from(publicKey),
  ]);
  const key = createPublicKey({ key: spki, format: "der", type: "spki" });
  return cryptoVerify(null, message, key, signature);
}

function verifyEcdsa(message: Buffer, signature: Uint8Array, publicKey: Uint8Array): boolean {
  if (signature.length < 64) return false;
  if (publicKey.length !== 33 && publicKey.length !== 65) return false;
  const digest = ethers.keccak256(message);
  const r = ethers.hexlify(signature.subarray(0, 32));
  const s = ethers.hexlify(signature.subarray(32, 64));
  const expected = ethers.computeAddress(ethers.hexlify(publicKey)).toLowerCase();
  for (const v of [27, 28]) {
    try {
      const recovered = ethers
        .recoverAddress(digest, ethers.Signature.from({ r, s, v }))
        .toLowerCase();
      if (recovered === expected) return true;
    } catch {
      // The other recovery id may still match.
    }
  }
  return false;
}

export function verifyHederaSignedMessage(
  message: string,
  signatureHex: string,
  accountKey: AccountKey,
): boolean {
  const signature = hexToBytes(signatureHex);
  const publicKey = hexToBytes(accountKey.key);
  if (!signature || !publicKey) return false;
  const payload = Buffer.from(prefixHederaMessage(message), "utf8");
  try {
    if (accountKey.type === "ED25519") return verifyEd25519(payload, signature, publicKey);
    if (accountKey.type === "ECDSA_SECP256K1") return verifyEcdsa(payload, signature, publicKey);
    return false;
  } catch {
    return false;
  }
}

const accountKeyCache = new Map<string, { at: number; key: AccountKey | null }>();
const ACCOUNT_KEY_TTL_MS = 10 * 60 * 1000;
const ACCOUNT_KEY_MISS_TTL_MS = 30 * 1000;

export async function fetchAccountKey(
  address: string,
  mirrorBase = process.env.MIRROR_URL || "https://testnet.mirrornode.hedera.com",
): Promise<AccountKey | null> {
  const id = address.trim().toLowerCase();
  const cached = accountKeyCache.get(id);
  const now = Date.now();
  if (cached) {
    const ttl = cached.key ? ACCOUNT_KEY_TTL_MS : ACCOUNT_KEY_MISS_TTL_MS;
    if (now - cached.at < ttl) return cached.key;
  }
  const url = `${mirrorBase.replace(/\/$/, "")}/api/v1/accounts/${encodeURIComponent(id)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
  if (!res.ok) {
    accountKeyCache.set(id, { at: now, key: null });
    return null;
  }
  const body = (await res.json()) as { key?: { _type?: string; key?: string } };
  const key = parseMirrorAccountKey(body.key);
  accountKeyCache.set(id, { at: now, key });
  return key;
}

export function verifyAdminToken(
  req: AdminAuthRequest,
  opts?: { now?: number; allowlist?: string },
): AdminAuthResult {
  const decoded = decodeAdminToken(req);
  if (!decoded.ok) return decoded;
  const now = opts?.now ?? Date.now();
  const ageMs = now - decoded.t;
  if (ageMs < 0 || ageMs > ADMIN_SESSION_TTL_MS) {
    return { ok: false, error: "Admin session expired", status: 401 };
  }
  const message = `hashpop.admin.session:${decoded.t}`;
  let recovered: string;
  try {
    recovered = ethers.verifyMessage(message, decoded.signature).toLowerCase();
  } catch {
    return { ok: false, error: "Invalid admin signature", status: 401 };
  }
  const normalized = decoded.address.toLowerCase();
  if (recovered !== normalized) {
    return { ok: false, error: "Admin signature mismatch", status: 401 };
  }
  const allowlist = opts?.allowlist ?? process.env.ADMIN_ADDRESSES ?? "";
  if (!isAdminAddress(normalized, allowlist)) {
    return { ok: false, error: "Not authorised", status: 403 };
  }
  return { ok: true, address: normalized };
}

/**
 * Production admin check. HashPack signs the HIP-820 prefixed message with the
 * account key, so the signature is verified against the mirror-node key for
 * the claimed address — not `ethers.verifyMessage`.
 */
export async function authenticateAdmin(
  req: AdminAuthRequest,
  opts?: { now?: number; allowlist?: string; fetchKey?: AccountKeyFetcher },
): Promise<AdminAuthResult> {
  const decoded = decodeAdminToken(req);
  if (!decoded.ok) return decoded;
  const now = opts?.now ?? Date.now();
  const ageMs = now - decoded.t;
  if (ageMs < 0 || ageMs > ADMIN_SESSION_TTL_MS) {
    return { ok: false, error: "Admin session expired", status: 401 };
  }
  const normalized = decoded.address.toLowerCase();
  const allowlist = opts?.allowlist ?? process.env.ADMIN_ADDRESSES ?? "";
  if (!isAdminAddress(normalized, allowlist)) {
    return { ok: false, error: "Not authorised", status: 403 };
  }
  const fetchKey = opts?.fetchKey ?? fetchAccountKey;
  let accountKey: AccountKey | null = null;
  try {
    accountKey = await fetchKey(normalized);
  } catch {
    accountKey = null;
  }
  if (!accountKey) {
    return { ok: false, error: "Could not load the wallet key for this account", status: 401 };
  }
  const message = `hashpop.admin.session:${decoded.t}`;
  if (!verifyHederaSignedMessage(message, decoded.signature, accountKey)) {
    return { ok: false, error: "Invalid admin signature", status: 401 };
  }
  return { ok: true, address: normalized };
}
