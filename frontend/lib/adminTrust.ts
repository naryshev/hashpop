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

export const TRUST_SEARCH_PLACEHOLDER = "Search id, title, wallet…";

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

export const TRUST_SEARCH_MISS = {
  title: "Nothing matches.",
  sub: "Check the id or try another filter.",
} as const;

export function trustCountBadge(count: number): number | null {
  return count > 0 ? count : null;
}

export type TrustStatusTone = "mint" | "silver" | "danger";

/** Queue status comes from moderation visibility, not the marketplace pill. */
export function trustStatusPill(moderationStatus: string | null | undefined): {
  label: "Live" | "Hidden" | "Removed";
  tone: TrustStatusTone;
} {
  const status = (moderationStatus ?? "").toUpperCase();
  if (status === "REMOVED") return { label: "Removed", tone: "danger" };
  if (status === "HIDDEN") return { label: "Hidden", tone: "silver" };
  return { label: "Live", tone: "mint" };
}

export type TrustReasonTone = "warning" | "danger" | "silver";

/** Reason chips. Unknown or empty codes stay Pending review — never free text. */
export function trustReasonChip(code: string | null | undefined): {
  label: "Pending review" | "Flagged" | "Report" | "Manual";
  tone: TrustReasonTone;
} {
  switch ((code ?? "").toUpperCase()) {
    case "FLAGGED":
      return { label: "Flagged", tone: "warning" };
    case "REPORT":
      return { label: "Report", tone: "danger" };
    case "MANUAL":
      return { label: "Manual", tone: "silver" };
    default:
      return { label: "Pending review", tone: "warning" };
  }
}

export function trustListingActions(
  moderationStatus: string | null | undefined,
  moderationReason?: string | null,
): {
  view: boolean;
  hide: boolean;
  remove: boolean;
  flag: boolean;
  flagActive: boolean;
  clear: boolean;
} {
  const status = (moderationStatus ?? "").toUpperCase();
  const reason = (moderationReason ?? "").toUpperCase();
  const hidden = status === "HIDDEN";
  const removed = status === "REMOVED";
  const flagged = reason === "FLAGGED";
  const marked =
    hidden ||
    removed ||
    flagged ||
    reason === "MANUAL" ||
    reason === "REPORT" ||
    reason === "PENDING_REVIEW";
  return {
    view: true,
    hide: !hidden && !removed,
    remove: !removed,
    flag: true,
    flagActive: flagged,
    clear: marked,
  };
}
