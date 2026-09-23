/**
 * HashPack 15 desktop approval fails inside the extension, not in our proposal.
 *
 * HashConnect 3.0.13's session proposal sends requiredNamespaces and
 * optionalNamespaces only. It does not set sessionProperties. HashPack
 * approvePairing (extension 15.0.0, gjagmgiddbbciopjhllkdnddhcglnemk) ignores
 * proposal session properties and always approves with:
 *   { publicKey: account.publicKey || null, alias: account.nickname || null }
 * `account.nickname` is the extension Wallet Name on the account selected in
 * the approval popup (Accounts → that account → Wallet Name). It is not
 * profileData.username.name (Customize → NFT Username), which is copied to
 * sessionProperties.username only. A nickname stored on another account, or
 * only in the mobile app, is not this field.
 *
 * WalletConnect rejects a null value:
 *   "sessionProperties must contain an existing value for each key.
 *    Received: null for key alias"
 * That means the selected account object had a falsy `nickname` at approve
 * time (null, missing, or ""). It does not prove the person has no nickname
 * anywhere they can see.
 *
 * The catch path then deletes that proposal from HashPack's in-memory map,
 * so retrying the same pairing URI logs "Proposal not found". The next
 * connect click mints a new URI.
 *
 * User-facing copy must not assert that their nickname is empty.
 */
export const HASHPACK_NICKNAME_REQUIRED_MESSAGE =
  "HashPack failed to approve the WalletConnect session. This is an extension bug in the session alias: HashPack copies the wallet nickname of the account you select in the approval popup, not your social profile username. Confirm that account has a non-empty wallet nickname (Accounts → that account → Wallet Name). Then retry for a new pairing, try another account, or contact HashPack.";

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
