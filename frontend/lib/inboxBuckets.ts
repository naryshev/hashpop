export type InboxTab = "buying" | "selling" | "direct" | "offers";

export type InboxBucketConversation = {
  listingId: string | null;
  preview: string;
  lastMessage: { createdAt: string };
};

export type InboxListingPreview = {
  seller?: string | null;
};

/**
 * Buying vs Selling is the listing's seller, which arrives after the inbox.
 * Until that preview settles, a thread must not be painted on either tab —
 * otherwise every unresolved listing row lands on Buying and Selling threads
 * flash there.
 */
export function bucketInboxConversations<T extends InboxBucketConversation>(
  conversations: readonly T[],
  listingPreviews: Readonly<Record<string, InboxListingPreview | undefined>>,
  failedListingIds: ReadonlySet<string>,
  address: string | null | undefined,
): { buckets: Record<InboxTab, T[]>; rolePending: boolean } {
  const myAddr = (address ?? "").toLowerCase();
  const buckets: Record<InboxTab, T[]> = {
    buying: [],
    selling: [],
    direct: [],
    offers: [],
  };
  let rolePending = false;

  for (const conversation of conversations) {
    if (/\boffer\b/i.test(conversation.preview ?? "")) {
      buckets.offers.push(conversation);
      continue;
    }
    if (!conversation.listingId) {
      buckets.direct.push(conversation);
      continue;
    }

    const preview = listingPreviews[conversation.listingId];
    if (!preview) {
      if (!failedListingIds.has(conversation.listingId)) {
        rolePending = true;
        continue;
      }
      // Seller stayed unknown after the listing fetch failed. Keep the old
      // steady state (Buying) so the thread is not dropped.
      buckets.buying.push(conversation);
      continue;
    }

    if (myAddr && preview.seller?.toLowerCase() === myAddr) buckets.selling.push(conversation);
    else buckets.buying.push(conversation);
  }

  const byRecency = (a: T, b: T) =>
    new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime();
  (Object.keys(buckets) as InboxTab[]).forEach((tab) => buckets[tab].sort(byRecency));

  return { buckets, rolePending };
}

export type InboxListPhase = "loading" | "empty-inbox" | "empty-tab" | "rows";

/**
 * Buying/Selling stay on the loading phase while any listing role is still
 * unknown and that tab has nothing confirmed. Confirmed rows can paint; the
 * other tab's rows cannot.
 */
export function inboxListPhase(input: {
  inboxLoading: boolean;
  hasConversations: boolean;
  tab: InboxTab;
  visibleCount: number;
  rolePending: boolean;
}): InboxListPhase {
  const waitingForRole =
    input.rolePending &&
    (input.tab === "buying" || input.tab === "selling") &&
    input.visibleCount === 0;
  if (input.inboxLoading || waitingForRole) return "loading";
  if (!input.hasConversations) return "empty-inbox";
  if (input.visibleCount === 0) return "empty-tab";
  return "rows";
}
