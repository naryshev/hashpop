/**
 * HashPack 15 desktop approval fails inside the extension, not in our proposal.
 *
 * HashConnect 3.0.13's session proposal sends requiredNamespaces and
 * optionalNamespaces only. It does not set sessionProperties.
 *
 * HashPack's approvePairing (extension 15.0.0) ignores any dApp session
 * properties and always approves with:
 *   { publicKey: account.publicKey || null, alias: account.nickname || null }
 * WalletConnect rejects a null value:
 *   "sessionProperties must contain an existing value for each key.
 *    Received: null for key alias"
 * The reported key is `alias`, so publicKey was already a string and the
 * wallet nickname was empty. A social profile name is a different field
 * and is not copied into alias.
 *
 * The catch path then deletes that proposal from HashPack's in-memory map,
 * so retrying the same pairing URI logs "Proposal not found". The next
 * connect click has to mint a new URI, and the nickname has to be non-empty
 * before HashPack will approve.
 */
export const HASHPACK_NICKNAME_REQUIRED_MESSAGE =
  "HashPack is installed, but it rejected the session. It sends your wallet nickname as the required alias, and approval fails when that nickname is empty. Set a nickname on the account in HashPack, then connect again.";

export function isHashPackExtensionAnnounce(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const type = (data as { type?: unknown }).type;
  return type === "hashconnect-query-extension-response" || type === "hedera-extension-response";
}

export type DesktopConnectTimeout = "not-detected" | "nickname-required";

/** Extension answered the page, so a silent timeout is an approval failure, not a missing install. */
export function classifyDesktopConnectTimeout(extensionSeen: boolean): DesktopConnectTimeout {
  return extensionSeen ? "nickname-required" : "not-detected";
}
