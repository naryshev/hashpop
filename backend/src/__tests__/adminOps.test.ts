import { describe, expect, it, vi } from "vitest";
import {
  adminDealsWhere,
  adminListingsWhere,
  computeAdminStats,
  dealStage,
  fetchAdminActivity,
  fetchAdminDeals,
  fetchTrustQueue,
  mergeAdminEvents,
  moderationPatch,
  omitModerationFields,
  trustListingsWhere,
  visibleListingWhere,
  type AdminActivityEvent,
} from "../adminOps";

function iso(ms: number) {
  return new Date(ms);
}

describe("adminListingsWhere", () => {
  it("returns an empty where when no filters are set", () => {
    expect(adminListingsWhere("", "")).toEqual({});
  });

  it("uppercases status and searches id, title, seller, and buyer", () => {
    expect(adminListingsWhere("Watch", "locked")).toEqual({
      status: "LOCKED",
      OR: [
        { id: { contains: "Watch" } },
        { title: { contains: "Watch", mode: "insensitive" } },
        { seller: { contains: "watch" } },
        { buyer: { contains: "watch" } },
      ],
    });
  });

  it("maps Active and Pending chips onto listed + on-chain flags", () => {
    expect(adminListingsWhere("", "active")).toEqual({
      status: "LISTED",
      onChainConfirmed: true,
    });
    expect(adminListingsWhere("", "pending")).toEqual({
      status: "LISTED",
      onChainConfirmed: false,
    });
  });
});

describe("mergeAdminEvents", () => {
  it("sorts newest first and caps the feed", () => {
    const events: AdminActivityEvent[] = [
      { type: "sale", at: "2026-01-01T00:00:00.000Z", listingId: "a" },
      { type: "offer", at: "2026-01-03T00:00:00.000Z", listingId: "b" },
      { type: "listing_created", at: "2026-01-02T00:00:00.000Z", listingId: "c" },
    ];
    const merged = mergeAdminEvents(events, 2);
    expect(merged.map((e) => e.type)).toEqual(["offer", "listing_created"]);
  });

  it("drops listing_updated events that are effectively the create timestamp", () => {
    const created = "2026-01-01T00:00:00.000Z";
    const merged = mergeAdminEvents(
      [
        { type: "listing_created", at: created, listingId: "x" },
        { type: "listing_updated", at: "2026-01-01T00:00:01.000Z", listingId: "x" },
        { type: "listing_updated", at: "2026-01-01T01:00:00.000Z", listingId: "x" },
      ],
      10,
    );
    expect(merged.map((e) => e.type)).toEqual(["listing_updated", "listing_created"]);
  });
});

describe("computeAdminStats", () => {
  it("aggregates listing, user, sale, and deal health counts", async () => {
    const prisma = {
      listing: {
        count: vi
          .fn()
          .mockResolvedValueOnce(12) // total
          .mockResolvedValueOnce(4) // active
          .mockResolvedValueOnce(2) // pending
          .mockResolvedValueOnce(3) // sold
          .mockResolvedValueOnce(2) // locked
          .mockResolvedValueOnce(1) // cancelled
          .mockResolvedValueOnce(1) // open disputes
          .mockResolvedValueOnce(2), // in-progress with buyer
      },
      sale: {
        count: vi.fn().mockResolvedValue(5),
        findMany: vi.fn().mockResolvedValue([{ amount: "100000000" }, { amount: "50000000" }]),
      },
      user: { count: vi.fn().mockResolvedValue(9) },
    };

    const stats = await computeAdminStats(prisma as never);
    expect(stats).toEqual({
      listings: { total: 12, active: 4, pending: 2, sold: 3, locked: 2, cancelled: 1 },
      sales: { count: 5, volumeHbar: "1.50" },
      users: { count: 9 },
      deals: { locked: 2, openDisputes: 1, sold: 3, withBuyer: 2 },
    });
  });
});

describe("fetchAdminActivity", () => {
  it("merges sales, listings, offers, and disputes without message bodies", async () => {
    const now = Date.now();
    const prisma = {
      sale: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "s1",
            listingId: "lst-1",
            buyer: "0xbuyer",
            seller: "0xseller",
            amount: "100000000",
            createdAt: iso(now),
            listing: { title: "Watch" },
          },
        ]),
      },
      listing: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([
            {
              id: "lst-2",
              title: "Camera",
              seller: "0xseller",
              buyer: null,
              price: "2",
              status: "LISTED",
              createdAt: iso(now - 1000),
              updatedAt: iso(now - 1000),
              disputeStatus: null,
              disputeOpenedAt: null,
            },
          ])
          .mockResolvedValueOnce([
            {
              id: "lst-3",
              title: "Lens",
              seller: "0xseller",
              buyer: "0xbuyer",
              price: "3",
              status: "LOCKED",
              createdAt: iso(now - 10_000),
              updatedAt: iso(now - 500),
              disputeStatus: "OPEN",
              disputeOpenedAt: iso(now - 400),
            },
          ]),
      },
      offer: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "o1",
            listingId: "lst-2",
            buyer: "0xoffer",
            amount: "150000000",
            status: "ACTIVE",
            createdAt: iso(now - 200),
            listing: { title: "Camera" },
          },
        ]),
      },
    };

    const { events } = await fetchAdminActivity(prisma as never, { limit: 50, now });
    expect(events[0]?.type).toBe("sale");
    expect(events.some((e) => e.type === "offer")).toBe(true);
    expect(events.some((e) => e.type === "listing_created")).toBe(true);
    expect(events.some((e) => e.type === "listing_updated")).toBe(true);
    expect(events.some((e) => e.type === "dispute_opened")).toBe(true);
    expect(events.every((e) => !("body" in e) && !("plaintext" in e))).toBe(true);
    expect(prisma.sale.findMany).toHaveBeenCalled();
    expect(prisma.offer.findMany).toHaveBeenCalled();
  });
});

describe("fetchAdminDeals", () => {
  it("returns ops-attention deals and flags stuck rows", async () => {
    const now = Date.parse("2026-09-20T00:00:00.000Z");
    const prisma = {
      listing: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "stuck",
            title: "Old lock",
            imageUrl: null,
            seller: "0xseller",
            buyer: "0xbuyer",
            price: "10",
            status: "LOCKED",
            disputeStatus: null,
            disputeOpenedAt: null,
            createdAt: iso(now - 10 * 86400000),
            updatedAt: iso(now - 10 * 86400000),
            sales: [{ amount: "1000000000" }],
          },
          {
            id: "fresh",
            title: "New dispute",
            imageUrl: "https://img",
            seller: "0xseller",
            buyer: "0xbuyer",
            price: "4",
            status: "LOCKED",
            disputeStatus: "OPEN",
            disputeOpenedAt: iso(now - 2 * 86400000),
            createdAt: iso(now - 3 * 86400000),
            updatedAt: iso(now - 2 * 86400000),
            sales: [],
          },
        ]),
      },
    };

    const { deals } = await fetchAdminDeals(prisma as never, { now, stuckDays: 7 });
    expect(deals).toHaveLength(2);
    expect(deals[0]).toMatchObject({
      listingId: "stuck",
      stuck: true,
      ageDays: 10,
      status: "LOCKED",
      stage: "Locked",
    });
    expect(deals[1]).toMatchObject({
      listingId: "fresh",
      stuck: false,
      disputeStatus: "OPEN",
      ageDays: 2,
      stage: "Disputed",
    });
  });

  it("can filter to stuck deals only", async () => {
    const now = Date.parse("2026-09-20T00:00:00.000Z");
    const prisma = {
      listing: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "fresh",
            title: "Fresh",
            imageUrl: null,
            seller: "0xseller",
            buyer: "0xbuyer",
            price: "1",
            status: "LOCKED",
            disputeStatus: null,
            disputeOpenedAt: null,
            createdAt: iso(now - 86400000),
            updatedAt: iso(now - 86400000),
            sales: [],
          },
        ]),
      },
    };
    const { deals } = await fetchAdminDeals(prisma as never, {
      now,
      stuckDays: 7,
      stuckOnly: true,
    });
    expect(deals).toEqual([]);
  });

  it("keeps settled escrow on the released scope and out of the open queue", async () => {
    expect(dealStage({ status: "REFUNDED" })).toBe("Refunded");
    expect(dealStage({ status: "SOLD" })).toBe("Complete");
    expect(dealStage({ status: "REFUNDED", disputeStatus: "OPEN" })).toBe("Disputed");
    expect(adminDealsWhere("open")).toEqual({
      OR: [
        { status: "LOCKED" },
        { disputeStatus: "OPEN" },
        {
          AND: [{ buyer: { not: null } }, { status: { notIn: ["SOLD", "CANCELLED", "REFUNDED"] } }],
        },
      ],
    });
    expect(adminDealsWhere("released")).toEqual({
      status: { in: ["SOLD", "REFUNDED"] },
      NOT: { disputeStatus: "OPEN" },
    });

    const now = Date.parse("2026-09-20T00:00:00.000Z");
    const prisma = {
      listing: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "refunded",
            title: "Returned",
            imageUrl: null,
            seller: "0xseller",
            buyer: "0xbuyer",
            price: "3",
            status: "REFUNDED",
            disputeStatus: null,
            disputeOpenedAt: null,
            createdAt: iso(now - 4 * 86400000),
            updatedAt: iso(now - 86400000),
            sales: [],
          },
        ]),
      },
    };
    const { deals } = await fetchAdminDeals(prisma as never, {
      now,
      scope: "released",
      limit: 80,
    });
    expect(deals).toEqual([
      expect.objectContaining({ listingId: "refunded", stage: "Refunded", stuck: false }),
    ]);
    expect(prisma.listing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: adminDealsWhere("released"),
        take: 80,
      }),
    );
    const select = prisma.listing.findMany.mock.calls[0]?.[0]?.select as Record<string, unknown>;
    expect(select).not.toHaveProperty("disputeReason");
    expect(select).not.toHaveProperty("description");
  });

  it("caps the released scope at 100 rows", async () => {
    const prisma = {
      listing: { findMany: vi.fn().mockResolvedValue([]) },
    };
    await fetchAdminDeals(prisma as never, { scope: "released", limit: 500 });
    expect(prisma.listing.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 100 }));
  });
});

describe("trust queue moderation", () => {
  it("strips moderation fields from public listing payloads", () => {
    expect(
      omitModerationFields({
        id: "1",
        title: "Watch",
        moderationStatus: "FLAGGED",
        moderationReason: "Flagged for review",
      }),
    ).toEqual({ id: "1", title: "Watch" });
  });

  it("keeps hidden and removed listings out of public marketplace queries", () => {
    expect(visibleListingWhere({ status: "LISTED", onChainConfirmed: true })).toEqual({
      AND: [
        { status: "LISTED", onChainConfirmed: true },
        {
          OR: [{ moderationStatus: null }, { moderationStatus: { notIn: ["HIDDEN", "REMOVED"] } }],
        },
      ],
    });
  });

  it("maps queue filters onto moderation codes without touching chain status", () => {
    expect(trustListingsWhere("needs_review", "")).toEqual({
      moderationStatus: null,
      moderationReason: { in: ["PENDING_REVIEW", "FLAGGED", "REPORT"] },
    });
    expect(trustListingsWhere("flagged", "")).toEqual({ moderationReason: "FLAGGED" });
    expect(trustListingsWhere("hidden", "")).toEqual({ moderationStatus: "HIDDEN" });
    expect(trustListingsWhere("all", "Watch")).toEqual({
      OR: [
        { id: { contains: "Watch" } },
        { title: { contains: "Watch", mode: "insensitive" } },
        { seller: { contains: "watch" } },
      ],
    });
    expect(trustListingsWhere("needs review", "abc")).toEqual({
      moderationStatus: null,
      moderationReason: { in: ["PENDING_REVIEW", "FLAGGED", "REPORT"] },
      OR: [
        { id: { contains: "abc" } },
        { title: { contains: "abc", mode: "insensitive" } },
        { seller: { contains: "abc" } },
      ],
    });
  });

  it("stores hide notes separately from the reason chip code", () => {
    expect(moderationPatch("hide", "  counterfeit  ")).toEqual({
      moderationStatus: "HIDDEN",
      moderationReason: "MANUAL",
      moderationNote: "counterfeit",
    });
    expect(moderationPatch("flag", "", "HIDDEN")).toEqual({
      moderationStatus: "HIDDEN",
      moderationReason: "FLAGGED",
      moderationNote: null,
    });
    expect(moderationPatch("flag", "")).toEqual({
      moderationStatus: null,
      moderationReason: "FLAGGED",
      moderationNote: null,
    });
    expect(moderationPatch("remove", "ignored")).toEqual({
      moderationStatus: "REMOVED",
      moderationReason: "MANUAL",
      moderationNote: null,
    });
    expect(moderationPatch("clear", "ignored")).toEqual({
      moderationStatus: null,
      moderationReason: null,
      moderationNote: null,
    });
  });

  it("counts only flagged listings for the 2a queue badge and leaves users and disputes empty", async () => {
    const prisma = {
      listing: {
        count: vi.fn().mockResolvedValue(3),
        findMany: vi.fn().mockResolvedValue([
          {
            id: "0xabc",
            title: "Watch",
            imageUrl: "/img.png",
            seller: "0xseller",
            status: "LISTED",
            onChainConfirmed: true,
            disputeStatus: null,
            moderationStatus: null,
            moderationReason: "FLAGGED",
            updatedAt: new Date("2026-09-20T00:00:00.000Z"),
          },
        ]),
      },
    };
    const queue = await fetchTrustQueue(prisma as never, { filter: "needs_review", q: "" });
    expect(prisma.listing.count).toHaveBeenCalledWith({
      where: {
        moderationStatus: null,
        moderationReason: { in: ["PENDING_REVIEW", "FLAGGED", "REPORT"] },
      },
    });
    expect(queue.counts).toEqual({ listings: 3, users: 0, disputes: 0 });
    expect(queue.listings).toEqual([
      {
        id: "0xabc",
        title: "Watch",
        imageUrl: "/img.png",
        seller: "0xseller",
        status: "LISTED",
        onChainConfirmed: true,
        disputeStatus: null,
        moderationStatus: null,
        moderationReason: "FLAGGED",
        updatedAt: "2026-09-20T00:00:00.000Z",
      },
    ]);
  });
});
