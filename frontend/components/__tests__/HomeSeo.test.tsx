import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HomeAbout, HomeIntro } from "../home/HomeSeo";
import { homeCopyWordCount } from "../../content/home";
import { HOMEPAGE_SEO } from "../../lib/seo/homepage";
import { SEO_COPY } from "../../lib/seo/copy";

describe("homepage SEO copy", () => {
  it("uses protected payments in the shared title, H1, and description", () => {
    expect(HOMEPAGE_SEO.title).toBe("Hashpop – P2P Hedera Marketplace | Protected HBAR Payments");
    expect(HOMEPAGE_SEO.h1).toBe("Buy and sell real stuff on Hedera, with protected HBAR payments");
    expect(HOMEPAGE_SEO.title.length).toBeLessThanOrEqual(60);
    expect(HOMEPAGE_SEO.title).not.toMatch(/escrow/i);
    expect(HOMEPAGE_SEO.h1).not.toMatch(/escrow/i);
    expect(HOMEPAGE_SEO.description).not.toMatch(/escrow/i);
    expect(HOMEPAGE_SEO.websiteDescription).not.toMatch(/escrow/i);
    expect(SEO_COPY.rootTitle).toBe("Hashpop — Reputation, chat & escrow on your wallet");
  });

  it("server-renders one h1, the section h2s, and the three links", () => {
    const html =
      renderToStaticMarkup(createElement(HomeIntro)) +
      renderToStaticMarkup(createElement(HomeAbout));
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(html.match(/<h2[\s>]/g)).toHaveLength(4);
    expect(html).toContain(">About Hashpop</h2>");
    expect(html).toContain(HOMEPAGE_SEO.h1);
    expect(html).toContain("Reputation. Chat. Protected payments. On your wallet.");
    expect(html).toContain("How HBAR escrow works");
    expect(html).toContain("and pay in HBAR. If the listing offers escrow:");
    expect(html).toContain("when the seller offers it, lock the money in on-chain HBAR escrow");
    expect(html).toContain("Funds lock in escrow.");
    expect(html).toContain(`>${HOMEPAGE_SEO.h1}</h1>`);
    expect(html).toContain("Get started");
    expect(html).toContain('href="/marketplace"');
    expect(html).toContain('href="/categories"');
    expect(html).toContain('href="/help"');
    expect(html).toContain("Browse the marketplace");
    expect(html).toContain("<details");
    expect(html).toContain("Hashpop is a peer-to-peer marketplace");
    expect(html).toContain("Buying close to home? Open ");
    expect(html).toContain(">Nearby</a>");
    expect(html).toContain("makes the next one easier.");
    const nearby = html.indexOf("Buying close to home?");
    const cta = html.indexOf("Browse the marketplace");
    expect(nearby).toBeGreaterThan(html.indexOf("Get started"));
    expect(nearby).toBeLessThan(cta);
    expect(homeCopyWordCount()).toBeGreaterThan(250);
    expect(homeCopyWordCount()).toBeLessThan(360);
  });
});
