export const DEAL_ROOM_EMPTY_HEADLINE = "This is the deal room";
export const DEAL_ROOM_EMPTY_BODY =
  "Chat here. Lock escrow before you meet. Reputation updates when you both confirm.";
export const DEAL_ROOM_EMPTY_CHIPS = [
  "Still available?",
  "Can we meet today?",
  "Make an offer",
  "More photos?",
] as const;
export const DEAL_ROOM_PLACEHOLDER = "Message about this listing…";
export const LOCK_ESCROW_SHEET_TITLE = "Lock escrow before you meet";
export const LOCK_ESCROW_CTA = "Lock escrow";
export const LOCK_ESCROW_SECONDARY = "Not now";
export const LOCK_ESCROW_SHEET_BODY =
  "Funds stay protected until you both confirm the exchange. Then reputation updates on both wallets.";
export const MEETUP_CARD_TITLE = "Meetup";
export const MEETUP_CONFIRM_CTA = "Confirm meetup";

export type DealListing = {
  id: string;
  seller: string;
  buyer?: string | null;
  price: string | null;
  status: string | null;
  requireEscrow: boolean;
  trackingNumber?: string | null;
  trackingCarrier?: string | null;
  shippedAt?: string | null;
  exchangeConfirmedAt?: string | null;
  onChainConfirmed?: boolean;
  disputeStatus?: string | null;
  disputeReason?: string | null;
  disputeOpenedBy?: string | null;
  disputeOpenedAt?: string | null;
  title?: string | null;
  imageUrl?: string | null;
  createdAt?: string | null;
};

export type DealSale = {
  amount?: string | null;
  createdAt?: string | null;
  txHash?: string | null;
  buyer?: string | null;
  seller?: string | null;
};

export type EscrowBar = {
  label: string;
  detail: string;
  tone: "waiting" | "active" | "complete" | "refunded" | "disputed";
};

const OPEN_DISPUTE = new Set(["OPEN", "OPENED", "PENDING", "ACTIVE", "UNDER_REVIEW"]);

export function listingEscrowLocked(
  listing: Pick<DealListing, "status" | "exchangeConfirmedAt">,
): boolean {
  const status = (listing.status ?? "").toUpperCase();
  if (status === "LOCKED" || status === "SOLD" || status === "COMPLETED") return true;
  return !!listing.exchangeConfirmedAt;
}

export function shouldPromptLockEscrow(
  listing: Pick<DealListing, "seller" | "requireEscrow" | "status" | "exchangeConfirmedAt">,
  viewerAddress: string | null | undefined,
): boolean {
  if (!listing.requireEscrow) return false;
  if (listingEscrowLocked(listing)) return false;
  if (!viewerAddress) return false;
  return listing.seller.toLowerCase() !== viewerAddress.toLowerCase();
}

export type MeetupCard = {
  title: string;
  body: string;
  confirmLabel: string;
  gateLockEscrow: boolean;
};

export function meetupStructuredCard(
  listing: DealListing,
  viewerAddress: string | null | undefined,
): MeetupCard | null {
  const status = (listing.status ?? "").toUpperCase();
  if (listing.shippedAt || listing.trackingNumber) return null;
  if (listing.exchangeConfirmedAt) return null;
  if (status === "SOLD" || status === "COMPLETED") return null;
  return {
    title: MEETUP_CARD_TITLE,
    body: LOCK_ESCROW_SHEET_BODY,
    confirmLabel: MEETUP_CONFIRM_CTA,
    gateLockEscrow: shouldPromptLockEscrow(listing, viewerAddress),
  };
}

function hasOpenDispute(listing: DealListing): boolean {
  const status = (listing.disputeStatus ?? "").trim().toUpperCase();
  if (!status) return false;
  if (status === "NONE" || status === "RESOLVED" || status === "CLOSED") return false;
  return OPEN_DISPUTE.has(status) || !!listing.disputeOpenedAt;
}

export function escrowBarFromListing(
  listing: DealListing,
  sale: DealSale | undefined,
  role: "buyer" | "seller" | "observer",
): EscrowBar {
  if (hasOpenDispute(listing)) {
    return {
      label: "On hold",
      detail: listing.disputeReason?.trim()
        ? listing.disputeReason
        : "A dispute is under review — escrow timers are frozen until it's resolved.",
      tone: "disputed",
    };
  }

  const status = (listing.status ?? "").toUpperCase();
  const shipped = !!(listing.shippedAt || listing.trackingNumber);

  if (status === "SOLD" || status === "COMPLETED" || listing.exchangeConfirmedAt) {
    const amount = sale?.amount ? `${sale.amount} ℏ` : null;
    return {
      label: "Complete",
      detail:
        role === "seller"
          ? amount
            ? `Sale closed · ${amount} released.`
            : "Trade closed."
          : amount
            ? `Trade closed · ${amount}.`
            : "Trade closed.",
      tone: "complete",
    };
  }

  if (shipped) {
    const tracking = listing.trackingNumber
      ? listing.trackingCarrier
        ? `${listing.trackingCarrier} ${listing.trackingNumber}`
        : listing.trackingNumber
      : null;
    return {
      label: "Shipped",
      detail: tracking ? `Tracking ${tracking}.` : "In transit.",
      tone: "active",
    };
  }

  if (status === "LOCKED") {
    return {
      label: "Escrow locked",
      detail:
        role === "seller"
          ? "Funds are locked. Ship and add tracking to keep the deal moving."
          : "Funds are locked in escrow until you confirm the exchange.",
      tone: "active",
    };
  }

  if (listing.requireEscrow) {
    return {
      label: "Escrow not locked",
      detail: "Lock escrow before you meet so both sides are covered.",
      tone: "waiting",
    };
  }

  return {
    label: listing.status || "Listed",
    detail: "No escrow on this listing.",
    tone: "waiting",
  };
}

export type EscrowSystemCard = {
  key: string;
  title: string;
  body: string;
};

export function escrowSystemCards(
  listing: DealListing,
  sale?: DealSale | null,
): EscrowSystemCard[] {
  const cards: EscrowSystemCard[] = [];
  const status = (listing.status ?? "").toUpperCase();
  const locked = listingEscrowLocked(listing) || status === "LOCKED";

  if (locked) {
    const amount = sale?.amount ? ` · ${sale.amount} ℏ` : "";
    cards.push({
      key: "escrow-locked",
      title: "Escrow locked",
      body: `Funds are held on-chain${amount}.`,
    });
  }

  if (listing.shippedAt || listing.trackingNumber) {
    const tracking = listing.trackingNumber
      ? listing.trackingCarrier
        ? `${listing.trackingCarrier} ${listing.trackingNumber}`
        : listing.trackingNumber
      : "In transit";
    cards.push({
      key: "shipped",
      title: "Shipped",
      body: tracking,
    });
  }

  if (listing.exchangeConfirmedAt) {
    cards.push({
      key: "exchange",
      title: "Exchange confirmed",
      body: "Both sides confirmed the meetup or delivery.",
    });
  }

  if (hasOpenDispute(listing)) {
    cards.push({
      key: "dispute",
      title: "Dispute open",
      body: listing.disputeReason?.trim() || "This deal is on hold while Hashpop reviews it.",
    });
  }

  if (status === "SOLD" || status === "COMPLETED") {
    cards.push({
      key: "complete",
      title: "Trade complete",
      body: sale?.amount ? `Closed at ${sale.amount} ℏ.` : "This listing is complete.",
    });
  }

  return cards;
}

export type OfferAction = "accept" | "counter" | "cancel" | "reject";

export function offerCardActions(
  offer: { status: string; buyer: string },
  ctx: { viewer: string; seller: string },
): OfferAction[] {
  if (offer.status.toUpperCase() !== "ACTIVE") return [];
  const viewer = ctx.viewer.toLowerCase();
  const isSeller = viewer === ctx.seller.toLowerCase();
  const isBuyer = viewer === offer.buyer.toLowerCase();
  if (isSeller) return ["accept"];
  if (isBuyer) return ["counter", "cancel"];
  return [];
}
