import { getApiUrl } from "./apiUrl";

/** Separate from the HashPack pairing record in hashpackWallet. */
const AUTH_STORAGE_KEY = "hashpop.wallet.auth.v1";

type StoredAuth = {
  token: string;
  accountId: string;
  expiresAt: number;
};

export function readWalletAuthToken(accountId?: string | null): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredAuth;
    if (!parsed?.token || !parsed.expiresAt) return null;
    if (accountId && parsed.accountId !== accountId) return null;
    if (parsed.expiresAt <= Date.now() + 60_000) return null;
    return parsed.token;
  } catch {
    return null;
  }
}

export function writeWalletAuthToken(session: StoredAuth): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Storage can be blocked; the in-memory caller still holds the token.
  }
}

export function clearWalletAuthToken(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    // no-op
  }
}

/** Best-effort revoke. The local token is dropped even if the server is unreachable. */
export async function revokeWalletAuthSession(): Promise<void> {
  const token = readWalletAuthToken();
  clearWalletAuthToken();
  if (!token) return;
  try {
    await fetch(`${getApiUrl()}/api/wallet/session`, {
      method: "DELETE",
      headers: { "x-hashpop-session": token },
    });
  } catch {
    // Disconnect still forgets the token locally.
  }
}
