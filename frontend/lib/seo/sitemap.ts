import { listingCanonicalPath } from "./metadata";
import { absoluteUrl } from "./host";

/**
 * Indexable routes that are not account-specific.
 * `/` redirects to `/marketplace`, so the marketplace URL is the canonical entry.
 */
export const PUBLIC_SITEMAP_PATHS = [
  "/marketplace",
  "/categories",
  "/help",
  "/support",
  "/privacy",
  "/terms",
] as const;

export type SitemapListing = {
  id: string;
  status?: string | null;
  createdAt?: string | null;
};

export type SitemapEntry = {
  url: string;
  lastModified?: string;
  changeFrequency: "daily" | "weekly" | "monthly";
  priority: number;
};

function lastModified(value?: string | null): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

export function buildSitemap(listings: SitemapListing[]): SitemapEntry[] {
  const staticEntries: SitemapEntry[] = PUBLIC_SITEMAP_PATHS.map((path) => ({
    url: absoluteUrl(path),
    changeFrequency: path === "/marketplace" ? "daily" : "weekly",
    priority: path === "/marketplace" ? 1 : 0.6,
  }));

  const listingEntries: SitemapEntry[] = [];
  for (const listing of listings) {
    const id = listing.id?.trim();
    if (!id) continue;
    if ((listing.status ?? "").trim().toUpperCase() !== "LISTED") continue;
    const modified = lastModified(listing.createdAt);
    listingEntries.push({
      url: absoluteUrl(listingCanonicalPath(id)),
      ...(modified ? { lastModified: modified } : {}),
      changeFrequency: "daily",
      priority: 0.8,
    });
  }

  return [...staticEntries, ...listingEntries];
}
