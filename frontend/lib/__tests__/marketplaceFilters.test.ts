import { describe, expect, it } from "vitest";
import {
  activeFilterCount,
  clearListingFilters,
  marketplaceHref,
  resetMarketplaceFilters,
  withAdvancedFilters,
  withCategory,
  withListingType,
  withSort,
} from "../marketplaceFilters";

describe("marketplace filter params", () => {
  it("writes type and clears category", () => {
    const params = new URLSearchParams("category=Watches&q=sony");
    const next = withListingType(params, "physical");
    expect(next.get("type")).toBe("physical");
    expect(next.get("category")).toBeNull();
    expect(next.get("q")).toBe("sony");
    expect(marketplaceHref(next)).toContain("type=physical");
    expect(marketplaceHref(next)).toContain("q=sony");
    expect(marketplaceHref(next)).not.toContain("category=");
  });

  it("clears type when All is selected", () => {
    const next = withListingType(new URLSearchParams("type=digital&category=NFTs"), "all");
    expect(next.get("type")).toBeNull();
    expect(next.get("category")).toBeNull();
    expect(marketplaceHref(next)).toBe("/marketplace");
  });

  it("sets category and toggles it off", () => {
    const set = withCategory(new URLSearchParams("type=physical"), "Watches");
    expect(set.get("category")).toBe("Watches");
    expect(set.get("type")).toBe("physical");
    const cleared = withCategory(set, "Watches");
    expect(cleared.get("category")).toBeNull();
    expect(cleared.get("type")).toBe("physical");
  });

  it("writes sort, price, and posted-within, and reset keeps the query", () => {
    const start = new URLSearchParams("q=sony&view=feed");
    const sorted = withSort(start, "price-asc");
    expect(sorted.get("sort")).toBe("price-asc");
    expect(withSort(sorted, "recent").get("sort")).toBeNull();

    const applied = withAdvancedFilters(sorted, {
      minPrice: "1",
      maxPrice: " ",
      postedWithin: "1w",
      condition: "Used",
      location: "Austin",
    });
    expect(applied.get("minPrice")).toBe("1");
    expect(applied.get("maxPrice")).toBeNull();
    expect(applied.get("postedWithin")).toBe("1w");
    expect(applied.get("condition")).toBe("Used");
    expect(applied.get("location")).toBe("Austin");
    expect(applied.get("sort")).toBe("price-asc");
    expect(applied.get("q")).toBe("sony");

    const reset = resetMarketplaceFilters(applied);
    expect(reset.get("q")).toBe("sony");
    expect(reset.get("view")).toBe("feed");
    expect(reset.get("minPrice")).toBeNull();
    expect(reset.get("sort")).toBeNull();
    expect(reset.get("postedWithin")).toBeNull();
    expect(marketplaceHref(reset)).toBe("/marketplace?q=sony&view=feed");
  });

  it("counts active filters and clear leaves sort in place", () => {
    expect(
      activeFilterCount({
        type: "physical",
        category: "Watches",
        minPrice: "",
        maxPrice: "9",
        postedWithin: "",
        condition: "",
        location: "",
      }),
    ).toBe(3);
    const cleared = clearListingFilters(
      new URLSearchParams("q=sony&sort=price-asc&type=physical&minPrice=1"),
    );
    expect(cleared.get("q")).toBe("sony");
    expect(cleared.get("sort")).toBe("price-asc");
    expect(cleared.get("type")).toBeNull();
    expect(cleared.get("minPrice")).toBeNull();
  });
});
