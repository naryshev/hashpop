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

export const ACTIVITY_LABELS: Record<string, string> = {
  sale: "Sale",
  listing_created: "Listing created",
  listing_updated: "Listing updated",
  offer: "Offer",
  dispute_opened: "Dispute opened",
};
