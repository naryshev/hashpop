import type { Metadata } from "next";
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

/** Trust cue appended to listing snippets. Wording lives next to SEO_COPY. */
export function listingTrustCue(listing: {
  requireEscrow?: boolean | null;
  condition?: string | null;
  city?: string | null;
}): string {
  const parts: string[] = [];
  if (listing.requireEscrow === true) parts.push("Escrow on Hedera");
  else if (listing.requireEscrow === false) parts.push("Meetup");
  if (listing.condition?.trim()) parts.push(listing.condition.trim());
  if (listing.city?.trim()) parts.push(listing.city.trim());
  return parts.join(" · ");
}

export function listingMetaDescription(listing: SeoListing | null): string {
  if (!listing) return SEO_COPY.listingFallbackDescription;
  const body = (listing.description || listing.subtitle || "").replace(/\s+/g, " ").trim();
  const cue = listingTrustCue(listing);
  if (!body && !cue) return SEO_COPY.listingFallbackDescription;
  if (!cue) return truncateMeta(body);
  const suffix = ` ${cue}`;
  const budget = Math.max(40, META_DESCRIPTION_MAX - suffix.length);
  const head = body ? truncateMeta(body, budget) : "";
  return truncateMeta(`${head}${suffix}`.trim());
}

export function marketplaceMetadata(): Metadata {
  const url = absoluteUrl("/marketplace");
  return {
    title: { absolute: SEO_COPY.marketplaceTitle },
    description: SEO_COPY.marketplaceDescription,
    alternates: { canonical: url },
    openGraph: {
      title: SEO_COPY.marketplaceTitle,
      description: SEO_COPY.marketplaceDescription,
      url,
      type: "website",
      siteName: SEO_COPY.siteName,
    },
    twitter: {
      card: "summary_large_image",
      title: SEO_COPY.marketplaceTitle,
      description: SEO_COPY.marketplaceDescription,
    },
  };
}

export function listingMetadata(id: string, listing: SeoListing | null): Metadata {
  const url = absoluteUrl(listingCanonicalPath(id));
  const title = listing?.title?.trim()
    ? SEO_COPY.listingTitle(listing.title.trim())
    : SEO_COPY.listingFallbackTitle;
  const description = listingMetaDescription(listing);
  const image = listing ? primaryListingImage(listing) : undefined;
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
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

export function staticPageMetadata(input: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  const url = absoluteUrl(input.path);
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
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description: input.description,
    },
  };
}
