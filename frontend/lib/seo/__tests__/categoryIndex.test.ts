import { describe, expect, it } from "vitest";
import { countActiveListingsInCategory } from "../../marketplaceCategory";
import { marketplaceMetadata } from "../metadata";
import { buildRequestSitemap, fetchPublicListings } from "../publicListings";
import { withEmptyCategoryRobots } from "../categoryRobots";

const cars = {
  id: "lst-car",
  status: "LISTED",
  category: "Cars & Trucks",
  createdAt: "2026-09-15T21:54:28.821Z",
  updatedAt: "2026-10-25T19:31:05.909Z",
};

describe("active category counts", () => {
  it("counts active listings for a category from the rows it is given", () => {
    const listings = [
      cars,
      { id: "lst-sold", status: "SOLD", category: "Cars & Trucks" },
      { id: "lst-watch", status: "LISTED", category: "watch" },
      { id: "", status: "LISTED", category: "Books" },
    ];
    expect(countActiveListingsInCategory(listings, "Cars & Trucks")).toBe(1);
    expect(countActiveListingsInCategory(listings, "car")).toBe(1);
    expect(countActiveListingsInCategory(listings, "Watches")).toBe(1);
    expect(countActiveListingsInCategory(listings, "Laptops")).toBe(0);
    expect(countActiveListingsInCategory(listings, "Books")).toBe(0);
    expect(countActiveListingsInCategory(listings, "")).toBe(0);
  });
});

describe("empty category robots", () => {
  const base = marketplaceMetadata();

  it("leaves the unfiltered marketplace indexable without changing title, description, or canonical", () => {
    const meta = withEmptyCategoryRobots(base, { ok: true, listings: [cars] }, undefined);
    expect(meta).toBe(base);
    expect(meta.robots).toBeUndefined();
    expect(meta.title).toEqual({ absolute: "Marketplace · Hashpop" });
    expect(meta.description).toBe(base.description);
    expect(meta.alternates?.canonical).toBe("https://hashpop.io/marketplace");
  });

  it("emits noindex,follow when the category has no active listings", () => {
    const meta = withEmptyCategoryRobots(base, { ok: true, listings: [cars] }, "Watches");
    expect(meta.robots).toBe("noindex,follow");
    expect(meta.title).toEqual(base.title);
    expect(meta.description).toBe(base.description);
    expect(meta.alternates).toEqual(base.alternates);
  });

  it("stays indexable when the category has an active listing", () => {
    const meta = withEmptyCategoryRobots(base, { ok: true, listings: [cars] }, "Cars & Trucks");
    expect(meta.robots).toBeUndefined();
    expect(meta).toBe(base);
    expect(
      withEmptyCategoryRobots(base, { ok: true, listings: [cars] }, "car").robots,
    ).toBeUndefined();
  });

  it("does not noindex when the listing feed could not be loaded", () => {
    const meta = withEmptyCategoryRobots(base, { ok: false, listings: [] }, "Watches");
    expect(meta).toBe(base);
    expect(meta.robots).toBeUndefined();
  });
});

describe("sitemap request", () => {
  it("builds category URLs from the fetched feed and falls back when that fetch throws", async () => {
    const loaded = await buildRequestSitemap(async () => ({ ok: true, listings: [cars] }));
    const urls = loaded.map((entry) => entry.url);
    expect(urls.filter((url) => url.includes("category="))).toEqual([
      "https://hashpop.io/marketplace?category=Cars%20%26%20Trucks",
    ]);
    expect(urls).toContain("https://hashpop.io/");
    expect(loaded.find((entry) => entry.url === "https://hashpop.io/")?.priority).toBe(1);
    expect(loaded.find((entry) => entry.url.endsWith("/listing/lst-car"))?.lastModified).toBe(
      "2026-10-25T19:31:05.909Z",
    );

    const fallback = await buildRequestSitemap(async () => {
      throw new Error("ECONNREFUSED");
    });
    expect(fallback.some((entry) => entry.url.includes("category="))).toBe(false);
    expect(fallback.some((entry) => entry.url.includes("/listing/"))).toBe(false);
    expect(fallback[0]?.url).toBe("https://hashpop.io/");
  });

  it("treats a failed response as an empty feed instead of throwing", async () => {
    const entries = await buildRequestSitemap(async () => ({ ok: false, listings: [] }));
    expect(entries.some((entry) => entry.url.includes("category="))).toBe(false);
    expect(entries.map((entry) => entry.url)).toContain("https://hashpop.io/help");
  });

  it("reads listings from the public feed and returns none when it is down", async () => {
    const down = await fetchPublicListings(async () => new Response("nope", { status: 503 }));
    expect(down).toEqual({ ok: false, listings: [] });

    const bad = await fetchPublicListings(async () => new Response("not-json", { status: 200 }));
    expect(bad).toEqual({ ok: false, listings: [] });

    const up = await fetchPublicListings(
      async () => new Response(JSON.stringify({ listings: [cars] }), { status: 200 }),
    );
    expect(up).toEqual({ ok: true, listings: [cars] });
  });
});
