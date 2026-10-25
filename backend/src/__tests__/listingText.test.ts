import { describe, expect, it } from "vitest";
import { patchListingTitle, syncListingTitle, trimmedOrNull } from "../listingText";

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

describe("patchListingTitle", () => {
  it("keeps an omitted title unchanged", () => {
    expect(patchListingTitle(undefined)).toEqual({ ok: true });
  });

  it("trims a title that was sent", () => {
    expect(patchListingTitle("  Galaxy Gas  ")).toEqual({ ok: true, value: "Galaxy Gas" });
  });

  it("rejects a sent title that trims to empty", () => {
    expect(patchListingTitle("")).toEqual({ ok: false });
    expect(patchListingTitle("   ")).toEqual({ ok: false });
    expect(patchListingTitle("\n\t")).toEqual({ ok: false });
    expect(patchListingTitle(null)).toEqual({ ok: false });
  });
});

describe("syncListingTitle", () => {
  it("leaves an omitted title unchanged", () => {
    expect(syncListingTitle(undefined)).toBeUndefined();
    expect(syncListingTitle(null)).toBeUndefined();
  });

  it("stores a trimmed title", () => {
    expect(syncListingTitle("  Galaxy Gas  ")).toEqual({ value: "Galaxy Gas", empty: false });
  });

  it("stores a blank title instead of failing the sync", () => {
    expect(syncListingTitle("")).toEqual({ value: "", empty: true });
    expect(syncListingTitle("   ")).toEqual({ value: "", empty: true });
  });
});
