import { describe, expect, it } from "vitest";
import { dockBadgeIsPill, formatDockBadgeCount } from "../dockBadge";

describe("formatDockBadgeCount", () => {
  it("hides at 0 and below", () => {
    expect(formatDockBadgeCount(0)).toBeNull();
    expect(formatDockBadgeCount(-1)).toBeNull();
  });

  it("shows the exact count from 1 through 9", () => {
    expect(formatDockBadgeCount(1)).toBe("1");
    expect(formatDockBadgeCount(9)).toBe("9");
  });

  it("caps display at 9+", () => {
    expect(formatDockBadgeCount(10)).toBe("9+");
    expect(formatDockBadgeCount(99)).toBe("9+");
  });
});

describe("dockBadgeIsPill", () => {
  it("keeps single digits circular and 9+ as a pill", () => {
    expect(dockBadgeIsPill("9")).toBe(false);
    expect(dockBadgeIsPill("9+")).toBe(true);
  });
});
