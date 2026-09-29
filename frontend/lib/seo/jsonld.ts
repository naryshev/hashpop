import { formatPriceForDisplay } from "../formatPrice";
import { getListingMediaUrls } from "../listingMedia";
import { OFFER_PRICE_CURRENCY, SEO_COPY } from "./copy";
import { absoluteUrl, CANONICAL_ORIGIN } from "./host";
import { listingCanonicalPath, type SeoListing } from "./metadata";

export type ListingOfferJsonLd = {
  "@type": "Offer";
  price: string;
  priceCurrency: typeof OFFER_PRICE_CURRENCY;
  availability?: string;
  url: string;
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
  offers: ListingOfferJsonLd;
};

export function schemaAvailability(status?: string | null): string | undefined {
  switch ((status ?? "").trim().toUpperCase()) {
    case "LISTED":
      return "https://schema.org/InStock";
    case "LOCKED":
      return "https://schema.org/LimitedAvailability";
    case "SOLD":
      return "https://schema.org/SoldOut";
    case "CANCELLED":
    case "CANCELED":
      return "https://schema.org/Discontinued";
    default:
      return undefined;
  }
}

export function listingImageUrls(listing: {
  imageUrl?: string | null;
  mediaUrls?: string[] | null;
}): string[] {
  return getListingMediaUrls(listing).filter((url) => /^https?:\/\//i.test(url));
}

export function listingJsonLd(id: string, listing: SeoListing): ListingJsonLd {
  const path = listingCanonicalPath(id);
  const url = absoluteUrl(path);
  const images = listingImageUrls(listing);
  const availability = schemaAvailability(listing.status);
  const name = listing.title?.trim() || "Listing";
  const description = (listing.description || listing.subtitle || name).replace(/\s+/g, " ").trim();
  const offer: ListingOfferJsonLd = {
    "@type": "Offer",
    price: formatPriceForDisplay(listing.price),
    priceCurrency: OFFER_PRICE_CURRENCY,
    url,
  };
  if (availability) offer.availability = availability;
  const data: ListingJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    description,
    url,
    sku: listing.id || id,
    offers: offer,
  };
  if (images.length > 0) data.image = images;
  if (listing.category?.trim()) data.category = listing.category.trim();
  return data;
}

/** Organization + WebSite graph for the marketplace shell. */
export function siteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: SEO_COPY.siteName,
        url: CANONICAL_ORIGIN,
        description: SEO_COPY.rootDescription,
      },
      {
        "@type": "WebSite",
        name: SEO_COPY.siteName,
        url: absoluteUrl("/marketplace"),
        description: SEO_COPY.marketplaceDescription,
      },
    ],
  };
}

/** JSON-LD safe to drop into a script tag (escapes `<` so descriptions cannot close it). */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
