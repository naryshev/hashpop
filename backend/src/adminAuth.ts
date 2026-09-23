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

export function verifyAdminToken(
  req: AdminAuthRequest,
  opts?: { now?: number; allowlist?: string },
): AdminAuthResult {
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
  const now = opts?.now ?? Date.now();
  const ageMs = now - t;
  if (ageMs < 0 || ageMs > ADMIN_SESSION_TTL_MS) {
    return { ok: false, error: "Admin session expired", status: 401 };
  }
  const message = `hashpop.admin.session:${t}`;
  let recovered: string;
  try {
    recovered = ethers.verifyMessage(message, signature).toLowerCase();
  } catch {
    return { ok: false, error: "Invalid admin signature", status: 401 };
  }
  const normalized = address.toLowerCase();
  if (recovered !== normalized) {
    return { ok: false, error: "Admin signature mismatch", status: 401 };
  }
  const allowlist = opts?.allowlist ?? process.env.ADMIN_ADDRESSES ?? "";
  if (!isAdminAddress(normalized, allowlist)) {
    return { ok: false, error: "Not authorised", status: 403 };
  }
  return { ok: true, address: normalized };
}
