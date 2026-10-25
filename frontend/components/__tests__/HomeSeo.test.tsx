import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HomeAbout, HomeIntro } from "../home/HomeSeo";
import { homeCopyWordCount } from "../../content/home";
import { HOMEPAGE_SEO } from "../../lib/seo/homepage";
import { SEO_COPY } from "../../lib/seo/copy";

describe("homepage SEO copy", () => {
  it("keeps escrow in the shared title and H1", () => {
    expect(HOMEPAGE_SEO.title).toBe("Hashpop – P2P Marketplace on Hedera | HBAR Escrow");
    expect(HOMEPAGE_SEO.h1).toBe("Buy and sell real stuff on Hedera, with HBAR escrow");
    expect(HOMEPAGE_SEO.title).toContain("Escrow");
    expect(HOMEPAGE_SEO.h1).toContain("escrow");
    expect(SEO_COPY.rootTitle).toBe("Hashpop — Reputation, chat & escrow on your wallet");
  });

  it("server-renders one h1, three h2s, and the three links", () => {
    const html =
      renderToStaticMarkup(createElement(HomeIntro)) +
      renderToStaticMarkup(createElement(HomeAbout));
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(html.match(/<h2[\s>]/g)).toHaveLength(3);
    expect(html).toContain(HOMEPAGE_SEO.h1);
    expect(html).toContain("Reputation. Chat. Escrow. On your wallet.");
    expect(html).toContain("How HBAR escrow works");
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
