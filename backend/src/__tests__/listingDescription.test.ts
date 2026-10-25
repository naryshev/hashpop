import { describe, expect, it } from "vitest";
import {
  LISTING_DESCRIPTION_ERROR,
  listingDescriptionChangeError,
  listingDescriptionError,
} from "../listingDescription";

const real = "Sealed galaxy gas canister with the original cap, unused, and a full charge left.";

describe("listingDescriptionError", () => {
  it("accepts a trimmed description of at least 50 characters", () => {
    expect(listingDescriptionError(`  ${real}  `)).toBeNull();
  });

  it("rejects short text and punctuation-only filler", () => {
    expect(listingDescriptionError("too short")).toBe(LISTING_DESCRIPTION_ERROR);
    expect(listingDescriptionError(". . .")).toBe(LISTING_DESCRIPTION_ERROR);
    expect(listingDescriptionError(" . ".repeat(30))).toBe(LISTING_DESCRIPTION_ERROR);
  });
});

describe("listingDescriptionChangeError", () => {
  it("allows an existing short description when it is not edited", () => {
    expect(listingDescriptionChangeError(". . .", ". . .")).toBeNull();
  });

  it("rejects a changed description that is still filler", () => {
    expect(listingDescriptionChangeError("short", "---- ---- ---- ---- ---- ---- ----")).toBe(
      LISTING_DESCRIPTION_ERROR,
    );
  });
});
