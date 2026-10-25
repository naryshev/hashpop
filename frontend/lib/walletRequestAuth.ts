"use client";

import { useCallback, useEffect } from "react";
import { getApiUrl } from "./apiUrl";
import { extractHashpackSignature } from "./hashpackSignature";
import { ensureHashpackClient, useHashpackWallet } from "./hashpackWallet";
import { canonicalRequestPath, canonicalWalletAuthMessage, sha256Hex } from "./walletAuthMessage";
import { readWalletAuthToken, writeWalletAuthToken } from "./walletAuthSession";

export type WalletMessageSigner = {
  signMessages: (accountId: string, message: string) => Promise<unknown>;
};

/**
 * Sign a write with the already-paired wallet client.
 * `ensureHashpackClient` is the same lazy dynamic import the wallet provider
 * uses — this module never imports the wallet SDK itself.
 */
export async function authorizedFetch(
  url: string,
  init: RequestInit = {},
  auth: { accountId: string; signer: WalletMessageSigner },
): Promise<Response> {
  const method = (init.method || "GET").toUpperCase();
  const path = canonicalRequestPath(url);
  const bodyText = typeof init.body === "string" ? init.body : "";
  const issuedAt = Date.now();
  const nonce = crypto.randomUUID();
  const message = canonicalWalletAuthMessage({
    accountId: auth.accountId,
    method,
    path,
    bodyHash: await sha256Hex(bodyText),
    issuedAt,
    nonce,
  });
  const signResult = await auth.signer.signMessages(auth.accountId, message);
  const signature = extractHashpackSignature(signResult);
  if (!signature) {
    throw new Error("Could not get a signature from your wallet.");
  }
  const headers = new Headers(init.headers);
  headers.set("x-hashpop-account", auth.accountId);
  headers.set("x-hashpop-issued-at", String(issuedAt));
  headers.set("x-hashpop-nonce", nonce);
  headers.set("x-hashpop-signature", signature);
  return fetch(url, { ...init, method, headers });
}

/**
 * Listing edits, cancels, price changes, shipping addresses, and profile
 * edits. A stolen 24h session must not be enough for these.
 */
export function requiresFreshSignature(method: string, url: string): boolean {
  const path = canonicalRequestPath(url).split("?")[0] ?? "/";
  const verb = method.toUpperCase();
  if (verb === "PATCH" && /^\/api\/listing\/[^/]+$/.test(path)) return true;
  if (verb === "POST" && path === "/api/sync-cancel") return true;
  if (verb === "POST" && /^\/api\/listing\/[^/]+\/cancel-offchain$/.test(path)) return true;
  if (verb === "POST" && path === "/api/sync-price-update") return true;
  if (verb === "POST" && /^\/api\/listing\/[^/]+\/shipping-address$/.test(path)) return true;
  if (verb === "PATCH" && /^\/api\/user\/[^/]+\/profile$/.test(path)) return true;
  return false;
}

const sessionInflight = new Map<string, Promise<string>>();

/**
 * One HashPack signature mints a 24h token. Later reads and frequent writes
 * send that token instead of prompting again. Disconnect revokes it.
 * Trade-off: anyone who can read the token can act as the wallet until it
 * expires or the user disconnects, except on the fresh-signature routes.
 */
export async function ensureWalletAuthSession(
  accountId: string,
  signer: WalletMessageSigner,
): Promise<string> {
  const existing = readWalletAuthToken(accountId);
  if (existing) return existing;
  const pending = sessionInflight.get(accountId);
  if (pending) return pending;
  const job = (async () => {
    const res = await authorizedFetch(
      `${getApiUrl()}/api/wallet/session`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      },
      { accountId, signer },
    );
    if (!res.ok) throw new Error("Could not start a wallet session.");
    const data = (await res.json()) as { token?: string; expiresAt?: number };
    if (!data.token || !data.expiresAt) throw new Error("Could not start a wallet session.");
    writeWalletAuthToken({ token: data.token, accountId, expiresAt: data.expiresAt });
    return data.token;
  })().finally(() => {
    sessionInflight.delete(accountId);
  });
  sessionInflight.set(accountId, job);
  return job;
}

async function signerFor(hashconnect: unknown): Promise<WalletMessageSigner | null> {
  return (
    (hashconnect as WalletMessageSigner | null) ??
    ((await ensureHashpackClient()) as WalletMessageSigner | null)
  );
}

export function useSessionFetch() {
  const { hashconnect, accountId } = useHashpackWallet();
  return useCallback(
    async (url: string, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      if (accountId) {
        const signer = await signerFor(hashconnect);
        if (!signer) throw new Error("Connect your wallet to continue.");
        headers.set("x-hashpop-session", await ensureWalletAuthSession(accountId, signer));
      }
      return fetch(url, { ...init, headers });
    },
    [hashconnect, accountId],
  );
}

export function useAuthorizedFetch() {
  const { hashconnect, accountId } = useHashpackWallet();
  return useCallback(
    async (url: string, init?: RequestInit) => {
      if (!accountId) {
        throw new Error("Connect your wallet to continue.");
      }
      const signer = await signerFor(hashconnect);
      if (!signer) {
        throw new Error("Connect your wallet to continue.");
      }
      const method = (init?.method || "GET").toUpperCase();
      if (requiresFreshSignature(method, url)) {
        return authorizedFetch(url, init, { accountId, signer });
      }
      const headers = new Headers(init?.headers);
      headers.set("x-hashpop-session", await ensureWalletAuthSession(accountId, signer));
      return fetch(url, { ...init, method, headers });
    },
    [hashconnect, accountId],
  );
}

/**
 * Mints the 24h session once the wallet is paired. Signed-out pages never
 * call this, so marketplace, listing, profile, and help do not prompt.
 */
export function WalletAuthSessionKeeper() {
  const { accountId, hashconnect, isConnected } = useHashpackWallet();
  useEffect(() => {
    if (!isConnected || !accountId || !hashconnect) return;
    void ensureWalletAuthSession(accountId, hashconnect as unknown as WalletMessageSigner).catch(
      () => {},
    );
  }, [isConnected, accountId, hashconnect]);
  return null;
}
