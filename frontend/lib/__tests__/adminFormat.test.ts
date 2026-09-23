import { describe, expect, it } from "vitest";
import {
  activitySentence,
  dealStageFromRow,
  formatRelativeAge,
  listingStatusPill,
  truncateAdminAddr,
} from "../adminFormat";

describe("truncateAdminAddr", () => {
  it("shortens EVM addresses", () => {
    expect(truncateAdminAddr("0x1234567890abcdef1234567890abcdef12345678")).toBe("0x1234…5678");
  });

  it("returns an em dash for missing values", () => {
    expect(truncateAdminAddr(null)).toBe("—");
  });
});

describe("formatRelativeAge", () => {
  const now = Date.parse("2026-09-20T12:00:00.000Z");

  it("uses minutes, hours, then days", () => {
    expect(formatRelativeAge("2026-09-20T11:59:30.000Z", now)).toBe("just now");
    expect(formatRelativeAge("2026-09-20T11:40:00.000Z", now)).toBe("20m ago");
    expect(formatRelativeAge("2026-09-20T08:00:00.000Z", now)).toBe("4h ago");
    expect(formatRelativeAge("2026-09-18T12:00:00.000Z", now)).toBe("2d ago");
  });
});

describe("listingStatusPill", () => {
  it("uses sentence-case queue labels", () => {
    expect(listingStatusPill("LISTED", true)).toEqual({ label: "Active", tone: "mint" });
    expect(listingStatusPill("LISTED", false)).toEqual({ label: "Pending", tone: "warning" });
    expect(listingStatusPill("LOCKED", true)).toEqual({ label: "Locked", tone: "bright" });
    expect(listingStatusPill("SOLD", true)).toEqual({ label: "Sold", tone: "silver" });
    expect(listingStatusPill("LOCKED", true, "OPEN")).toEqual({
      label: "Disputed",
      tone: "danger",
    });
  });
});

describe("dealStageFromRow", () => {
  it("maps Hedera escrow signals to stage pills", () => {
    expect(dealStageFromRow({ disputeStatus: "OPEN", status: "LOCKED" })).toBe("Disputed");
    expect(dealStageFromRow({ status: "SOLD" })).toBe("Complete");
    expect(dealStageFromRow({ status: "LOCKED", shippedAt: "2026-01-01" })).toBe("Meetup");
    expect(dealStageFromRow({ status: "LOCKED" })).toBe("Locked");
    expect(dealStageFromRow({ status: "LISTED", buyer: "0x1" } as { status: string })).toBe(
      "Offered",
    );
  });
});

describe("activitySentence", () => {
  it("renders one-line sentence-case events", () => {
    expect(activitySentence({ type: "listing_created", listingTitle: "Watch" })).toBe(
      "Watch created",
    );
    expect(activitySentence({ type: "sale", listingTitle: "Watch", amountHbar: "10" })).toBe(
      "Watch sold · 10 ℏ",
    );
    expect(
      activitySentence({ type: "listing_updated", listingTitle: "Watch", status: "LOCKED" }),
    ).toBe("Watch locked");
    expect(activitySentence({ type: "dispute_opened", listingTitle: "Watch" })).toBe(
      "Dispute opened on Watch",
    );
    expect(activitySentence({ type: "admin_delete", listingTitle: "Watch" })).toBe(
      "Admin deleted Watch",
    );
  });
});
