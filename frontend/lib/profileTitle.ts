import { shortEvmAddress } from "./trustStrip";

const ACCOUNT_ID = /^\d+\.\d+\.\d+$/;

export type ProfileTitleKind = "name" | "address";

/**
 * Centered profile title. HashPack .h / HNS name when the wallet has one,
 * otherwise the Hedera account id, otherwise a truncated EVM address.
 */
export function profileHeaderTitle(opts: {
  hashpackName?: string | null;
  accountId?: string | null;
  address: string;
}): { text: string; kind: ProfileTitleKind } {
  const hns = opts.hashpackName?.trim();
  if (hns) return { text: hns, kind: "name" };
  const accountId = opts.accountId?.trim();
  if (accountId && ACCOUNT_ID.test(accountId)) return { text: accountId, kind: "address" };
  const address = opts.address.trim();
  if (ACCOUNT_ID.test(address)) return { text: address, kind: "address" };
  return { text: shortEvmAddress(address), kind: "address" };
}

/**
 * Custom display name shown above the bio. Omitted when empty, and when it
 * repeats the .h name already in the title.
 */
export function profileCustomName(opts: {
  displayName?: string | null;
  hashpackName?: string | null;
}): string | null {
  const display = opts.displayName?.trim();
  if (!display) return null;
  const hns = opts.hashpackName?.trim();
  if (hns && display.toLowerCase() === hns.toLowerCase()) return null;
  return display;
}
