import { describe, expect, it } from "vitest";
import { SEO_COPY } from "../copy";
import { apexRedirectUrl, isNoIndexPath } from "../host";
import { listingJsonLd, serializeJsonLd } from "../jsonld";
import {
  FALLBACK_OG_IMAGE,
  FALLBACK_TWITTER_IMAGE,
  listingMetadata,
  marketplaceMetadata,
  staticPageMetadata,
} from "../metadata";
import { buildRobots, PRIVATE_PATH_PREFIXES } from "../robots";
import { buildSitemap, PUBLIC_SITEMAP_PATHS } from "../sitemap";

describe("SEO copy", () => {
  it("uses swappable marketplace and listing title patterns", () => {
    expect(SEO_COPY.marketplaceTitle).toBe("Marketplace · Hashpop");
    expect(SEO_COPY.listingTitle("Vintage Camera")).toBe("Vintage Camera · Hashpop");
    expect(SEO_COPY.marketplaceDescription.toLowerCase()).toContain("peer-to-peer");
    expect(SEO_COPY.marketplaceDescription.toLowerCase()).toContain("meetup");
    expect(SEO_COPY.marketplaceDescription.toLowerCase()).toContain("escrow");
    expect(SEO_COPY.marketplaceDescription.toLowerCase()).toContain("hedera");
  });
});

describe("canonical host redirect", () => {
  it("301s only www.hashpop.io to the apex and keeps path and query", () => {
    expect(apexRedirectUrl("www.hashpop.io", "/listing/lst-1", "?ref=share")).toBe(
      "https://hashpop.io/listing/lst-1?ref=share",
    );
    expect(apexRedirectUrl("WWW.HASHPOP.IO:443", "/marketplace", "?category=Watches")).toBe(
      "https://hashpop.io/marketplace?category=Watches",
    );
  });

  it("does not redirect apex, preview, or other hosts", () => {
    expect(apexRedirectUrl("hashpop.io", "/marketplace", "")).toBeNull();
    expect(apexRedirectUrl("hashpop-git-seo.vercel.app", "/marketplace", "?q=1")).toBeNull();
    expect(apexRedirectUrl("localhost:3000", "/marketplace", "")).toBeNull();
    expect(apexRedirectUrl(null, "/", "")).toBeNull();
  });

  it("marks admin, auth-only, and api paths as noindex", () => {
    expect(isNoIndexPath("/admin")).toBe(true);
    expect(isNoIndexPath("/admin/listings")).toBe(true);
    expect(isNoIndexPath("/purchases/abc")).toBe(true);
    expect(isNoIndexPath("/api/geocode")).toBe(true);
    expect(isNoIndexPath("/marketplace")).toBe(false);
    expect(isNoIndexPath("/listing/lst-1")).toBe(false);
    expect(isNoIndexPath("/help")).toBe(false);
  });
});

describe("marketplace metadata", () => {
  it("sets an absolute apex canonical and non-generic title", () => {
    const meta = marketplaceMetadata();
    expect(meta.title).toEqual({ absolute: "Marketplace · Hashpop" });
    expect(meta.description).toBe(SEO_COPY.marketplaceDescription);
    expect(meta.alternates?.canonical).toBe("https://hashpop.io/marketplace");
    expect(meta.openGraph?.title).toBe("Marketplace · Hashpop");
    expect(meta.openGraph?.url).toBe("https://hashpop.io/marketplace");
    expect(meta.openGraph?.images).toEqual([{ ...FALLBACK_OG_IMAGE }]);
    expect(meta.twitter && "card" in meta.twitter ? meta.twitter.card : undefined).toBe(
      "summary_large_image",
    );
    expect(meta.twitter && "images" in meta.twitter ? meta.twitter.images : undefined).toEqual([
      FALLBACK_TWITTER_IMAGE,
    ]);
  });
});

describe("listing metadata", () => {
  const listing = {
    id: "0x6c73742d31000000000000000000000000000000000000000000000000000000",
    title: "Vintage Camera",
    description:
      "A well kept rangefinder with meetup pickup in the city and a long description that should be truncated for the meta description so search snippets stay readable and do not run on forever past the usual limit.",
    price: "84",
    status: "LISTED",
    requireEscrow: true,
    condition: "Excellent",
    city: "Austin",
    imageUrl: "https://cdn.hashpop.io/camera.jpg",
    mediaUrls: ["https://cdn.hashpop.io/camera.jpg"],
  };

  it("builds title, truncated description, image, and apex canonical", () => {
    const meta = listingMetadata("lst-1", listing);
    expect(meta.title).toEqual({ absolute: "Vintage Camera · Hashpop" });
    expect(String(meta.description).length).toBeLessThanOrEqual(160);
    expect(meta.description).toContain("rangefinder");
    expect(meta.description).toMatch(/escrow/i);
    expect(meta.alternates?.canonical).toBe("https://hashpop.io/listing/lst-1");
    expect(meta.openGraph?.images).toEqual([{ url: "https://cdn.hashpop.io/camera.jpg" }]);
    expect(
      listingMetadata("lst-1", { ...listing, imageUrl: null, mediaUrls: [] }).openGraph?.images,
    ).toEqual([{ ...FALLBACK_OG_IMAGE }]);
    expect(meta.twitter && "card" in meta.twitter ? meta.twitter.card : undefined).toBe(
      "summary_large_image",
    );
    expect(meta.twitter && "images" in meta.twitter ? meta.twitter.images : undefined).toEqual([
      "https://cdn.hashpop.io/camera.jpg",
    ]);
  });

  it("canonicalizes bytes32 ids to the short listing path", () => {
    const meta = listingMetadata(listing.id, listing);
    expect(meta.alternates?.canonical).toBe("https://hashpop.io/listing/lst-1");
  });

  it("falls back when the listing is missing without a generic Hashpop title", () => {
    const meta = listingMetadata("missing", null);
    expect(meta.title).toEqual({ absolute: SEO_COPY.listingFallbackTitle });
    expect(meta.alternates?.canonical).toBe("https://hashpop.io/listing/missing");
    expect(meta.description).toBeTruthy();
  });
});

describe("static page metadata", () => {
  it("attaches an absolute canonical on the apex", () => {
    const meta = staticPageMetadata({
      title: "Help Center · Hashpop",
      description: "Help",
      path: "/help",
    });
    expect(meta.alternates?.canonical).toBe("https://hashpop.io/help");
    expect(meta.openGraph?.url).toBe("https://hashpop.io/help");
  });
});

describe("Product / Offer JSON-LD", () => {
  it("describes the listing as a Product with an HBAR Offer", () => {
    const data = listingJsonLd("lst-1", {
      id: "lst-1",
      title: "Vintage Camera",
      description: "Rangefinder",
      price: "84.5",
      status: "LISTED",
      requireEscrow: false,
      imageUrl: null,
      mediaUrls: ["https://cdn.hashpop.io/camera.jpg"],
      category: "Cameras",
    });
    expect(data["@context"]).toBe("https://schema.org");
    expect(data["@type"]).toBe("Product");
    expect(data.name).toBe("Vintage Camera");
    expect(data.image).toEqual(["https://cdn.hashpop.io/camera.jpg"]);
    expect(data.offers).toMatchObject({
      "@type": "Offer",
      priceCurrency: "HBAR",
      price: "84.5",
      availability: "https://schema.org/InStock",
      url: "https://hashpop.io/listing/lst-1",
    });
  });

  it("normalizes legacy wei prices to HBAR", () => {
    const data = listingJsonLd("a", {
      id: "a",
      title: "Wei",
      price: "2000000000000000000",
      status: "LISTED",
    });
    expect(data.offers.price).toBe("2");
    expect(data.offers.priceCurrency).toBe("HBAR");
  });

  it("maps sold and locked listings to schema availability", () => {
    expect(
      listingJsonLd("a", { id: "a", title: "Sold", price: "2", status: "SOLD" }).offers
        .availability,
    ).toBe("https://schema.org/SoldOut");
    expect(
      listingJsonLd("a", { id: "a", title: "Locked", price: "2", status: "LOCKED" }).offers
        .availability,
    ).toBe("https://schema.org/LimitedAvailability");
  });

  it("escapes script-breaking characters when serialized", () => {
    const serialized = serializeJsonLd(
      listingJsonLd("a", {
        id: "a",
        title: "Safe",
        description: "</script><script>alert(1)</script>",
        price: "1",
        status: "LISTED",
      }),
    );
    expect(serialized).not.toContain("</script>");
    expect(serialized).toContain("\\u003c");
  });
});

describe("robots.txt", () => {
  it("allows public crawl and disallows private routes", () => {
    const robots = buildRobots();
    expect(robots.sitemap).toBe("https://hashpop.io/sitemap.xml");
    expect(robots.host).toBe("https://hashpop.io");
    const rule = Array.isArray(robots.rules) ? robots.rules[0] : robots.rules;
    expect(rule.userAgent).toBe("*");
    expect(rule.allow).toBe("/");
    for (const prefix of ["/admin", "/dashboard", "/messages", "/cart", "/api/", "/create"]) {
      expect(rule.disallow).toContain(prefix);
    }
    expect(rule.disallow).not.toContain("/marketplace");
    expect(rule.disallow).not.toContain("/listing");
    expect(PRIVATE_PATH_PREFIXES).toContain("/admin");
  });
});

describe("sitemap.xml", () => {
  it("includes key public routes and public listings, not private routes", () => {
    const entries = buildSitemap([
      {
        id: "lst-9",
        status: "LISTED",
        createdAt: "2026-09-01T00:00:00.000Z",
      },
      { id: "lst-sold", status: "SOLD", createdAt: "2026-09-01T00:00:00.000Z" },
      { id: "", status: "LISTED" },
    ]);
    const urls = entries.map((entry) => entry.url);
    expect(urls).toContain("https://hashpop.io/marketplace");
    expect(urls).toContain("https://hashpop.io/categories");
    expect(urls).toContain("https://hashpop.io/help");
    expect(urls).toContain("https://hashpop.io/listing/lst-9");
    expect(urls.some((url) => url.includes("/admin"))).toBe(false);
    expect(urls.some((url) => url.includes("lst-sold"))).toBe(false);
    expect(PUBLIC_SITEMAP_PATHS).toContain("/marketplace");
    expect(PUBLIC_SITEMAP_PATHS).not.toContain("/admin");
    const listing = entries.find((entry) => entry.url.endsWith("/listing/lst-9"));
    expect(listing?.lastModified).toBe("2026-09-01T00:00:00.000Z");
  });
});
