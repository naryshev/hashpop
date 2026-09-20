import { describe, expect, it } from "vitest";
import { formatRelativeAge, truncateAdminAddr } from "../adminFormat";

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
