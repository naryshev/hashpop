import { describe, expect, it } from "vitest";
import {
  TRUST_EMPTY,
  TRUST_LISTING_FILTERS,
  TRUST_PAGE,
  TRUST_TABS,
  trustCountBadge,
  trustListingActions,
  trustReasonLabel,
} from "../adminTrust";

describe("trust page copy", () => {
  it("uses the phase 2a lock strings", () => {
    expect(TRUST_PAGE).toEqual({
      title: "Trust & safety",
      sub: "Queues for listings and users that need a decision.",
    });
    expect(TRUST_TABS.map((tab) => tab.label)).toEqual(["Listings", "Users", "Disputes"]);
    expect(TRUST_TABS[0]?.id).toBe("listings");
    expect(TRUST_LISTING_FILTERS.map((filter) => filter.label)).toEqual([
      "Needs review",
      "Hidden",
      "Flagged",
      "All",
    ]);
    expect(TRUST_EMPTY.listings).toEqual({
      title: "No listings in this queue.",
      sub: "Try another filter or clear search.",
    });
    expect(TRUST_EMPTY.users).toEqual({
      title: "No users need review.",
      sub: "Watched and restricted wallets show up here.",
    });
    expect(TRUST_EMPTY.disputes).toEqual({
      title: "No open disputes.",
      sub: "Escrow disputes will land here.",
    });
  });
});

describe("trust queue badges and actions", () => {
  it("shows a mint count only when the queue is non-empty", () => {
    expect(trustCountBadge(0)).toBeNull();
    expect(trustCountBadge(4)).toBe(4);
  });

  it("offers hide, remove, and flag on a clean listing, and clear once moderated", () => {
    expect(trustListingActions(null)).toEqual({
      view: true,
      hide: true,
      remove: true,
      flag: true,
      clear: false,
    });
    expect(trustListingActions("FLAGGED").flag).toBe(false);
    expect(trustListingActions("FLAGGED").clear).toBe(true);
    expect(trustListingActions("HIDDEN")).toEqual({
      view: true,
      hide: false,
      remove: true,
      flag: false,
      clear: true,
    });
  });

  it("shows an em dash when a listing has no moderation reason", () => {
    expect(trustReasonLabel(null)).toBe("—");
    expect(trustReasonLabel("  scam  ")).toBe("scam");
  });
});
