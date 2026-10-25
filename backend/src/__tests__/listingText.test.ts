import { describe, expect, it } from "vitest";
import { trimmedOrNull } from "../listingText";

describe("trimmedOrNull", () => {
  it("trims a real title or description", () => {
    expect(trimmedOrNull("  Galaxy Gas  ")).toBe("Galaxy Gas");
  });

  it("stores null for empty and whitespace-only text", () => {
    expect(trimmedOrNull("")).toBeNull();
    expect(trimmedOrNull("   ")).toBeNull();
    expect(trimmedOrNull("\n\t  ")).toBeNull();
  });

  it("stores null for missing non-strings", () => {
    expect(trimmedOrNull(null)).toBeNull();
    expect(trimmedOrNull(undefined)).toBeNull();
  });
});
