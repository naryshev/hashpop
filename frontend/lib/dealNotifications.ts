import { formatPriceForDisplay } from "./formatPrice";
import { listingHref } from "./listingUrl";

export const DEAL_UPDATES_EMPTY_TITLE = "No updates yet.";
export const DEAL_UPDATES_EMPTY_BODY = "Offers, escrow, and deal updates land here.";

export const DEAL_UPDATES_SEEN_KEY = "hashpop.activity.seen.v1";
export const DEAL_UPDATES_SEEN_EVENT = "hashpop:activity-seen";

export type DealNotificationKind = "offer" | "escrow" | "meetup" | "ship" | "rating";

export type DealNotification = {
  id: string;
  kind: DealNotificationKind;
  when: Date;
  title: string;
  body: string;
  href?: string;
  urgent: boolean;
};

type OfferRow = {
  id: string;
  listingId?: string | null;
  buyer?: string;
  amount?: string;
  status?: string;
  createdAt?: string;
  listing?: { title?: string | null; seller?: string | null } | null;
};

type SaleRow = {
  id: string;
  listingId?: string | null;
  buyer?: string;
  seller?: string;
  role?: "buyer" | "seller";
  createdAt?: string;
  listing?: {
    title?: string | null;
    status?: string | null;
    shippedAt?: string | null;
    exchangeConfirmedAt?: string | null;
  } | null;
};

type RatingRow = {
  id?: string;
  reviewerAddress: string;
  saleId?: string;
  score: number;
  comment?: string | null;
  createdAt: string;
};

function parseDate(v?: string): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function listingTitle(title?: string | null): string {
  return (title || "listing").trim() || "listing";
}

function amountLabel(amount?: string): string {
  if (!amount) return "";
  return `${formatPriceForDisplay(amount)} ℏ`;
}

export function formatRelativeTime(when: Date, now = new Date()): string {
  const ms = now.getTime() - when.getTime();
  if (!Number.isFinite(ms) || ms < 0) return "just now";
  const sec = Math.floor(ms / 1000);
  if (sec < 45) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return when.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function offerHref(listingId?: string | null): string | undefined {
  return listingId ? listingHref(listingId) : undefined;
}

function saleHref(listingId?: string | null): string | undefined {
  return listingId ? listingHref(listingId) : undefined;
}

/**
 * Deal-actionable inbox only: offers, escrow, meetup/ship, ratings.
 * Chat threads are owned by the messages dock badge — never listed here.
 */
export function buildDealNotifications(input: {
  address: string;
  receivedOffers?: OfferRow[];
  sentOffers?: OfferRow[];
  purchases?: SaleRow[];
  ratings?: RatingRow[];
}): DealNotification[] {
  const me = input.address.trim().toLowerCase();
  const next: DealNotification[] = [];

  for (const o of input.receivedOffers ?? []) {
    const when = parseDate(o.createdAt);
    if (!when) continue;
    const status = (o.status ?? "ACTIVE").toUpperCase();
    if (status === "CANCELLED") continue;
    const title = listingTitle(o.listing?.title);
    const amt = amountLabel(o.amount);
    const on = amt ? `${amt} on ${title}` : title;
    if (status === "ACTIVE") {
      next.push({
        id: `offer-r-${o.id}`,
        kind: "offer",
        when,
        title: "New offer",
        body: on,
        href: offerHref(o.listingId),
        urgent: true,
      });
    } else if (status === "ACCEPTED") {
      next.push({
        id: `offer-r-${o.id}`,
        kind: "offer",
        when,
        title: "Offer accepted",
        body: on,
        href: offerHref(o.listingId),
        urgent: false,
      });
    } else if (status === "REJECTED") {
      next.push({
        id: `offer-r-${o.id}`,
        kind: "offer",
        when,
        title: "Offer declined",
        body: on,
        href: offerHref(o.listingId),
        urgent: false,
      });
    }
  }

  for (const o of input.sentOffers ?? []) {
    const when = parseDate(o.createdAt);
    if (!when) continue;
    const status = (o.status ?? "ACTIVE").toUpperCase();
    if (status !== "ACCEPTED" && status !== "REJECTED") continue;
    const title = listingTitle(o.listing?.title);
    const amt = amountLabel(o.amount);
    const on = amt ? `${amt} on ${title}` : title;
    next.push({
      id: `offer-s-${o.id}`,
      kind: "offer",
      when,
      title: status === "ACCEPTED" ? "Your offer was accepted" : "Your offer was declined",
      body: on,
      href: offerHref(o.listingId),
      urgent: status === "ACCEPTED",
    });
  }

  for (const s of input.purchases ?? []) {
    const listingTitleText = listingTitle(s.listing?.title);
    const isSeller = s.role === "seller";
    const status = (s.listing?.status ?? "").toUpperCase();
    const locked = status === "LOCKED" || status === "SOLD" || status === "COMPLETED";

    const created = parseDate(s.createdAt);
    const awaitingMeetup =
      status === "LOCKED" && !s.listing?.shippedAt && !s.listing?.exchangeConfirmedAt && !!created;

    if (awaitingMeetup) {
      next.push({
        id: `meetup-${s.id}`,
        kind: "meetup",
        when: created!,
        title: "Confirm meetup",
        body: isSeller
          ? `Meet the buyer for ${listingTitleText}`
          : `Meet the seller for ${listingTitleText}`,
        href: saleHref(s.listingId),
        urgent: true,
      });
    } else if (created && locked && !s.listing?.exchangeConfirmedAt && !s.listing?.shippedAt) {
      next.push({
        id: `escrow-${s.id}`,
        kind: "escrow",
        when: created,
        title: "Escrow locked",
        body: listingTitleText,
        href: saleHref(s.listingId),
        urgent: false,
      });
    }

    const shippedAt = parseDate(s.listing?.shippedAt ?? undefined);
    if (shippedAt) {
      next.push({
        id: `ship-${s.id}`,
        kind: "ship",
        when: shippedAt,
        title: isSeller ? "Shipment marked" : "Item shipped",
        body: listingTitleText,
        href: saleHref(s.listingId),
        urgent: !isSeller && !s.listing?.exchangeConfirmedAt,
      });
    }

    const completedAt = parseDate(s.listing?.exchangeConfirmedAt ?? undefined);
    if (completedAt) {
      next.push({
        id: `done-${s.id}`,
        kind: "escrow",
        when: completedAt,
        title: "Escrow released",
        body: listingTitleText,
        href: saleHref(s.listingId),
        urgent: false,
      });
    }
  }

  for (const r of input.ratings ?? []) {
    if (r.reviewerAddress?.toLowerCase() === me) continue;
    const when = parseDate(r.createdAt);
    if (!when) continue;
    const stars = Number.isFinite(r.score) ? `${r.score}-star` : "New";
    next.push({
      id: `rating-${r.id ?? `${r.reviewerAddress}-${r.saleId}`}`,
      kind: "rating",
      when,
      title: "New rating",
      body: r.comment?.trim() ? r.comment.trim() : `${stars} review`,
      href: me ? `/profile/${me}` : undefined,
      urgent: false,
    });
  }

  next.sort((a, b) => b.when.getTime() - a.when.getTime());
  return next;
}

export function unreadDealNotifications(
  items: DealNotification[],
  seenAtMs: number,
): DealNotification[] {
  return items.filter((item) => item.when.getTime() > seenAtMs);
}

export function dealDotTone(unseen: DealNotification[]): "mint" | "red" | null {
  if (unseen.length === 0) return null;
  return unseen.some((item) => item.urgent) ? "red" : "mint";
}

export function readDealUpdatesSeenAt(): number {
  if (typeof window === "undefined") return 0;
  try {
    return Number(window.localStorage.getItem(DEAL_UPDATES_SEEN_KEY) || 0);
  } catch {
    return 0;
  }
}

export function markDealUpdatesSeen(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DEAL_UPDATES_SEEN_KEY, String(Date.now()));
  } catch {
    // ignore — the dot just stays until storage works
  }
  window.dispatchEvent(new Event(DEAL_UPDATES_SEEN_EVENT));
}
