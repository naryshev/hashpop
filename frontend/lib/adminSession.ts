export const ADMIN_TOKEN_KEY = "hashpop.admin.token";
export const ADMIN_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export type AdminToken = { address: string; t: number; signature: string };

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadAdminToken(now = Date.now()): AdminToken | null {
  try {
    const raw = storage()?.getItem(ADMIN_TOKEN_KEY);
    if (!raw) return null;
    const t = JSON.parse(raw) as AdminToken;
    if (
      typeof t?.address !== "string" ||
      typeof t?.t !== "number" ||
      typeof t?.signature !== "string"
    ) {
      return null;
    }
    if (now - t.t > ADMIN_SESSION_TTL_MS) {
      saveAdminToken(null);
      return null;
    }
    return t;
  } catch {
    return null;
  }
}

export function saveAdminToken(t: AdminToken | null) {
  try {
    const s = storage();
    if (!s) return;
    if (t) s.setItem(ADMIN_TOKEN_KEY, JSON.stringify(t));
    else s.removeItem(ADMIN_TOKEN_KEY);
  } catch {
    // ignore quota / private mode
  }
}

export function adminHeader(token: AdminToken): Record<string, string> {
  const encoded =
    typeof window !== "undefined"
      ? window.btoa(JSON.stringify(token))
      : Buffer.from(JSON.stringify(token)).toString("base64");
  return { "x-admin-token": encoded };
}
