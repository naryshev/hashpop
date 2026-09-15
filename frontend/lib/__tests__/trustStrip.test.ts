import { describe, expect, it } from "vitest";
import {
  UNKNOWN_ON_HASHPOP,
  ZERO_DEALS_FULL,
  PROFILE_LISTINGS_EMPTY,
  PROFILE_REVIEWS_OWN_EMPTY,
  identityTitle,
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
    });
    expect(view.unknownLabel).toBe(UNKNOWN_ON_HASHPOP);
    expect(view.showRatings).toBe(false);
    expect(view.ratingsLabel).toBeNull();
    expect(JSON.stringify(view)).not.toContain("0.0 (0)");
  });

  it("infers unknown when no deals, ratings, or kyc exist", () => {
    const view = trustStripView({ density: "compact" });
    expect(view.unknownLabel).toBe(UNKNOWN_ON_HASHPOP);
    expect(view.showRatings).toBe(false);
    expect(view.showKyc).toBe(false);
  });

  it("uses zero-deals copy on full density for a known user with no completions", () => {
    const view = trustStripView({
      density: "full",
      unknown: false,
      successfulCompletions: 0,
      totalSales: 0,
      completedBuys: 0,
    });
    expect(view.completedLine).toBe(ZERO_DEALS_FULL);
    expect(view.unknownLabel).toBeNull();
  });

  it("hides the ratings chip when ratings are missing", () => {
    const missingAvg = trustStripView({
      density: "compact",
      unknown: false,
      successfulCompletions: 2,
      ratingsCount: 0,
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
    });
    expect(view.showRatings).toBe(true);
    expect(view.ratingsLabel).toBe("4.8 (12)");
    expect(view.unknownLabel).toBeNull();
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
    });
    const inline = trustStripView({
      density: "inline",
      successfulCompletions: 2,
    });
    expect(compact.completedLine).toBeNull();
    expect(inline.completedLine).toBeNull();
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
  it("freezes triangle-voice empty states", () => {
    expect(UNKNOWN_ON_HASHPOP).toBe("New on Hashpop");
    expect(PROFILE_REVIEWS_OWN_EMPTY).toBe("Your reputation starts with a deal");
    expect(PROFILE_LISTINGS_EMPTY).toBe("No listings yet");
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
