import { createElement } from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MarketplaceHeading } from "../marketplace/MarketplaceHeading";
import { HomeMarketplaceHeading } from "../home/HomeSeo";
import { HOMEPAGE_SEO } from "../../lib/seo/homepage";
import { SEO_COPY } from "../../lib/seo/copy";

describe("marketplace H1", () => {
  it("keeps a visually hidden /marketplace h1 distinct from the homepage heading", () => {
    const html = renderToStaticMarkup(createElement(MarketplaceHeading));
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(html).toContain('class="sr-only"');
    expect(html).toContain('data-testid="marketplace-h1"');
    expect(html).toContain(`>${SEO_COPY.marketplaceH1}</h1>`);
    expect(SEO_COPY.marketplaceH1).toBe("Browse listings settled in HBAR");
    expect(SEO_COPY.marketplaceH1).not.toBe(HOMEPAGE_SEO.h1);
    expect(SEO_COPY.marketplaceH1).not.toMatch(/escrow/i);
  });

  it("is rendered from the /marketplace server page, not MarketplacePageClient, so / stays at one h1", () => {
    const root = resolve(__dirname, "../..");
    const client = readFileSync(resolve(root, "app/marketplace/marketplace-page-client.tsx"), "utf8");
    const marketplacePage = readFileSync(resolve(root, "app/marketplace/page.tsx"), "utf8");
    const homePage = readFileSync(resolve(root, "app/page.tsx"), "utf8");

    expect(client).not.toMatch(/<h1[\s>]/);
    expect(client).not.toContain("MarketplaceHeading");
    expect(client).not.toContain("HomeMarketplaceHeading");

    expect(marketplacePage).toContain("MarketplaceHeading");
    expect(marketplacePage).not.toContain("HomeMarketplaceHeading");

    expect(homePage).toContain("HomeMarketplaceHeading");
    expect(homePage.replaceAll("HomeMarketplaceHeading", "")).not.toContain("MarketplaceHeading");

    const homeHtml = renderToStaticMarkup(createElement(HomeMarketplaceHeading));
    const marketHtml = renderToStaticMarkup(createElement(MarketplaceHeading));
    expect(homeHtml.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(marketHtml.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(homeHtml).not.toContain(SEO_COPY.marketplaceH1);
    expect(marketHtml).not.toContain(HOMEPAGE_SEO.h1);
  });
});
