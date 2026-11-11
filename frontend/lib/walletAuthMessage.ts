/**
 * Canonical HashPack write-auth payload.
 * Keep in sync with backend/src/walletAuth.ts `canonicalWalletAuthMessage`.
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

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Path + query, without decoding, so it matches Express `originalUrl`. */
export function canonicalRequestPath(url: string): string {
  const withoutOrigin = url.replace(/^https?:\/\/[^/]+/i, "");
  return withoutOrigin.startsWith("/") ? withoutOrigin : `/${withoutOrigin}`;
}
