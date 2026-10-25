"use client";

import { useCallback } from "react";
import { extractHashpackSignature } from "./hashpackSignature";
import { ensureHashpackClient, useHashpackWallet } from "./hashpackWallet";
import { canonicalRequestPath, canonicalWalletAuthMessage, sha256Hex } from "./walletAuthMessage";

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

export function useAuthorizedFetch() {
  const { hashconnect, accountId } = useHashpackWallet();
  return useCallback(
    async (url: string, init?: RequestInit) => {
      if (!accountId) {
        throw new Error("Connect your wallet to continue.");
      }
      const signer =
        (hashconnect as WalletMessageSigner | null) ??
        ((await ensureHashpackClient()) as WalletMessageSigner | null);
      if (!signer) {
        throw new Error("Connect your wallet to continue.");
      }
      return authorizedFetch(url, init, { accountId, signer });
    },
    [hashconnect, accountId],
  );
}
