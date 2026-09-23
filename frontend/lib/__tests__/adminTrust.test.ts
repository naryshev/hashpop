import { describe, expect, it } from "vitest";
import {
  TRUST_EMPTY,
  TRUST_LISTING_FILTERS,
  TRUST_PAGE,
  TRUST_SEARCH_MISS,
  TRUST_SEARCH_PLACEHOLDER,
  TRUST_TABS,
  trustCountBadge,
  trustListingActions,
  trustReasonChip,
  trustStatusPill,
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
    expect(TRUST_SEARCH_PLACEHOLDER).toBe("Search id, title, wallet…");
    expect(TRUST_EMPTY.listings).toEqual({
      title: "No listings in this queue.",
      sub: "Try another filter or clear search.",
    });
    expect(TRUST_SEARCH_MISS).toEqual({
      title: "Nothing matches.",
      sub: "Check the id or try another filter.",
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

  it("keeps Flag visible, silver until the flag is active", () => {
    expect(trustListingActions(null, null)).toEqual({
      view: true,
      hide: true,
      remove: true,
      flag: true,
      flagActive: false,
      clear: false,
    });
    expect(trustListingActions(null, "FLAGGED").flagActive).toBe(true);
    expect(trustListingActions(null, "FLAGGED").clear).toBe(true);
    expect(trustListingActions("HIDDEN", "MANUAL")).toEqual({
      view: true,
      hide: false,
      remove: true,
      flag: true,
      flagActive: false,
      clear: true,
    });
    expect(trustListingActions("REMOVED", "MANUAL").remove).toBe(false);
  });
});

describe("trust column chips", () => {
  it("maps moderation visibility to Live, Hidden, and Removed", () => {
    expect(trustStatusPill(null)).toEqual({ label: "Live", tone: "mint" });
    expect(trustStatusPill("FLAGGED")).toEqual({ label: "Live", tone: "mint" });
    expect(trustStatusPill("HIDDEN")).toEqual({ label: "Hidden", tone: "silver" });
    expect(trustStatusPill("REMOVED")).toEqual({ label: "Removed", tone: "danger" });
  });

  it("renders only the four reason chips and never free text", () => {
    expect(trustReasonChip(null)).toEqual({ label: "Pending review", tone: "warning" });
    expect(trustReasonChip("PENDING_REVIEW")).toEqual({
      label: "Pending review",
      tone: "warning",
    });
    expect(trustReasonChip("FLAGGED")).toEqual({ label: "Flagged", tone: "warning" });
    expect(trustReasonChip("REPORT")).toEqual({ label: "Report", tone: "danger" });
    expect(trustReasonChip("MANUAL")).toEqual({ label: "Manual", tone: "silver" });
    expect(trustReasonChip("counterfeit watch")).toEqual({
      label: "Pending review",
      tone: "warning",
    });
  });
});
