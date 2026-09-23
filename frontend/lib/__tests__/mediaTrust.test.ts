import { describe, expect, it } from "vitest";
import { completionPercent, gridStatusCapsule, gridTrustChip } from "../mediaTrust";

describe("completionPercent", () => {
  it("is null until the seller has sales to measure", () => {
    expect(completionPercent(0, 0)).toBeNull();
    expect(completionPercent(undefined, undefined)).toBeNull();
    expect(completionPercent(3, 0)).toBeNull();
  });

  it("rounds successful completions over total sales, clamped to 0–100", () => {
    expect(completionPercent(49, 50)).toBe(98);
    expect(completionPercent(1, 3)).toBe(33);
    expect(completionPercent(0, 4)).toBe(0);
    expect(completionPercent(8, 5)).toBe(100);
  });
});

describe("gridTrustChip", () => {
  it("omits the chip while seller trust is loading so Meetup cannot flash before a percent", () => {
    expect(
      gridTrustChip({
        loading: true,
        requireEscrow: false,
        successfulCompletions: 49,
        totalSales: 50,
        status: "LISTED",
      }),
    ).toBeNull();
  });

  it("prefers completion percent over Meetup and Escrow", () => {
    expect(
      gridTrustChip({
        loading: false,
        status: "LISTED",
        requireEscrow: false,
        successfulCompletions: 49,
        totalSales: 50,
      }),
    ).toEqual({ kind: "completion", label: "98%", tone: "mint" });

    expect(
      gridTrustChip({
        loading: false,
        status: "LISTED",
        requireEscrow: true,
        successfulCompletions: 9,
        totalSales: 10,
      })?.kind,
    ).toBe("completion");
  });

  it("falls through to Meetup, then Escrow, then nothing", () => {
    expect(
      gridTrustChip({
        loading: false,
        status: "LISTED",
        requireEscrow: false,
        successfulCompletions: 0,
        totalSales: 0,
      }),
    ).toEqual({ kind: "meetup", label: "Meetup", tone: "silver" });

    expect(
      gridTrustChip({
        loading: false,
        status: "LISTED",
        requireEscrow: true,
        successfulCompletions: 0,
        totalSales: 0,
      }),
    ).toEqual({ kind: "escrow", label: "Escrow", tone: "silver" });

    expect(
      gridTrustChip({
        loading: false,
        status: "LISTED",
        requireEscrow: null,
        successfulCompletions: 0,
        totalSales: 0,
        kycVerified: true,
      }),
    ).toBeNull();
  });

  it("keeps mint for the high completion band and silver below it", () => {
    expect(
      gridTrustChip({
        loading: false,
        status: "LISTED",
        successfulCompletions: 9,
        totalSales: 10,
      })?.tone,
    ).toBe("mint");
    expect(
      gridTrustChip({
        loading: false,
        status: "LISTED",
        successfulCompletions: 8,
        totalSales: 10,
      }),
    ).toEqual({ kind: "completion", label: "80%", tone: "silver" });
  });

  it("does not use KYC as the only grid chip", () => {
    expect(
      gridTrustChip({
        loading: false,
        status: "LISTED",
        kycVerified: true,
      }),
    ).toBeNull();
  });

  it("omits trust when Pending or Sold will occupy the corner", () => {
    expect(
      gridTrustChip({
        loading: false,
        status: "LOCKED",
        requireEscrow: false,
        successfulCompletions: 49,
        totalSales: 50,
      }),
    ).toBeNull();
    expect(
      gridTrustChip({
        loading: false,
        status: "SOLD",
        requireEscrow: true,
        successfulCompletions: 10,
        totalSales: 10,
      }),
    ).toBeNull();
  });
});

describe("gridStatusCapsule", () => {
  it("shows Pending and Sold only — Active is not doubled with the trust chip", () => {
    expect(gridStatusCapsule("LOCKED")).toBe("pending");
    expect(gridStatusCapsule("SOLD")).toBe("sold");
    expect(gridStatusCapsule("LISTED")).toBeNull();
    expect(gridStatusCapsule("ACTIVE")).toBeNull();
    expect(gridStatusCapsule(undefined)).toBeNull();
  });
});
