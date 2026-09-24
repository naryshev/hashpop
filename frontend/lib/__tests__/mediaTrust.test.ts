import { describe, expect, it } from "vitest";
import { completionPercent, gridStatusCapsule, gridTrustChips } from "../mediaTrust";

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

describe("gridTrustChips", () => {
  it("omits the row while seller trust is loading", () => {
    expect(
      gridTrustChips({
        loading: true,
        requireEscrow: false,
        successfulCompletions: 49,
        totalSales: 50,
        status: "LISTED",
      }),
    ).toEqual([]);
  });

  it("returns completion and every fulfillment chip that applies", () => {
    expect(
      gridTrustChips({
        loading: false,
        status: "LISTED",
        requireEscrow: false,
        successfulCompletions: 49,
        totalSales: 50,
      }),
    ).toEqual([
      { kind: "completion", label: "98%", tone: "mint" },
      { kind: "meetup", label: "Meetup", tone: "silver" },
    ]);

    expect(
      gridTrustChips({
        loading: false,
        status: "LISTED",
        requireEscrow: true,
        meetup: true,
        successfulCompletions: 49,
        totalSales: 50,
      }),
    ).toEqual([
      { kind: "completion", label: "98%", tone: "mint" },
      { kind: "meetup", label: "Meetup", tone: "silver" },
      { kind: "escrow", label: "Escrow", tone: "silver" },
    ]);
  });

  it("shows only the fulfillment mode that applies when there is no completion", () => {
    expect(
      gridTrustChips({
        loading: false,
        status: "LISTED",
        requireEscrow: false,
        successfulCompletions: 0,
        totalSales: 0,
      }),
    ).toEqual([{ kind: "meetup", label: "Meetup", tone: "silver" }]);

    expect(
      gridTrustChips({
        loading: false,
        status: "LISTED",
        requireEscrow: true,
        successfulCompletions: 0,
        totalSales: 0,
      }),
    ).toEqual([{ kind: "escrow", label: "Escrow", tone: "silver" }]);

    expect(
      gridTrustChips({
        loading: false,
        status: "LISTED",
        requireEscrow: null,
        successfulCompletions: 0,
        totalSales: 0,
        kycVerified: true,
      }),
    ).toEqual([]);
  });

  it("keeps mint for the high completion band and silver below it", () => {
    expect(
      gridTrustChips({
        loading: false,
        status: "LISTED",
        successfulCompletions: 9,
        totalSales: 10,
      })[0],
    ).toEqual({ kind: "completion", label: "90%", tone: "mint" });
    expect(
      gridTrustChips({
        loading: false,
        status: "LISTED",
        successfulCompletions: 8,
        totalSales: 10,
      }),
    ).toEqual([{ kind: "completion", label: "80%", tone: "silver" }]);
  });

  it("does not invent a KYC chip", () => {
    expect(
      gridTrustChips({
        loading: false,
        status: "LISTED",
        kycVerified: true,
      }),
    ).toEqual([]);
  });

  it("omits the trust row when Pending or Sold replaces it", () => {
    expect(
      gridTrustChips({
        loading: false,
        status: "LOCKED",
        requireEscrow: false,
        meetup: true,
        successfulCompletions: 49,
        totalSales: 50,
      }),
    ).toEqual([]);
    expect(
      gridTrustChips({
        loading: false,
        status: "SOLD",
        requireEscrow: true,
        successfulCompletions: 10,
        totalSales: 10,
      }),
    ).toEqual([]);
  });
});

describe("gridStatusCapsule", () => {
  it("shows Pending and Sold only — Active is not doubled with the trust row", () => {
    expect(gridStatusCapsule("LOCKED")).toBe("pending");
    expect(gridStatusCapsule("SOLD")).toBe("sold");
    expect(gridStatusCapsule("LISTED")).toBeNull();
    expect(gridStatusCapsule("ACTIVE")).toBeNull();
    expect(gridStatusCapsule(undefined)).toBeNull();
  });
});
