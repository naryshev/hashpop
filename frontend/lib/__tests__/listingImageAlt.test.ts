import { describe, expect, it } from "vitest";
import { listingImageAlt } from "../listingImageAlt";

describe("listingImageAlt", () => {
  it("uses the listing title for the cover image", () => {
    expect(listingImageAlt("Galaxy Gas", 0)).toBe("Galaxy Gas");
  });

  it("numbers extra photos after the cover", () => {
    expect(listingImageAlt("Galaxy Gas", 1)).toBe("Galaxy Gas, photo 2");
    expect(listingImageAlt("Galaxy Gas", 2)).toBe("Galaxy Gas, photo 3");
  });

  it("trims the title", () => {
    expect(listingImageAlt("  Galaxy Gas  ", 1)).toBe("Galaxy Gas, photo 2");
  });
});
