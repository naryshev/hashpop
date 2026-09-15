export type TrustStripDensity = "full" | "compact" | "inline";

export const UNKNOWN_ON_HASHPOP = "New on Hashpop";
export const ZERO_DEALS_FULL = "0 completed · Builds with each contract";
export const PROFILE_REVIEWS_OWN_EMPTY = "Your reputation starts with a deal";
export const PROFILE_LISTINGS_EMPTY = "No listings yet";
export const PROFILE_BADGES_EMPTY = "No badges yet";

export type TrustStripInput = {
  density: TrustStripDensity;
  loading?: boolean;
  unknown?: boolean;
  reputationScore?: number;
  totalSales?: number;
  successfulCompletions?: number;
  refunds?: number;
  timeouts?: number;
  kycStatus?: string | null;
  ratingsAvg?: number | null;
  ratingsCount?: number;
  completedBuys?: number;
};

export type TrustStripView = {
  showSkeleton: boolean;
  unknownLabel: string | null;
  completedLine: string | null;
  showRatings: boolean;
  ratingsLabel: string | null;
  showKyc: boolean;
  kycLabel: string | null;
  refundsLabel: string | null;
  timeoutsLabel: string | null;
};

function completedCount(input: TrustStripInput): number {
  return input.successfulCompletions ?? 0;
}

function hasRatings(input: TrustStripInput): boolean {
  return input.ratingsAvg != null && (input.ratingsCount ?? 0) > 0;
}

function isVerifiedKyc(status?: string | null): boolean {
  return (status ?? "").toUpperCase() === "VERIFIED";
}

function inferUnknown(input: TrustStripInput): boolean {
  if (input.unknown === true) return true;
  if (input.unknown === false) return false;
  const deals =
    (input.successfulCompletions ?? 0) + (input.totalSales ?? 0) + (input.completedBuys ?? 0);
  return deals === 0 && !hasRatings(input) && !isVerifiedKyc(input.kycStatus);
}

export function trustStripView(input: TrustStripInput): TrustStripView {
  if (input.loading) {
    return {
      showSkeleton: true,
      unknownLabel: null,
      completedLine: null,
      showRatings: false,
      ratingsLabel: null,
      showKyc: false,
      kycLabel: null,
      refundsLabel: null,
      timeoutsLabel: null,
    };
  }

  const unknown = inferUnknown(input);
  const showRatings = !unknown && hasRatings(input);
  const showKyc = !unknown && isVerifiedKyc(input.kycStatus);
  const completed = completedCount(input);

  let completedLine: string | null = null;
  if (input.density === "full" && !unknown) {
    completedLine = completed === 0 ? ZERO_DEALS_FULL : `${completed} completed`;
  }

  const refunds = input.refunds ?? 0;
  const timeouts = input.timeouts ?? 0;

  return {
    showSkeleton: false,
    unknownLabel: unknown ? UNKNOWN_ON_HASHPOP : null,
    completedLine,
    showRatings,
    ratingsLabel: showRatings
      ? `${Number(input.ratingsAvg).toFixed(1)} (${input.ratingsCount})`
      : null,
    showKyc,
    kycLabel: showKyc ? "KYC verified" : null,
    refundsLabel:
      !unknown && input.density === "full" && refunds > 0
        ? `${refunds} refund${refunds === 1 ? "" : "s"}`
        : null,
    timeoutsLabel:
      !unknown && input.density === "full" && timeouts > 0
        ? `${timeouts} timeout${timeouts === 1 ? "" : "s"}`
        : null,
  };
}

export function shortEvmAddress(address: string): string {
  if (/^\d+\.\d+\.\d+$/.test(address)) return address;
  if (address.startsWith("0x") && address.length === 42) {
    return `${address.slice(0, 6)}…${address.slice(-4)}`;
  }
  return address;
}

/** displayName → HNS (HashPack name) → short 0x. */
export function identityTitle(opts: {
  displayName?: string | null;
  hashpackName?: string | null;
  address: string;
}): string {
  const display = opts.displayName?.trim();
  if (display) return display;
  const hns = opts.hashpackName?.trim();
  if (hns) return hns;
  return shortEvmAddress(opts.address);
}

/** Hedera account id `0.0.x` → long-zero EVM address used as the User.address DB key. */
export function hederaAccountIdToEvm(accountId: string): `0x${string}` {
  const [shardRaw, realmRaw, numRaw] = accountId.split(".");
  const shard = BigInt(shardRaw || "0");
  const realm = BigInt(realmRaw || "0");
  const num = BigInt(numRaw || "0");
  const shardHex = shard.toString(16).padStart(8, "0");
  const realmHex = realm.toString(16).padStart(16, "0");
  const numHex = num.toString(16).padStart(16, "0");
  return `0x${(shardHex + realmHex + numHex).toLowerCase()}` as `0x${string}`;
}

/** Profile route param may be 0x or 0.0.x; APIs key Users by lowercase EVM 0x. */
export function profileAddressKey(raw: string): string {
  const value = (raw ?? "").trim();
  if (/^\d+\.\d+\.\d+$/.test(value)) return hederaAccountIdToEvm(value).toLowerCase();
  return value.toLowerCase();
}
