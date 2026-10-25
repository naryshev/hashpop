import { describe, expect, it } from "vitest";
import { SEO_COPY } from "../copy";
import { apexRedirectUrl, isNoIndexPath } from "../host";
import { listingOfferPriceLabel } from "../../hbarUsd";
import {
  faqPageJsonLd,
  listingJsonLd,
  ORGANIZATION_LOGO_URL,
  SEARCH_URL_TEMPLATE,
  serializeJsonLd,
  siteJsonLd,
  WEBSITE_URL,
} from "../jsonld";
import { FAQS } from "../../help/faqs";
import {
  FALLBACK_OG_IMAGE,
  FALLBACK_TWITTER_IMAGE,
  listingMetadata,
  listingNotFoundDocumentMetadata,
  listingNotFoundMetadata,
  listingUnavailableMetadata,
  marketplaceMetadata,
  staticPageMetadata,
} from "../metadata";
import { buildRobots, ROBOTS_ALLOW, ROBOTS_DISALLOW } from "../robots";
import { buildSitemap, PUBLIC_SITEMAP_PATHS } from "../sitemap";

describe("SEO copy", () => {
  it("keeps the research strings verbatim", () => {
    expect(SEO_COPY.rootTitle).toBe("Hashpop — Reputation, chat & escrow on your wallet");
    expect(SEO_COPY.rootDescription).toBe(
      "Buy and sell real stuff on Hedera with wallet reputation, encrypted deal chat, and HBAR escrow. Meetups with a contract.",
    );
    expect(SEO_COPY.marketplaceTitle).toBe("Marketplace · Hashpop");
    expect(SEO_COPY.marketplaceDescription).toBe(
      "Browse listings settled in HBAR — escrow, wallet chat, and portable reputation. Meet locally with a contract or ship.",
    );
    expect(SEO_COPY.marketplaceOgDescription).toBe(
      "P2P marketplace on Hedera: escrow, chat, and reputation on your wallet.",
    );
    expect(SEO_COPY.listingTitle("Vintage Camera", "84")).toBe("Vintage Camera · 84 ℏ · Hashpop");
    expect(SEO_COPY.listingDescriptionFallback("Vintage Camera", "84")).toBe(
      "Vintage Camera for 84 ℏ on Hashpop — escrow-backed P2P.",
    );
    expect(SEO_COPY.categoriesTitle).toBe("Browse Categories · Hashpop");
    expect(SEO_COPY.categoriesDescription).toBe(
      "Shop Hashpop by category — electronics, vehicles, fashion, collectibles, and more. Escrow and wallet reputation built in.",
    );
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
    expect(meta.openGraph?.description).toBe(SEO_COPY.marketplaceOgDescription);
    expect(meta.openGraph?.url).toBe("https://hashpop.io/marketplace");
    expect(FALLBACK_OG_IMAGE.url).toBe("https://hashpop.io/opengraph-image");
    expect(FALLBACK_TWITTER_IMAGE).toBe("https://hashpop.io/twitter-image");
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
    expect(meta.title).toEqual({ absolute: "Vintage Camera · 84 ℏ · Hashpop" });
    expect(String(meta.description).length).toBeLessThanOrEqual(155);
    expect(meta.description).toContain("rangefinder");
    expect(meta.description).not.toMatch(/escrow-backed P2P/);
    expect(meta.alternates?.canonical).toBe("https://hashpop.io/listing/lst-1");
    expect(meta.openGraph?.url).toBe("https://hashpop.io/listing/lst-1");
    expect(meta.openGraph && "type" in meta.openGraph ? meta.openGraph.type : undefined).toBe(
      "website",
    );
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

  it("uses the escrow-backed sentence when the listing has no description", () => {
    const meta = listingMetadata("lst-1", {
      ...listing,
      description: "   ",
      subtitle: null,
    });
    expect(meta.description).toBe("Vintage Camera for 84 ℏ on Hashpop — escrow-backed P2P.");
  });

  it("keeps a confirmed miss noindex without a second robots tag", () => {
    const meta = listingNotFoundMetadata();
    expect(meta.robots).toMatchObject({ index: false, follow: true });
    const documentMeta = listingNotFoundDocumentMetadata();
    expect(documentMeta.robots).toBeUndefined();
    expect(documentMeta.title).toEqual(meta.title);
    expect(documentMeta.description).toBe(meta.description);
    expect(documentMeta.alternates?.canonical).toBeUndefined();
  });

  it("does not publish a self-canonical when the listing cannot be loaded", () => {
    const meta = listingUnavailableMetadata();
    expect(meta.title).toEqual({ absolute: SEO_COPY.listingFallbackTitle });
    expect(meta.robots).toMatchObject({ index: false, follow: false });
    expect(meta.alternates?.canonical).toBeUndefined();
    expect(
      meta.openGraph && "url" in meta.openGraph ? meta.openGraph.url : undefined,
    ).toBeUndefined();
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
  const now = new Date("2026-10-25T00:00:00.000Z");
  const rate = 0.1;

  it("replaces the HBAR Offer with one USD Offer and keeps HBAR beside it", () => {
    const data = listingJsonLd(
      "lst-1",
      {
        id: "lst-1",
        title: "Vintage Camera",
        description: "Rangefinder",
        price: "84.5",
        status: "LISTED",
        requireEscrow: false,
        condition: "Like new",
        imageUrl: null,
        mediaUrls: ["https://cdn.hashpop.io/camera.jpg"],
        category: "Cameras",
      },
      { usdPerHbar: rate, now },
    );
    expect(data["@context"]).toBe("https://schema.org");
    expect(data["@type"]).toBe("Product");
    expect(data.name).toBe("Vintage Camera");
    expect(data.image).toEqual(["https://cdn.hashpop.io/camera.jpg"]);
    expect(data.itemCondition).toBe("https://schema.org/UsedCondition");
    expect(data.description).toContain("Rangefinder");
    expect(data.description).toContain("Price (HBAR): 84.5.");
    expect(data.offers).toEqual({
      "@type": "Offer",
      priceCurrency: "USD",
      price: "8.45",
      availability: "https://schema.org/InStock",
      itemCondition: "https://schema.org/UsedCondition",
      url: "https://hashpop.io/listing/lst-1",
      priceValidUntil: "2026-10-26",
    });
    expect(data.offers).not.toHaveProperty("additionalProperty");
    expect(data.additionalProperty).toEqual({
      "@type": "PropertyValue",
      name: "Price (HBAR)",
      value: "84.5",
    });
    expect(listingOfferPriceLabel("84.5", rate)).toBe("84.5 ℏ (≈ $8.45 USD)");
    const serialized = serializeJsonLd(data);
    expect(serialized).not.toContain('"priceCurrency":"HBAR"');
    expect(serialized).not.toContain("priceSpecification");
    expect(serialized.match(/"@type":"Offer"/g)).toHaveLength(1);
  });

  it("omits offers when the USD rate is missing", () => {
    const data = listingJsonLd("a", {
      id: "a",
      title: "No rate",
      price: "5",
      status: "LISTED",
      condition: "New",
    });
    expect(data.offers).toBeUndefined();
    expect(data.itemCondition).toBe("https://schema.org/NewCondition");
    expect(serializeJsonLd(data)).not.toContain("priceCurrency");
    expect(listingOfferPriceLabel("5", null)).toBeNull();
  });

  it("converts legacy wei to HBAR for the note and prices the Offer in USD", () => {
    const data = listingJsonLd(
      "a",
      {
        id: "a",
        title: "Wei",
        price: "2000000000000000000",
        status: "LISTED",
      },
      { usdPerHbar: 0.5, now },
    );
    expect(data.offers?.price).toBe("1.00");
    expect(data.offers?.priceCurrency).toBe("USD");
    expect(data.offers).not.toHaveProperty("additionalProperty");
    expect(data.additionalProperty.value).toBe("2");
  });

  it("maps active listings to InStock and everything else to SoldOut or Discontinued", () => {
    const priced = { usdPerHbar: 1, now };
    expect(
      listingJsonLd("a", { id: "a", title: "Live", price: "2", status: "LISTED" }, priced).offers
        ?.availability,
    ).toBe("https://schema.org/InStock");
    expect(
      listingJsonLd("a", { id: "a", title: "Sold", price: "2", status: "SOLD" }, priced).offers
        ?.availability,
    ).toBe("https://schema.org/SoldOut");
    expect(
      listingJsonLd("a", { id: "a", title: "Locked", price: "2", status: "LOCKED" }, priced).offers
        ?.availability,
    ).toBe("https://schema.org/SoldOut");
    expect(
      listingJsonLd("a", { id: "a", title: "Cancelled", price: "2", status: "CANCELLED" }, priced)
        .offers?.availability,
    ).toBe("https://schema.org/Discontinued");
  });

  it("escapes script-breaking characters when serialized", () => {
    const serialized = serializeJsonLd(
      listingJsonLd(
        "a",
        {
          id: "a",
          title: "Safe",
          description: "</script><script>alert(1)</script>",
          price: "1",
          status: "LISTED",
        },
        { usdPerHbar: 1, now },
      ),
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
    expect(rule.allow).toEqual([...ROBOTS_ALLOW]);
    expect(rule.disallow).toEqual([...ROBOTS_DISALLOW]);
    for (const path of [
      "/",
      "/marketplace",
      "/categories",
      "/listing/",
      "/privacy",
      "/terms",
      "/profile/",
    ]) {
      expect(rule.allow).toContain(path);
    }
    for (const path of ["/messages", "/cart", "/create", "/dashboard", "/admin", "/api/"]) {
      expect(rule.disallow).toContain(path);
    }
    expect(rule.disallow).not.toContain("/marketplace");
    expect(rule.disallow).not.toContain("/profile/");
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
    expect(urls).toContain("https://hashpop.io/privacy");
    expect(urls).toContain("https://hashpop.io/terms");
    expect(urls).toContain("https://hashpop.io/marketplace?category=Watches");
    expect(urls).toContain(
      `https://hashpop.io/marketplace?category=${encodeURIComponent("Men's Clothing")}`,
    );
    expect(urls).toContain("https://hashpop.io/listing/lst-9");
    expect(urls.some((url) => url.includes("/admin"))).toBe(false);
    expect(urls.some((url) => url.includes("lst-sold"))).toBe(false);
    expect(PUBLIC_SITEMAP_PATHS).toContain("/marketplace");
    expect(PUBLIC_SITEMAP_PATHS).not.toContain("/admin");
    const listing = entries.find((entry) => entry.url.endsWith("/listing/lst-9"));
    expect(listing?.lastModified).toBe("2026-09-01T00:00:00.000Z");
  });

  it("caps listed URLs when the catalog is huge", () => {
    const listings = Array.from({ length: 5 }, (_, i) => ({
      id: `lst-${i}`,
      status: "LISTED",
    }));
    const urls = buildSitemap(listings, { categoryPaths: [], listingCap: 2 }).map((e) => e.url);
    expect(urls.filter((url) => url.includes("/listing/"))).toEqual([
      "https://hashpop.io/listing/lst-0",
      "https://hashpop.io/listing/lst-1",
    ]);
  });
});

describe("site JSON-LD", () => {
  it("publishes one Organization and one WebSite on the apex", () => {
    const data = siteJsonLd();
    expect(data["@graph"].map((node) => node["@type"])).toEqual(["Organization", "WebSite"]);
    expect(data["@graph"][0]).toMatchObject({
      name: "Hashpop",
      url: "https://hashpop.io",
      logo: ORGANIZATION_LOGO_URL,
      description: SEO_COPY.rootDescription,
    });
    expect(ORGANIZATION_LOGO_URL).toBe("https://hashpop.io/hashpop-cart-3d.PNG");
    expect(data["@graph"][1]).toMatchObject({
      name: "Hashpop",
      url: WEBSITE_URL,
      description: SEO_COPY.marketplaceDescription,
    });
    expect(WEBSITE_URL).toBe("https://hashpop.io/");
    expect(data["@graph"][1].potentialAction).toEqual({
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: SEARCH_URL_TEMPLATE,
      },
      "query-input": "required name=search_term_string",
    });
    expect(SEARCH_URL_TEMPLATE).toBe("https://hashpop.io/marketplace?q={search_term_string}");
    expect(data["@graph"].some((node) => node["@type"] === "Product")).toBe(false);
  });
});

describe("FAQPage JSON-LD", () => {
  it("mirrors the visible help questions and answers in order", () => {
    const data = faqPageJsonLd(FAQS);
    const visible = FAQS.flatMap((group) => group.items);
    expect(data["@type"]).toBe("FAQPage");
    expect(data.mainEntity).toHaveLength(visible.length);
    data.mainEntity.forEach((entity, index) => {
      expect(entity.name).toBe(visible[index]?.q);
      expect(entity.acceptedAnswer.text).toBe(visible[index]?.a);
    });
    expect(data.mainEntity[0]?.name).toBe("How do I connect HashPack?");
    const serialized = serializeJsonLd(data);
    expect(serialized).not.toContain("</script>");
  });
});
