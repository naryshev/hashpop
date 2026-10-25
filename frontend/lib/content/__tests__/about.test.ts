import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { helpFaqQuestions } from "../help";
import {
  ABOUT_PAGE,
  ABOUT_UNCONFIRMED,
  BRAND,
  aboutFaqPageJsonLd,
  applyEscrowTerm,
  publishedAboutFaqs,
  renderAboutSpans,
} from "../about";
import AboutPage, { metadata } from "../../../app/about/page";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => createElement("a", { href, ...rest }, children),
}));

function normalizeQuestion(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

describe("about and help FAQ questions", () => {
  it("fails when /about and /help publish the same question", () => {
    const help = new Set(helpFaqQuestions().map(normalizeQuestion));
    const duplicates = publishedAboutFaqs()
      .map((faq) => faq.question)
      .filter((question) => help.has(normalizeQuestion(question)));
    expect(help.has(normalizeQuestion("How does escrow work?"))).toBe(true);
    expect(duplicates).toEqual([]);
  });
});

const FEE_SENTENCE =
  "Hashpop charges no fee on sales with protected payments. Direct sales carry a 2% fee, taken from the seller's proceeds; buyers pay the listed price.";

function userFacingAboutCopy(): string {
  return [
    ABOUT_PAGE.title,
    ABOUT_PAGE.description,
    ABOUT_PAGE.h1,
    ABOUT_PAGE.lede,
    ...ABOUT_PAGE.why,
    ...ABOUT_PAGE.pillars.flatMap((pillar) => [pillar.lead, pillar.body]),
    ABOUT_PAGE.finePrint,
    ABOUT_PAGE.cta.label,
    ...publishedAboutFaqs().flatMap((faq) => [faq.question, faq.answerText]),
    JSON.stringify(aboutFaqPageJsonLd()),
    String(metadata.description ?? ""),
    String(metadata.openGraph?.description ?? ""),
    String(metadata.twitter?.description ?? ""),
  ].join("\n");
}

describe("about copy", () => {
  it("keeps protected payments as one swappable term", () => {
    expect(BRAND.escrowTerm).toBe("protected payments");
    expect(BRAND.escrowTermCap).toBe("Protected payments");
    expect(applyEscrowTerm("on-chain {ESCROW} contract")).toBe(
      `on-chain ${BRAND.escrowTerm} contract`,
    );
    expect(applyEscrowTerm("{ESCROW_CAP} we never hold.")).toBe(
      `${BRAND.escrowTermCap} we never hold.`,
    );
    expect(ABOUT_PAGE.h1).toBe("Real stuff. Real people. Paid in HBAR.");
    expect(ABOUT_PAGE.lede).toContain(
      `optional ${BRAND.escrowTerm} in an on-chain contract, all tied to your wallet.`,
    );
    expect(ABOUT_PAGE.pillars.map((pillar) => pillar.lead)).toContain(
      `${BRAND.escrowTermCap} we never hold.`,
    );
    const hold = ABOUT_PAGE.pillars.find((pillar) => pillar.id === "hold");
    expect(hold?.body).toBe(
      "When a listing offers them, payment locks in an on-chain contract until the buyer confirms. Hashpop never has custody of your funds.",
    );
    expect(ABOUT_PAGE.description).toContain(
      `Sellers can offer ${BRAND.escrowTerm}, which hold the funds in an on-chain contract.`,
    );
    expect(userFacingAboutCopy()).not.toMatch(/\bescrow\b/i);
    expect(userFacingAboutCopy()).toContain("Look for the Protected badge before you pay.");
    expect(ABOUT_PAGE.why[1]).toContain("can wait");
    expect(ABOUT_PAGE.why[1]).toContain("you can have a contract");
    expect(ABOUT_PAGE.pillars[0]?.body).not.toMatch(/protected payments/i);
    expect(ABOUT_PAGE.pillars[3]?.body).toContain("When a listing offers protected payments");
    const faqs = publishedAboutFaqs();
    const answer = (question: string) =>
      faqs.find((faq) => faq.question === question)?.answerText ?? "";
    expect(answer("Is it safe to pay for things in crypto?")).toContain(
      "On listings with protected payments",
    );
    expect(answer("Who holds my money while a deal is open, and what if it goes wrong?")).toContain(
      "When a listing offers protected payments",
    );
    expect(answer("How do local meetups work?")).toContain(
      "if the listing offers protected payments",
    );
  });

  it("hides only unconfirmed sentences, and keeps the surrounding answers", () => {
    expect(ABOUT_UNCONFIRMED.map((fact) => fact.confirmed)).toEqual([false, false, true]);
    const hidden = ABOUT_UNCONFIRMED.filter((fact) => !fact.confirmed).map((fact) => fact.text);
    expect(hidden).toEqual([
      "Dispute resolution: who decides, timelines, refund path — Daniel to confirm before publishing",
      "List other supported wallets if any.",
    ]);
    expect(applyEscrowTerm(ABOUT_UNCONFIRMED[2].text)).toBe(FEE_SENTENCE);

    expect(
      renderAboutSpans([
        { type: "text", text: "Before. " },
        { type: "unconfirmed", confirmed: false, text: hidden[0] },
        { type: "text", text: "After." },
      ]).text,
    ).toBe("Before. After.");
    expect(
      renderAboutSpans([
        { type: "text", text: "Before. " },
        { type: "unconfirmed", confirmed: true, text: `${hidden[0]}.` },
        { type: "text", text: " After." },
      ]).text,
    ).toBe(`Before. ${hidden[0]}. After.`);

    const faqs = publishedAboutFaqs();
    const byQuestion = Object.fromEntries(faqs.map((faq) => [faq.question, faq.answerText]));
    expect(byQuestion["Who holds my money while a deal is open, and what if it goes wrong?"]).toBe(
      "When a listing offers protected payments, you pay and the HBAR locks in the contract. The seller ships or meets you, and you confirm to release it. If the item never shows up or isn't as described, don't confirm; open a dispute from the deal instead. Step-by-step details live in How it works.",
    );
    expect(byQuestion["What wallet do I need?"]).toBe(
      "A Hedera wallet. We support HashPack, the most popular one: install it, add a little HBAR, and connect. There are no passwords to create, and your wallet address is your account.",
    );
    expect(byQuestion["What does it cost?"]).toBe(
      `${FEE_SENTENCE} Every transaction pays a small Hedera network fee, which is usually a fraction of a cent. USD values shown on Hashpop are approximate, based on the current HBAR price; all payments are made in HBAR.`,
    );
    expect(byQuestion["What does it cost?"]).not.toContain(" also ");

    const published = JSON.stringify(faqs);
    for (const fact of hidden) {
      expect(published).not.toContain(fact);
    }
  });

  it("points the deal FAQ at /help because /how-it-works is not a route", () => {
    const deal = publishedAboutFaqs().find((faq) => faq.question.startsWith("Who holds my money"));
    expect(deal?.links).toEqual([{ href: "/help", text: "How it works" }]);
    const sell = publishedAboutFaqs().find((faq) =>
      faq.question.startsWith("Can I sell items for crypto"),
    );
    expect(sell?.links).toEqual([{ href: "/help#selling", text: "Selling on Hashpop" }]);
    expect(JSON.stringify(publishedAboutFaqs())).not.toContain("/how-it-works");
    expect(JSON.stringify(publishedAboutFaqs())).not.toContain("/sell");
    expect(JSON.stringify(publishedAboutFaqs())).not.toContain("/listing/create");
  });
});

describe("about FAQPage JSON-LD", () => {
  it("mirrors the published FAQ and does not repeat Organization or WebSite", () => {
    const faqs = publishedAboutFaqs();
    const data = aboutFaqPageJsonLd();
    expect(data["@type"]).toBe("FAQPage");
    expect("@" + "graph" in data).toBe(false);
    expect(JSON.stringify(data)).not.toContain("Organization");
    expect(JSON.stringify(data)).not.toContain("WebSite");
    expect(data.mainEntity).toHaveLength(faqs.length);
    expect(data.mainEntity.map((entity) => entity.name)).toEqual(faqs.map((faq) => faq.question));
    expect(data.mainEntity.map((entity) => entity.acceptedAnswer.text)).toEqual(
      faqs.map((faq) => faq.answerText),
    );
    const json = JSON.stringify(data);
    expect(json).toContain(FEE_SENTENCE);
    expect(json).toContain("Look for the Protected badge before you pay.");
    for (const fact of ABOUT_UNCONFIRMED) {
      if (fact.confirmed) continue;
      expect(json).not.toContain(fact.text);
    }
  });
});

function visibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&#x27;|&apos;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");
}

describe("about page HTML", () => {
  it("server-renders one h1 and every published FAQ answer", () => {
    const html = renderToStaticMarkup(createElement(AboutPage));
    const dom = visibleText(html);
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(dom).toContain(ABOUT_PAGE.h1);
    expect(dom).toContain(ABOUT_PAGE.updated);
    expect(html).toContain("FAQPage");
    expect(html).not.toContain('"@type":"Organization"');
    expect(html).not.toContain('"@type":"WebSite"');
    const details = [...html.matchAll(/<details([^>]*)>/g)];
    expect(details).toHaveLength(publishedAboutFaqs().length);
    expect(details[0]?.[1]).toContain("open");
    expect(details.slice(1).every((match) => !/\bopen\b/.test(match[1] ?? ""))).toBe(true);
    for (const faq of publishedAboutFaqs()) {
      expect(dom).toContain(faq.question);
      expect(dom).toContain(faq.answerText);
    }
    expect(dom).toContain(FEE_SENTENCE);
    expect(html).toContain(FEE_SENTENCE);
    for (const fact of ABOUT_UNCONFIRMED) {
      if (fact.confirmed) continue;
      expect(dom).not.toContain(fact.text);
      expect(html).not.toContain(fact.text);
    }
  });
});

describe("about metadata", () => {
  it("sets one canonical for /about", () => {
    expect(metadata.title).toEqual({
      absolute: "About Hashpop – A Hedera Marketplace for Real Stuff",
    });
    expect(metadata.description).toBe(ABOUT_PAGE.description);
    expect(metadata.openGraph?.description).toBe(ABOUT_PAGE.description);
    expect(metadata.twitter?.description).toBe(ABOUT_PAGE.description);
    expect(metadata.description).not.toMatch(/\bescrow\b/i);
    expect(metadata.alternates?.canonical).toBe("https://hashpop.io/about");
  });
});
