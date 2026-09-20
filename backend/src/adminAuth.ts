import { ethers } from "ethers";

export const ADMIN_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export type AdminAuthRequest = {
  headers: Record<string, string | string[] | undefined>;
};

export type AdminAuthResult =
  | { ok: true; address: string }
  | { ok: false; error: string; status: number };

export function isAdminAddress(
  addr: string | null | undefined,
  allowlist = process.env.ADMIN_ADDRESSES ?? "",
): boolean {
  if (!addr) return false;
  const set = new Set(
    allowlist
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
  return set.has(addr.toLowerCase());
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
