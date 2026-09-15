export type TrustStripDensity = "full" | "compact" | "inline";

export const UNKNOWN_ON_HASHPOP = "New on Hashpop";
export const ZERO_DEALS_FULL = "0 completed · Builds with each contract";
export const PROFILE_LIST_CTA = "List something";

export type ProfileEmptySurface = "noDeals" | "listings" | "reviews" | "badges";

export type ProfileEmptyCopy = {
  headline: string;
  body: string;
  cta?: string;
};

/** Frozen Primaries from p2-copy-empty-states.md. */
export function profileEmptyCopy(surface: ProfileEmptySurface, isSelf: boolean): ProfileEmptyCopy {
  if (surface === "noDeals") {
    return isSelf
      ? {
          headline: "Your reputation starts with a deal",
          body: "List real stuff. Chat in-wallet, lock escrow, meet or ship — then your score travels with you.",
          cta: PROFILE_LIST_CTA,
        }
      : {
          headline: UNKNOWN_ON_HASHPOP,
          body: "Reputation builds with completed deals. Check back after they’ve closed a few.",
        };
  }
  if (surface === "listings") {
    return isSelf
      ? {
          headline: "List real stuff",
          body: "Meetups with a contract. Escrow on your wallet. Settled in HBAR.",
          cta: PROFILE_LIST_CTA,
        }
      : {
          headline: "No listings right now",
          body: "Reputation still travels with this wallet.",
        };
  }
  if (surface === "reviews") {
    return isSelf
      ? {
          headline: "No reviews yet",
          body: "Close a deal, then you and your counterparty can rate each other.",
        }
      : {
          headline: "No reviews yet",
          body: "Reviews appear after completed deals — not before.",
        };
  }
  return {
    headline: "No badges yet",
    body: "Badges show up as you complete deals and verify.",
  };
}

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
  scoreLabel: string | null;
  scoreSize: "large" | "primary" | null;
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
  // Full-density profile: zeros are a known empty wallet, not "unknown".
  // Compact/inline keep inferring New on Hashpop so feeds never show 0.0 (0).
  if (input.density === "full") return false;
  const deals =
    (input.successfulCompletions ?? 0) + (input.totalSales ?? 0) + (input.completedBuys ?? 0);
  return deals === 0 && !hasRatings(input) && !isVerifiedKyc(input.kycStatus);
}

function scoreCue(
  input: TrustStripInput,
  unknown: boolean,
): { scoreLabel: string | null; scoreSize: TrustStripView["scoreSize"] } {
  if (unknown || input.reputationScore == null || input.density === "inline") {
    return { scoreLabel: null, scoreSize: null };
  }
  return {
    scoreLabel: String(input.reputationScore),
    scoreSize: input.density === "full" ? "large" : "primary",
  };
}

export function trustStripView(input: TrustStripInput): TrustStripView {
  if (input.loading) {
    return {
      showSkeleton: true,
      unknownLabel: null,
      completedLine: null,
      scoreLabel: null,
      scoreSize: null,
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
  const { scoreLabel, scoreSize } = scoreCue(input, unknown);

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
    scoreLabel,
    scoreSize,
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
