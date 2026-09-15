import { describe, expect, it } from "vitest";
import {
  DEAL_ROOM_EMPTY_BODY,
  DEAL_ROOM_EMPTY_HEADLINE,
  DEAL_ROOM_PLACEHOLDER,
  LOCK_ESCROW_SHEET_TITLE,
  escrowBarFromListing,
  escrowSystemCards,
  listingEscrowLocked,
  offerCardActions,
  shouldPromptLockEscrow,
} from "../dealRoom";

const listingBase = {
  id: "lst-1",
  seller: "0xseller",
  buyer: null as string | null,
  price: "100",
  status: "LISTED",
  requireEscrow: true,
  trackingNumber: null as string | null,
  trackingCarrier: null as string | null,
  shippedAt: null as string | null,
  exchangeConfirmedAt: null as string | null,
  onChainConfirmed: false,
  disputeStatus: null as string | null,
  disputeReason: null as string | null,
  disputeOpenedBy: null as string | null,
  disputeOpenedAt: null as string | null,
};

describe("deal-room frozen copy", () => {
  it("keeps empty-thread headline, body, and placeholder", () => {
    expect(DEAL_ROOM_EMPTY_HEADLINE).toBe("This is the deal room");
    expect(DEAL_ROOM_EMPTY_BODY).toMatch(/chat/i);
    expect(DEAL_ROOM_EMPTY_BODY).toMatch(/escrow/i);
    expect(DEAL_ROOM_EMPTY_BODY).toMatch(/reputation/i);
    expect(DEAL_ROOM_PLACEHOLDER).toBe("Message about this listing…");
    expect(LOCK_ESCROW_SHEET_TITLE).toBe("Lock escrow before you meet");
  });
});

describe("listingEscrowLocked / meetup prompt", () => {
  it("treats LOCKED, SOLD, COMPLETED, and exchangeConfirmedAt as locked", () => {
    expect(listingEscrowLocked({ ...listingBase, status: "LOCKED" })).toBe(true);
    expect(listingEscrowLocked({ ...listingBase, status: "SOLD" })).toBe(true);
    expect(listingEscrowLocked({ ...listingBase, status: "COMPLETED" })).toBe(true);
    expect(
      listingEscrowLocked({ ...listingBase, exchangeConfirmedAt: "2026-09-01T00:00:00.000Z" }),
    ).toBe(true);
    expect(listingEscrowLocked(listingBase)).toBe(false);
  });

  it("prompts the non-seller when requireEscrow and not locked", () => {
    expect(shouldPromptLockEscrow(listingBase, "0xbuyer")).toBe(true);
    expect(shouldPromptLockEscrow(listingBase, "0xSELLER")).toBe(false);
    expect(shouldPromptLockEscrow({ ...listingBase, requireEscrow: false }, "0xbuyer")).toBe(false);
    expect(shouldPromptLockEscrow({ ...listingBase, status: "LOCKED" }, "0xbuyer")).toBe(false);
    expect(shouldPromptLockEscrow(listingBase, null)).toBe(false);
  });
});

describe("escrowBarFromListing", () => {
  it("reads Listing status / requireEscrow / tracking / dispute / timestamps", () => {
    expect(escrowBarFromListing(listingBase, undefined, "buyer").label).toBe("Escrow not locked");
    expect(
      escrowBarFromListing({ ...listingBase, status: "LOCKED" }, undefined, "buyer").label,
    ).toBe("Escrow locked");
    expect(
      escrowBarFromListing(
        { ...listingBase, status: "LOCKED", shippedAt: "2026-09-01T00:00:00.000Z" },
        undefined,
        "buyer",
      ).label,
    ).toBe("Shipped");
    expect(
      escrowBarFromListing({ ...listingBase, disputeStatus: "OPEN" }, undefined, "buyer").label,
    ).toBe("On hold");
    expect(
      escrowBarFromListing({ ...listingBase, status: "SOLD" }, { amount: "100" }, "seller").label,
    ).toBe("Complete");
  });
});

describe("escrowSystemCards", () => {
  it("renders client-side cards from Listing/Sale state, not Message.type", () => {
    const cards = escrowSystemCards(
      {
        ...listingBase,
        status: "LOCKED",
        shippedAt: "2026-09-02T00:00:00.000Z",
        trackingNumber: "1Z999",
        trackingCarrier: "UPS",
      },
      { amount: "80", createdAt: "2026-09-01T00:00:00.000Z" },
    );
    expect(cards.some((c) => /escrow locked/i.test(c.title))).toBe(true);
    expect(cards.some((c) => /shipped/i.test(c.title))).toBe(true);
    expect(cards.every((c) => !("type" in c) && !("offerAmount" in c))).toBe(true);
  });
});

describe("offerCardActions", () => {
  it("wires seller accept and buyer counter/cancel to existing Offer actions", () => {
    expect(
      offerCardActions(
        { status: "ACTIVE", buyer: "0xbuyer" },
        { viewer: "0xseller", seller: "0xseller" },
      ),
    ).toEqual(["accept"]);
    expect(
      offerCardActions(
        { status: "ACTIVE", buyer: "0xbuyer" },
        { viewer: "0xbuyer", seller: "0xseller" },
      ),
    ).toEqual(["counter", "cancel"]);
    expect(
      offerCardActions(
        { status: "ACCEPTED", buyer: "0xbuyer" },
        { viewer: "0xseller", seller: "0xseller" },
      ),
    ).toEqual([]);
  });
});
