import { describe, expect, it } from "vitest";
import { MAX_LISTING_VARIANTS, parseListingVariants } from "../listingVariants";

describe("parseListingVariants", () => {
  it("returns empty for missing data so legacy listings keep working", () => {
    expect(parseListingVariants(undefined)).toEqual([]);
    expect(parseListingVariants(null)).toEqual([]);
  });

  it("accepts label + absolute price + optional media index", () => {
    expect(
      parseListingVariants([
        { id: "sku-1", label: "Midnight", price: "199", mediaIndex: 2 },
        { id: "sku-2", label: "Starlight", price: "210" },
      ]),
    ).toEqual([
      { id: "sku-1", label: "Midnight", price: "199", mediaIndex: 2 },
      { id: "sku-2", label: "Starlight", price: "210", mediaIndex: null },
    ]);
  });

  it("drops incomplete rows instead of failing the listing", () => {
    const parsed = parseListingVariants([
      { label: "Good", price: "10" },
      { label: "Bad" },
      null,
      { label: "Also bad", price: "0" },
    ]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].label).toBe("Good");
    expect(parsed[0].price).toBe("10");
  });

  it("caps stored variants", () => {
    const raw = Array.from({ length: 30 }, (_, i) => ({
      id: `id-${i}`,
      label: `L${i}`,
      price: "1",
    }));
    expect(parseListingVariants(raw)).toHaveLength(MAX_LISTING_VARIANTS);
  });
});
