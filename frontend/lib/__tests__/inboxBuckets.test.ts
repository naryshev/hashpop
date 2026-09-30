import { describe, expect, it } from "vitest";
import { bucketInboxConversations, inboxListPhase, type InboxTab } from "../inboxBuckets";

const me = "0xAbC";
const buyer = "0x1111111111111111111111111111111111111111";
const otherSeller = "0x2222222222222222222222221111111111111111";

function thread(
  preview: string,
  listingId: string | null,
  createdAt: string,
  otherAddress = buyer,
) {
  return {
    otherAddress,
    listingId,
    preview,
    lastMessage: {
      fromAddress: otherAddress,
      toAddress: me,
      createdAt,
    },
  };
}

describe("bucketInboxConversations", () => {
  it("keeps unresolved selling threads off Buying while listing previews are in flight", () => {
    const selling = thread("selling-row", "sell-1", "2026-09-02T00:00:00.000Z");
    const buying = thread("buying-row", "buy-1", "2026-09-01T00:00:00.000Z");
    const { buckets, rolePending } = bucketInboxConversations([selling, buying], {}, new Set(), me);

    expect(rolePending).toBe(true);
    expect(buckets.buying).toEqual([]);
    expect(buckets.selling).toEqual([]);
  });

  it("moves a thread to Selling only after the preview says the viewer is the seller", () => {
    const selling = thread("selling-row", "sell-1", "2026-09-02T00:00:00.000Z");
    const buying = thread("buying-row", "buy-1", "2026-09-03T00:00:00.000Z");
    const { buckets, rolePending } = bucketInboxConversations(
      [selling, buying],
      {
        "sell-1": { seller: me },
        "buy-1": { seller: otherSeller },
      },
      new Set(),
      me,
    );

    expect(rolePending).toBe(false);
    expect(buckets.selling.map((row) => row.preview)).toEqual(["selling-row"]);
    expect(buckets.buying.map((row) => row.preview)).toEqual(["buying-row"]);
  });

  it("shows confirmed Buying rows without waiting for a still-pending Selling preview", () => {
    const selling = thread("selling-row", "sell-1", "2026-09-02T00:00:00.000Z");
    const buying = thread("buying-row", "buy-1", "2026-09-03T00:00:00.000Z");
    const { buckets, rolePending } = bucketInboxConversations(
      [selling, buying],
      { "buy-1": { seller: otherSeller } },
      new Set(),
      me,
    );

    expect(rolePending).toBe(true);
    expect(buckets.buying.map((row) => row.preview)).toEqual(["buying-row"]);
    expect(buckets.selling).toEqual([]);
  });

  it("does not paint an empty Buying list as Selling when Buying has no threads", () => {
    const sellingA = thread("selling-a", "sell-1", "2026-09-02T00:00:00.000Z");
    const sellingB = thread("selling-b", "sell-2", "2026-09-01T00:00:00.000Z");
    const pending = bucketInboxConversations([sellingA, sellingB], {}, new Set(), me);
    expect(pending.buckets.buying).toEqual([]);
    expect(pending.rolePending).toBe(true);

    const settled = bucketInboxConversations(
      [sellingA, sellingB],
      { "sell-1": { seller: me }, "sell-2": { seller: me.toLowerCase() } },
      new Set(),
      me,
    );
    expect(settled.rolePending).toBe(false);
    expect(settled.buckets.buying).toEqual([]);
    expect(settled.buckets.selling.map((row) => row.preview)).toEqual(["selling-a", "selling-b"]);
  });

  it("leaves direct and offer threads alone while listing roles load", () => {
    const direct = thread("hello there", null, "2026-09-04T00:00:00.000Z");
    const offer = thread("Offer: 10 HBAR", "list-9", "2026-09-05T00:00:00.000Z");
    const selling = thread("selling-row", "sell-1", "2026-09-02T00:00:00.000Z");
    const { buckets, rolePending } = bucketInboxConversations(
      [direct, offer, selling],
      {},
      new Set(),
      me,
    );

    expect(rolePending).toBe(true);
    expect(buckets.direct).toEqual([direct]);
    expect(buckets.offers).toEqual([offer]);
    expect(buckets.buying).toEqual([]);
    expect(buckets.selling).toEqual([]);
  });
});

describe("inboxListPhase", () => {
  const base = {
    inboxLoading: false,
    hasConversations: true,
    tab: "buying" as InboxTab,
    visibleCount: 0,
    rolePending: true,
  };

  it("keeps Buying on loading while roles are pending and nothing is confirmed", () => {
    expect(inboxListPhase(base)).toBe("loading");
  });

  it("paints confirmed Buying rows even while another listing is still pending", () => {
    expect(inboxListPhase({ ...base, visibleCount: 1 })).toBe("rows");
  });

  it("shows the empty Buying copy only after roles have settled", () => {
    expect(inboxListPhase({ ...base, rolePending: false })).toBe("empty-tab");
  });

  it("does not block Direct on a pending Buying/Selling role", () => {
    expect(inboxListPhase({ ...base, tab: "direct", visibleCount: 1 })).toBe("rows");
  });
});
