import { describe, expect, it } from "vitest";
import {
  UNKNOWN_ON_HASHPOP,
  ZERO_DEALS_FULL,
  PROFILE_LIST_CTA,
  identityTitle,
  profileEmptyCopy,
  shortEvmAddress,
  trustStripView,
} from "../trustStrip";

describe("trustStripView", () => {
  it("shows New on Hashpop for unknown and never 0.0 (0) ratings", () => {
    const view = trustStripView({
      density: "full",
      unknown: true,
      ratingsAvg: 0,
      ratingsCount: 0,
      reputationScore: 0,
    });
    expect(view.unknownLabel).toBe(UNKNOWN_ON_HASHPOP);
    expect(view.showRatings).toBe(false);
    expect(view.ratingsLabel).toBeNull();
    expect(view.scoreLabel).toBeNull();
    expect(JSON.stringify(view)).not.toContain("0.0 (0)");
  });

  it("infers unknown when no deals, ratings, or kyc exist", () => {
    const view = trustStripView({ density: "compact" });
    expect(view.unknownLabel).toBe(UNKNOWN_ON_HASHPOP);
    expect(view.showRatings).toBe(false);
    expect(view.showKyc).toBe(false);
    expect(view.scoreLabel).toBeNull();
  });

  it("uses zero-deals copy on full density for a known user with no completions", () => {
    const view = trustStripView({
      density: "full",
      unknown: false,
      successfulCompletions: 0,
      totalSales: 0,
      completedBuys: 0,
      reputationScore: 0,
    });
    expect(view.completedLine).toBe(ZERO_DEALS_FULL);
    expect(view.unknownLabel).toBeNull();
    expect(view.scoreLabel).toBe("0");
    expect(view.scoreSize).toBe("large");
  });

  it("does not infer unknown on full density just because completions are zero", () => {
    const view = trustStripView({
      density: "full",
      successfulCompletions: 0,
      totalSales: 0,
      completedBuys: 0,
      ratingsCount: 0,
    });
    expect(view.unknownLabel).toBeNull();
    expect(view.completedLine).toBe(ZERO_DEALS_FULL);
  });

  it("hides the ratings chip when ratings are missing", () => {
    const missingAvg = trustStripView({
      density: "compact",
      unknown: false,
      successfulCompletions: 2,
      ratingsCount: 0,
      reputationScore: 18,
    });
    expect(missingAvg.showRatings).toBe(false);

    const missingCount = trustStripView({
      density: "inline",
      unknown: false,
      successfulCompletions: 2,
      ratingsAvg: 4.5,
      ratingsCount: 0,
    });
    expect(missingCount.showRatings).toBe(false);
  });

  it("shows ratings at one decimal with count when present", () => {
    const view = trustStripView({
      density: "compact",
      ratingsAvg: 4.75,
      ratingsCount: 12,
      successfulCompletions: 3,
      reputationScore: 42,
    });
    expect(view.showRatings).toBe(true);
    expect(view.ratingsLabel).toBe("4.8 (12)");
    expect(view.unknownLabel).toBeNull();
    expect(view.scoreLabel).toBe("42");
    expect(view.scoreSize).toBe("primary");
  });

  it("renders reputationScore as a large cue on full density", () => {
    const view = trustStripView({
      density: "full",
      unknown: false,
      successfulCompletions: 4,
      reputationScore: 27,
    });
    expect(view.scoreLabel).toBe("27");
    expect(view.scoreSize).toBe("large");
    expect(view.completedLine).toBe("4 completed");
  });

  it("hides KYC when status is absent or not verified", () => {
    expect(trustStripView({ density: "full", kycStatus: undefined }).showKyc).toBe(false);
    expect(trustStripView({ density: "full", kycStatus: "UNVERIFIED" }).showKyc).toBe(false);
    expect(trustStripView({ density: "full", kycStatus: "PENDING" }).showKyc).toBe(false);
    expect(
      trustStripView({ density: "full", kycStatus: "VERIFIED", successfulCompletions: 1 }).showKyc,
    ).toBe(true);
  });

  it("shows completed count on full density when deals exist", () => {
    const view = trustStripView({
      density: "full",
      successfulCompletions: 4,
      totalSales: 5,
    });
    expect(view.completedLine).toBe("4 completed");
  });

  it("does not emit a completed line on compact or inline", () => {
    const compact = trustStripView({
      density: "compact",
      successfulCompletions: 0,
      unknown: false,
      reputationScore: 0,
    });
    const inline = trustStripView({
      density: "inline",
      successfulCompletions: 2,
      reputationScore: 9,
    });
    expect(compact.completedLine).toBeNull();
    expect(inline.completedLine).toBeNull();
    expect(compact.scoreLabel).toBe("0");
    expect(compact.scoreSize).toBe("primary");
    expect(inline.scoreLabel).toBeNull();
  });

  it("surfaces refunds and timeouts only when the counts are present and positive", () => {
    const hidden = trustStripView({ density: "full", successfulCompletions: 1 });
    expect(hidden.refundsLabel).toBeNull();
    expect(hidden.timeoutsLabel).toBeNull();

    const shown = trustStripView({
      density: "full",
      successfulCompletions: 3,
      refunds: 1,
      timeouts: 2,
    });
    expect(shown.refundsLabel).toBe("1 refund");
    expect(shown.timeoutsLabel).toBe("2 timeouts");
  });
});

describe("profile dossier empty copy", () => {
  it("freezes p2-copy-empty-states Primaries for own vs other", () => {
    expect(profileEmptyCopy("noDeals", false)).toEqual({
      headline: "New on Hashpop",
      body: "Reputation builds with completed deals. Check back after they’ve closed a few.",
    });
    expect(profileEmptyCopy("noDeals", true)).toEqual({
      headline: "Your reputation starts with a deal",
      body: "List real stuff. Chat in-wallet, lock escrow, meet or ship — then your score travels with you.",
      cta: PROFILE_LIST_CTA,
    });
    expect(profileEmptyCopy("listings", false)).toEqual({
      headline: "No listings right now",
      body: "Reputation still travels with this wallet.",
    });
    expect(profileEmptyCopy("listings", true)).toEqual({
      headline: "List real stuff",
      body: "Meetups with a contract. Escrow on your wallet. Settled in HBAR.",
      cta: PROFILE_LIST_CTA,
    });
    expect(profileEmptyCopy("reviews", false)).toEqual({
      headline: "No reviews yet",
      body: "Reviews appear after completed deals — not before.",
    });
    expect(profileEmptyCopy("reviews", true)).toEqual({
      headline: "No reviews yet",
      body: "Close a deal, then you and your counterparty can rate each other.",
    });
    expect(profileEmptyCopy("reviews", true).headline).not.toBe(
      "Your reputation starts with a deal",
    );
    expect(profileEmptyCopy("badges", false)).toEqual({
      headline: "No badges yet",
      body: "Badges show up as you complete deals and verify.",
    });
    expect(profileEmptyCopy("badges", true).headline).toBe("No badges yet");
    expect(PROFILE_LIST_CTA).toBe("List something");
    expect(UNKNOWN_ON_HASHPOP).toBe("New on Hashpop");
    expect(ZERO_DEALS_FULL).toBe("0 completed · Builds with each contract");
  });
});

describe("identityTitle", () => {
  it("prefers displayName, then HNS, then short 0x", () => {
    expect(
      identityTitle({
        displayName: "Ada",
        hashpackName: "ada.hbar",
        address: "0x1234567890abcdef1234567890abcdef12345678",
      }),
    ).toBe("Ada");
    expect(
      identityTitle({
        hashpackName: "ada.hbar",
        address: "0x1234567890abcdef1234567890abcdef12345678",
      }),
    ).toBe("ada.hbar");
    expect(identityTitle({ address: "0x1234567890abcdef1234567890abcdef12345678" })).toBe(
      shortEvmAddress("0x1234567890abcdef1234567890abcdef12345678"),
    );
  });
});
