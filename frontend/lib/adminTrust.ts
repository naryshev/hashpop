export const TRUST_PAGE = {
  title: "Trust & safety",
  sub: "Queues for listings and users that need a decision.",
} as const;

export const TRUST_TABS = [
  { id: "listings", label: "Listings" },
  { id: "users", label: "Users" },
  { id: "disputes", label: "Disputes" },
] as const;

export type TrustTabId = (typeof TRUST_TABS)[number]["id"];

export const TRUST_LISTING_FILTERS = [
  { id: "needs_review", label: "Needs review" },
  { id: "hidden", label: "Hidden" },
  { id: "flagged", label: "Flagged" },
  { id: "all", label: "All" },
] as const;

export type TrustListingFilter = (typeof TRUST_LISTING_FILTERS)[number]["id"];

export const TRUST_EMPTY = {
  listings: {
    title: "No listings in this queue.",
    sub: "Try another filter or clear search.",
  },
  users: {
    title: "No users need review.",
    sub: "Watched and restricted wallets show up here.",
  },
  disputes: {
    title: "No open disputes.",
    sub: "Escrow disputes will land here.",
  },
} as const;

export function trustCountBadge(count: number): number | null {
  return count > 0 ? count : null;
}

export function trustListingActions(moderationStatus: string | null | undefined): {
  view: boolean;
  hide: boolean;
  remove: boolean;
  flag: boolean;
  clear: boolean;
} {
  const status = (moderationStatus ?? "").toUpperCase();
  const hidden = status === "HIDDEN";
  const flagged = status === "FLAGGED";
  return {
    view: true,
    hide: !hidden,
    remove: true,
    flag: !hidden && !flagged,
    clear: hidden || flagged,
  };
}

export function trustReasonLabel(reason: string | null | undefined): string {
  const trimmed = (reason ?? "").trim();
  return trimmed || "—";
}
