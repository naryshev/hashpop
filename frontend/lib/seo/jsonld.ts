import { hbarAmountPlain } from "../formatPrice";
import { usdPriceFromHbar } from "../hbarUsd";
import { getListingMediaUrls } from "../listingMedia";
import { SEO_COPY } from "./copy";
import { absoluteUrl, CANONICAL_ORIGIN } from "./host";
import { listingCanonicalPath, type SeoListing } from "./metadata";

/** Google merchant listings require an ISO 4217 currency. HBAR is not one. */
export const OFFER_PRICE_CURRENCY = "USD" as const;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Marketplace search reads `?q=`. SearchAction uses that same parameter.
 * WebSite.url is the site origin; the search target stays on /marketplace.
 */
export const WEBSITE_URL = absoluteUrl("/");
export const SEARCH_URL_TEMPLATE = `${absoluteUrl("/marketplace")}?q={search_term_string}`;
export const ORGANIZATION_LOGO_URL = absoluteUrl("/hashpop-cart-3d.PNG");

const ITEM_CONDITION: Record<string, string> = {
  new: "https://schema.org/NewCondition",
  "brand new": "https://schema.org/NewCondition",
  "like new": "https://schema.org/UsedCondition",
  used: "https://schema.org/UsedCondition",
  worn: "https://schema.org/UsedCondition",
  excellent: "https://schema.org/UsedCondition",
  refurbished: "https://schema.org/RefurbishedCondition",
  "for parts": "https://schema.org/DamagedCondition",
  "for parts or repair": "https://schema.org/DamagedCondition",
};

export type ListingOfferJsonLd = {
  "@type": "Offer";
  price: string;
  priceCurrency: typeof OFFER_PRICE_CURRENCY;
  availability: string;
  url: string;
  priceValidUntil: string;
  itemCondition?: string;
  additionalProperty: {
    "@type": "PropertyValue";
    name: "Price (HBAR)";
    value: string;
  };
};

export type ListingJsonLd = {
  "@context": "https://schema.org";
  "@type": "Product";
  name: string;
  description: string;
  url: string;
  sku: string;
  image?: string[];
  category?: string;
  itemCondition?: string;
  offers?: ListingOfferJsonLd;
};

export type ListingJsonLdOptions = {
  /** Same HBAR/USD snapshot rendered next to the listing price. Omit offers when null. */
  usdPerHbar?: number | null;
  /** Clock for priceValidUntil. Defaults to the render time. */
  now?: Date;
};

export type FaqGroup = {
  category: string;
  items: { q: string; a: string }[];
};

/** InStock only for listings a buyer can purchase. Everything else is sold out or discontinued. */
export function schemaAvailability(status?: string | null): string {
  switch ((status ?? "").trim().toUpperCase()) {
    case "LISTED":
    case "ACTIVE":
      return "https://schema.org/InStock";
    case "CANCELLED":
    case "CANCELED":
    case "HIDDEN":
    case "REMOVED":
    case "DELETED":
      return "https://schema.org/Discontinued";
    default:
      return "https://schema.org/SoldOut";
  }
}

/** Map the listing condition field onto schema.org. Unknown values are omitted. */
export function schemaItemCondition(condition?: string | null): string | undefined {
  const key = (condition ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!key) return undefined;
  return ITEM_CONDITION[key];
}

/** Date-only (YYYY-MM-DD), one day after `now`. Google's priceValidUntil examples use this form. */
export function offerPriceValidUntil(now = new Date()): string {
  return new Date(now.getTime() + DAY_MS).toISOString().slice(0, 10);
}

export function listingImageUrls(listing: {
  imageUrl?: string | null;
  mediaUrls?: string[] | null;
}): string[] {
  return getListingMediaUrls(listing).filter((url) => /^https?:\/\//i.test(url));
}

/**
 * One Product for a listing URL. The Offer, when present, is a single USD price.
 * HBAR is recorded on additionalProperty and in the description, never as priceCurrency.
 * No offers property at all when the USD rate is missing.
 */
export function listingJsonLd(
  id: string,
  listing: SeoListing,
  options: ListingJsonLdOptions = {},
): ListingJsonLd {
  const path = listingCanonicalPath(id);
  const url = absoluteUrl(path);
  const images = listingImageUrls(listing);
  const name = listing.title?.trim() || "Listing";
  const hbarPlain = hbarAmountPlain(listing.price);
  const base = (listing.description || listing.subtitle || name).replace(/\s+/g, " ").trim();
  const description = `${base} Price (HBAR): ${hbarPlain}.`;
  const itemCondition = schemaItemCondition(listing.condition);
  const usd = usdPriceFromHbar(listing.price, options.usdPerHbar ?? null);
  const data: ListingJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    description,
    url,
    sku: listing.id || id,
  };
  if (images.length > 0) data.image = images;
  if (listing.category?.trim()) data.category = listing.category.trim();
  if (itemCondition) data.itemCondition = itemCondition;
  if (usd != null) {
    const offer: ListingOfferJsonLd = {
      "@type": "Offer",
      price: usd,
      priceCurrency: OFFER_PRICE_CURRENCY,
      availability: schemaAvailability(listing.status),
      url,
      priceValidUntil: offerPriceValidUntil(options.now),
      additionalProperty: {
        "@type": "PropertyValue",
        name: "Price (HBAR)",
        value: hbarPlain,
      },
    };
    if (itemCondition) offer.itemCondition = itemCondition;
    data.offers = offer;
  }
  return data;
}

/** Organization + WebSite graph already rendered by the root layout. */
export function siteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: SEO_COPY.siteName,
        url: CANONICAL_ORIGIN,
        logo: ORGANIZATION_LOGO_URL,
        description: SEO_COPY.rootDescription,
      },
      {
        "@type": "WebSite",
        name: SEO_COPY.siteName,
        url: WEBSITE_URL,
        description: SEO_COPY.marketplaceDescription,
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: SEARCH_URL_TEMPLATE,
          },
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };
}

/** FAQPage whose questions and answers are the help center strings, in page order. */
export function faqPageJsonLd(groups: FaqGroup[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: groups.flatMap((group) =>
      group.items.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.a,
        },
      })),
    ),
  };
}

/** JSON-LD safe to drop into a script tag (escapes `<` so descriptions cannot close it). */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
