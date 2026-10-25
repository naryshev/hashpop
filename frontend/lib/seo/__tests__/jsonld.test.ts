import { describe, expect, it } from "vitest";
import { listingOfferPriceLabel } from "../../hbarUsd";
import { FAQS } from "../../help/faqs";
import {
  faqPageJsonLd,
  listingJsonLd,
  schemaItemCondition,
  serializeJsonLd,
  siteJsonLd,
} from "../jsonld";

function nodesOfType(value: unknown, type: string): Record<string, unknown>[] {
  const found: Record<string, unknown>[] = [];
  const visit = (node: unknown) => {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (!node || typeof node !== "object") return;
    const record = node as Record<string, unknown>;
    if (record["@type"] === type) found.push(record);
    Object.values(record).forEach(visit);
  };
  visit(value);
  return found;
}

describe("JSON-LD builders", () => {
  const now = new Date("2026-10-25T12:00:00.000Z");

  it("emits exactly one USD Offer and no HBAR currency", () => {
    const data = listingJsonLd(
      "lst-1",
      {
        id: "lst-1",
        title: "Desk lamp",
        description: "Brass arm",
        price: "5",
        status: "LISTED",
        condition: "New",
      },
      { usdPerHbar: 0.2, now },
    );
    const offers = nodesOfType(data, "Offer");
    expect(offers).toHaveLength(1);
    expect(offers[0]).toMatchObject({
      price: "1.00",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      itemCondition: "https://schema.org/NewCondition",
      url: "https://hashpop.io/listing/lst-1",
      priceValidUntil: "2026-10-26",
    });
    expect(offers[0]?.additionalProperty).toEqual({
      "@type": "PropertyValue",
      name: "Price (HBAR)",
      value: "5",
    });
    expect(offers[0]).not.toHaveProperty("priceSpecification");
    expect(data.description).toBe("Brass arm Price (HBAR): 5.");
    expect(listingOfferPriceLabel("5", 0.2)).toBe("5 ℏ (≈ $1.00 USD)");
    const serialized = serializeJsonLd(data);
    expect(serialized).not.toMatch(/priceCurrency":"HBAR"/);
    expect(serialized).not.toContain("priceSpecification");
    expect(nodesOfType(JSON.parse(serialized), "Product")).toHaveLength(1);
  });

  it("drops the Offer instead of emitting an unpriced or non-ISO one", () => {
    const data = listingJsonLd("lst-1", {
      id: "lst-1",
      title: "Desk lamp",
      price: "5",
      status: "LISTED",
    });
    expect(nodesOfType(data, "Offer")).toHaveLength(0);
    expect(data).not.toHaveProperty("offers");
    expect(data.description).toContain("Price (HBAR): 5.");
    expect(serializeJsonLd(data)).not.toContain("priceCurrency");
    expect(serializeJsonLd(data)).not.toContain("priceSpecification");
  });

  it("maps the real condition labels and skips values the form does not use", () => {
    expect(schemaItemCondition("New")).toBe("https://schema.org/NewCondition");
    expect(schemaItemCondition("Like new")).toBe("https://schema.org/UsedCondition");
    expect(schemaItemCondition("Used")).toBe("https://schema.org/UsedCondition");
    expect(schemaItemCondition("Worn")).toBe("https://schema.org/UsedCondition");
    expect(schemaItemCondition("For parts")).toBe("https://schema.org/DamagedCondition");
    expect(schemaItemCondition("Refurbished")).toBe("https://schema.org/RefurbishedCondition");
    expect(schemaItemCondition("For parts or repair")).toBe("https://schema.org/DamagedCondition");
    expect(schemaItemCondition("mystery")).toBeUndefined();
    expect(schemaItemCondition("  ")).toBeUndefined();
  });

  it("does not put a Product on the site graph", () => {
    const data = siteJsonLd();
    expect(nodesOfType(data, "Product")).toHaveLength(0);
    expect(nodesOfType(data, "Offer")).toHaveLength(0);
    expect(nodesOfType(data, "Organization")).toHaveLength(1);
    expect(nodesOfType(data, "WebSite")).toHaveLength(1);
  });

  it("copies help answers into FAQPage without rewriting them", () => {
    const data = faqPageJsonLd(FAQS);
    const visible = FAQS.flatMap((group) => group.items);
    expect(data.mainEntity.map((item) => item.name)).toEqual(visible.map((item) => item.q));
    expect(data.mainEntity.map((item) => item.acceptedAnswer.text)).toEqual(
      visible.map((item) => item.a),
    );
    expect(
      serializeJsonLd(faqPageJsonLd([{ category: "x", items: [{ q: "Q", a: "</script>" }] }])),
    ).not.toContain("</script>");
  });
});
