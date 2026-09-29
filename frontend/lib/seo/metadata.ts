import type { Metadata } from "next";
import { formatPriceForDisplay } from "../formatPrice";
import { getListingMediaUrls } from "../listingMedia";
import { listingHref } from "../listingUrl";
import { META_DESCRIPTION_MAX, SEO_COPY } from "./copy";
import { absoluteUrl } from "./host";

function primaryListingImage(listing: {
  imageUrl?: string | null;
  mediaUrls?: string[] | null;
}): string | undefined {
  return getListingMediaUrls(listing).find((url) => /^https?:\/\//i.test(url));
}

/**
 * Brand cards already live on the apex. Listing photos replace these.
 * Do not point this at a new share-card file.
 */
export const FALLBACK_OG_IMAGE = {
  url: "https://hashpop.io/opengraph-image",
  width: 1200,
  height: 630,
  alt: "Hashpop - Community marketplace on Hedera",
} as const;

export const FALLBACK_TWITTER_IMAGE = "https://hashpop.io/twitter-image";

/**
 * Listing media replaces the site card. Pages that set their own openGraph
 * must pass images explicitly — a child openGraph object replaces the parent.
 */
export function socialImages(primary?: string): {
  openGraph: NonNullable<Metadata["openGraph"]>["images"];
  twitter: string[];
} {
  if (primary) {
    return { openGraph: [{ url: primary }], twitter: [primary] };
  }
  return { openGraph: [{ ...FALLBACK_OG_IMAGE }], twitter: [FALLBACK_TWITTER_IMAGE] };
}

export type SeoListing = {
  id: string;
  title?: string | null;
  subtitle?: string | null;
  description?: string | null;
  price?: string | null;
  status?: string | null;
  requireEscrow?: boolean | null;
  condition?: string | null;
  city?: string | null;
  category?: string | null;
  imageUrl?: string | null;
  mediaUrls?: string[] | null;
  seller?: string | null;
};

export function listingCanonicalPath(id: string): string {
  let decoded = id;
  try {
    decoded = decodeURIComponent(id);
  } catch {
    decoded = id;
  }
  return listingHref(decoded);
}

export function truncateMeta(text: string, max = META_DESCRIPTION_MAX): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}

export function listingPriceLabel(price: string | null | undefined): string {
  return formatPriceForDisplay(price);
}

/** First ~155 characters of the listing description, or the research fallback sentence. */
export function listingMetaDescription(listing: SeoListing | null): string {
  const title = listing?.title?.trim() || "Listing";
  const price = listingPriceLabel(listing?.price);
  const fallback = SEO_COPY.listingDescriptionFallback(title, price);
  const body = (listing?.description || listing?.subtitle || "").replace(/\s+/g, " ").trim();
  if (!body) return fallback;
  return truncateMeta(body, META_DESCRIPTION_MAX);
}

export function marketplaceMetadata(): Metadata {
  const url = absoluteUrl("/marketplace");
  const images = socialImages();
  return {
    title: { absolute: SEO_COPY.marketplaceTitle },
    description: SEO_COPY.marketplaceDescription,
    alternates: { canonical: url },
    openGraph: {
      title: SEO_COPY.marketplaceTitle,
      description: SEO_COPY.marketplaceOgDescription,
      url,
      type: "website",
      siteName: SEO_COPY.siteName,
      images: images.openGraph,
    },
    twitter: {
      card: "summary_large_image",
      title: SEO_COPY.marketplaceTitle,
      description: SEO_COPY.marketplaceOgDescription,
      images: images.twitter,
    },
  };
}

export function listingMetadata(id: string, listing: SeoListing | null): Metadata {
  const url = absoluteUrl(listingCanonicalPath(id));
  const title = listing?.title?.trim()
    ? SEO_COPY.listingTitle(listing.title.trim(), listingPriceLabel(listing.price))
    : SEO_COPY.listingFallbackTitle;
  const description = listingMetaDescription(listing);
  const images = socialImages(listing ? primaryListingImage(listing) : undefined);
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: "website",
      siteName: SEO_COPY.siteName,
      images: images.openGraph,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: images.twitter,
    },
  };
}

export function staticPageMetadata(input: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  const url = absoluteUrl(input.path);
  const images = socialImages();
  return {
    title: { absolute: input.title },
    description: input.description,
    alternates: { canonical: url },
    openGraph: {
      title: input.title,
      description: input.description,
      url,
      type: "website",
      siteName: SEO_COPY.siteName,
      images: images.openGraph,
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description: input.description,
      images: images.twitter,
    },
  };
}
