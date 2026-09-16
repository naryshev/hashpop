import { describe, expect, it } from "vitest";
import {
  buildDealNotifications,
  DEAL_UPDATES_EMPTY_BODY,
  DEAL_UPDATES_EMPTY_TITLE,
  dealDotTone,
  formatRelativeTime,
  unreadDealNotifications,
} from "../dealNotifications";

const me = "0xabc0000000000000000000000000000000000001";

describe("buildDealNotifications", () => {
  it("includes offers, escrow/meetup/ship, and ratings — never chat", () => {
    const items = buildDealNotifications({
      address: me,
      receivedOffers: [
        {
          id: "o1",
          listingId: "lst-1",
          amount: "12",
          status: "ACTIVE",
          createdAt: "2026-09-01T12:00:00.000Z",
          listing: { title: "Polaroid" },
        },
      ],
      sentOffers: [
        {
          id: "o2",
          listingId: "lst-2",
          amount: "8",
          status: "ACCEPTED",
          createdAt: "2026-09-01T11:00:00.000Z",
          listing: { title: "Lens" },
        },
      ],
      purchases: [
        {
          id: "s1",
          listingId: "lst-3",
          role: "buyer",
          createdAt: "2026-09-01T10:00:00.000Z",
          listing: {
            title: "Camera",
            status: "LOCKED",
            shippedAt: null,
            exchangeConfirmedAt: null,
          },
        },
        {
          id: "s2",
          listingId: "lst-4",
          role: "buyer",
          createdAt: "2026-08-01T10:00:00.000Z",
          listing: {
            title: "Bag",
            status: "LOCKED",
            shippedAt: "2026-09-01T09:00:00.000Z",
            exchangeConfirmedAt: null,
          },
        },
      ],
      ratings: [
        {
          id: "r1",
          reviewerAddress: "0xdef",
          score: 5,
          comment: "Smooth meetup",
          createdAt: "2026-09-01T08:00:00.000Z",
        },
      ],
    });

    expect(items.some((i) => i.kind === "offer" && i.title === "New offer")).toBe(true);
    expect(items.some((i) => i.title === "Your offer was accepted")).toBe(true);
    expect(items.some((i) => i.kind === "meetup" && i.title === "Confirm meetup")).toBe(true);
    expect(items.some((i) => i.kind === "ship" && i.title === "Item shipped")).toBe(true);
    expect(items.some((i) => i.kind === "rating" && i.title === "New rating")).toBe(true);
    expect(items.every((i) => i.kind !== ("message" as DealKind))).toBe(true);
    expect(items.find((i) => i.title === "New offer")?.body).toBe("12 ℏ on Polaroid");
  });

  it("uses sentence-case titles and a one-line body", () => {
    const items = buildDealNotifications({
      address: me,
      receivedOffers: [
        {
          id: "o1",
          listingId: "lst-1",
          amount: "12",
          status: "ACTIVE",
          createdAt: "2026-09-01T12:00:00.000Z",
          listing: { title: "Polaroid" },
        },
      ],
    });
    expect(items[0].title).toBe("New offer");
    expect(items[0].title.startsWith("New")).toBe(true);
    expect(items[0].body.includes("\n")).toBe(false);
    expect(items[0].urgent).toBe(true);
  });

  it("does not emit a locked-escrow row when meetup is the actionable update", () => {
    const items = buildDealNotifications({
      address: me,
      purchases: [
        {
          id: "s1",
          listingId: "lst-3",
          role: "buyer",
          createdAt: "2026-09-01T10:00:00.000Z",
          listing: {
            title: "Camera",
            status: "LOCKED",
            shippedAt: null,
            exchangeConfirmedAt: null,
          },
        },
      ],
    });
    expect(items.map((i) => i.kind)).toEqual(["meetup"]);
  });
});

type DealKind = "offer" | "escrow" | "meetup" | "ship" | "rating" | "message";

describe("dealDotTone", () => {
  it("is red when any unseen update is urgent, otherwise mint, otherwise hidden", () => {
    const items = buildDealNotifications({
      address: me,
      receivedOffers: [
        {
          id: "o1",
          listingId: "lst-1",
          status: "ACTIVE",
          createdAt: "2026-09-01T12:00:00.000Z",
          listing: { title: "Polaroid" },
        },
      ],
      ratings: [
        {
          id: "r1",
          reviewerAddress: "0xdef",
          score: 5,
          createdAt: "2026-09-01T08:00:00.000Z",
        },
      ],
    });
    const unseen = unreadDealNotifications(items, 0);
    expect(dealDotTone(unseen)).toBe("red");
    expect(dealDotTone(unreadDealNotifications(items, Date.now() + 1000))).toBeNull();
    const ratingsOnly = items.filter((i) => i.kind === "rating");
    expect(dealDotTone(unreadDealNotifications(ratingsOnly, 0))).toBe("mint");
  });
});

describe("empty copy", () => {
  it("is frozen", () => {
    expect(DEAL_UPDATES_EMPTY_TITLE).toBe("No updates yet.");
    expect(DEAL_UPDATES_EMPTY_BODY).toBe("Offers, escrow, and deal updates land here.");
  });
});

describe("formatRelativeTime", () => {
  it("uses compact relative labels", () => {
    const now = new Date("2026-09-01T12:00:00.000Z");
    expect(formatRelativeTime(new Date("2026-09-01T11:59:50.000Z"), now)).toBe("just now");
    expect(formatRelativeTime(new Date("2026-09-01T11:50:00.000Z"), now)).toBe("10m ago");
    expect(formatRelativeTime(new Date("2026-09-01T09:00:00.000Z"), now)).toBe("3h ago");
  });
});
