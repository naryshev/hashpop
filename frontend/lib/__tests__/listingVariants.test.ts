import { describe, expect, it } from "vitest";
import {
  MAX_LISTING_VARIANTS,
  newListingVariant,
  parseListingVariants,
  resolveListingPrice,
  selectedListingVariant,
  validateListingVariantsDraft,
} from "../listingVariants";

describe("parseListingVariants", () => {
  it("returns empty for missing, null, or non-array input", () => {
    expect(parseListingVariants(undefined)).toEqual([]);
    expect(parseListingVariants(null)).toEqual([]);
    expect(parseListingVariants("nope")).toEqual([]);
    expect(parseListingVariants({})).toEqual([]);
  });

  it("keeps valid variants and drops invalid ones", () => {
    const parsed = parseListingVariants([
      { id: "a", label: " Black 128 ", price: "100", mediaIndex: 0 },
      { id: "b", label: "  ", price: "90" },
      { label: "Blue", price: "0" },
      { label: "Gold", price: "-1" },
      { id: "c", label: "Blue 256", price: "120.5", mediaIndex: "2" },
      { id: "d", label: "Nope", price: "abc" },
    ]);
    expect(parsed).toEqual([
      { id: "a", label: "Black 128", price: "100", mediaIndex: 0 },
      { id: "c", label: "Blue 256", price: "120.5", mediaIndex: 2 },
    ]);
  });

  it("caps at MAX_LISTING_VARIANTS", () => {
    const raw = Array.from({ length: MAX_LISTING_VARIANTS + 5 }, (_, i) => ({
      id: `v${i}`,
      label: `Opt ${i}`,
      price: "1",
    }));
    expect(parseListingVariants(raw)).toHaveLength(MAX_LISTING_VARIANTS);
  });
});

describe("resolveListingPrice", () => {
  it("uses listing price when there are no variants", () => {
    expect(resolveListingPrice({ listingPrice: "42", variants: null })).toBe("42");
    expect(resolveListingPrice({ listingPrice: "42", variants: [] })).toBe("42");
  });

  it("uses the selected variant price, defaulting to the first option", () => {
    const variants = [
      { id: "a", label: "128", price: "100", mediaIndex: null },
      { id: "b", label: "256", price: "130", mediaIndex: 1 },
    ];
    expect(resolveListingPrice({ listingPrice: "100", variants })).toBe("100");
    expect(resolveListingPrice({ listingPrice: "100", variants, selectedVariantId: "b" })).toBe(
      "130",
    );
    expect(
      resolveListingPrice({ listingPrice: "100", variants, selectedVariantId: "missing" }),
    ).toBe("100");
  });
});

describe("selectedListingVariant", () => {
  it("returns null when empty and first when id is missing", () => {
    expect(selectedListingVariant([], null)).toBeNull();
    const variants = [
      newListingVariant({ id: "a", label: "A", price: "1" }),
      newListingVariant({ id: "b", label: "B", price: "2" }),
    ];
    expect(selectedListingVariant(variants, null)?.id).toBe("a");
    expect(selectedListingVariant(variants, "b")?.id).toBe("b");
  });
});

describe("validateListingVariantsDraft", () => {
  it("allows empty variants and rejects blank labels or prices", () => {
    expect(validateListingVariantsDraft([])).toBeNull();
    expect(
      validateListingVariantsDraft([newListingVariant({ label: "Black", price: "10" })]),
    ).toBeNull();
    expect(validateListingVariantsDraft([newListingVariant({ label: "", price: "10" })])).toMatch(
      /name/i,
    );
    expect(
      validateListingVariantsDraft([newListingVariant({ label: "Black", price: "0" })]),
    ).toMatch(/price/i);
  });
});
