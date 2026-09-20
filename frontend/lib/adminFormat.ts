export function truncateAdminAddr(addr?: string | null): string {
  if (!addr) return "—";
  if (addr.startsWith("0x") && addr.length === 42) {
    return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
  }
  return addr;
}

export function formatRelativeAge(at: string | Date, now = Date.now()): string {
  const ms = now - new Date(at).getTime();
  if (!Number.isFinite(ms)) return "—";
  const abs = Math.max(0, ms);
  const minutes = Math.floor(abs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export type ListingStatusTone = "mint" | "warning" | "danger" | "silver" | "bright";

export function listingStatusPill(
  status: string,
  onChainConfirmed?: boolean,
  disputeStatus?: string | null,
): { label: string; tone: ListingStatusTone } {
  if (disputeStatus === "OPEN") return { label: "Disputed", tone: "danger" };
  const s = status.toUpperCase();
  if (s === "LOCKED") return { label: "Locked", tone: "bright" };
  if (s === "SOLD") return { label: "Sold", tone: "silver" };
  if (s === "CANCELLED") return { label: "Cancelled", tone: "silver" };
  if (s === "LISTED" && onChainConfirmed === false) return { label: "Pending", tone: "warning" };
  if (s === "LISTED") return { label: "Active", tone: "mint" };
  return { label: status ? status.charAt(0) + status.slice(1).toLowerCase() : "—", tone: "silver" };
}

export type DealStage = "Offered" | "Locked" | "Meetup" | "Complete" | "Disputed";

export function dealStageFromRow(row: {
  status?: string | null;
  disputeStatus?: string | null;
  shippedAt?: string | Date | null;
  exchangeConfirmedAt?: string | Date | null;
}): DealStage {
  if (row.disputeStatus === "OPEN") return "Disputed";
  const s = (row.status ?? "").toUpperCase();
  if (s === "SOLD") return "Complete";
  if (s === "LOCKED" && (row.shippedAt || row.exchangeConfirmedAt)) return "Meetup";
  if (s === "LOCKED") return "Locked";
  return "Offered";
}

export function activitySentence(event: {
  type: string;
  listingTitle?: string | null;
  listingId?: string | null;
  status?: string | null;
  amountHbar?: string | null;
}): string {
  const title = event.listingTitle?.trim() || "Listing";
  switch (event.type) {
    case "sale":
      return event.amountHbar ? `${title} sold · ${event.amountHbar} ℏ` : `${title} sold`;
    case "listing_created":
      return `${title} created`;
    case "listing_updated":
      if (event.status === "LOCKED") return `${title} locked`;
      if (event.status === "SOLD") return `${title} sold`;
      return `${title} updated`;
    case "dispute_opened":
      return `Dispute opened on ${title}`;
    case "offer":
      return event.amountHbar ? `Offer on ${title} · ${event.amountHbar} ℏ` : `Offer on ${title}`;
    case "admin_delete":
      return `Admin deleted ${title}`;
    default:
      return title;
  }
}

export const STATUS_PILL_CLASS: Record<ListingStatusTone, string> = {
  mint: "bg-[#00ffa3]/15 text-[#00ffa3]",
  warning: "bg-warning/15 text-warning",
  danger: "bg-danger/15 text-danger",
  silver: "bg-white/5 text-silver",
  bright: "bg-chrome-bright/15 text-chrome-bright",
};
