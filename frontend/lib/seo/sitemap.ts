import { CATEGORY_GROUPS } from "../categories";
import { absoluteUrl } from "./host";
import { listingCanonicalPath } from "./metadata";

/**
 * Indexable routes that are not account-specific.
 * `/` redirects to `/marketplace`, so the marketplace URL is the canonical entry.
 */
export const PUBLIC_SITEMAP_PATHS = [
  "/marketplace",
  "/categories",
  "/privacy",
  "/terms",
  "/help",
  "/support",
] as const;

/** Second guard on top of GET /api/listings (backend take: 100). */
export const SITEMAP_LISTING_CAP = 500;

/** Public category URLs are marketplace filters, matching the categories page. */
export function categorySitemapPaths(): string[] {
  const paths: string[] = [];
  for (const group of CATEGORY_GROUPS) {
    for (const category of group.categories) {
      paths.push(`/marketplace?category=${encodeURIComponent(category)}`);
    }
  }
  return paths;
}

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

export function buildSitemap(
  listings: SitemapListing[],
  options?: { categoryPaths?: string[]; listingCap?: number },
): SitemapEntry[] {
  const categoryPaths = options?.categoryPaths ?? categorySitemapPaths();
  const listingCap = options?.listingCap ?? SITEMAP_LISTING_CAP;
  const staticEntries: SitemapEntry[] = [
    ...PUBLIC_SITEMAP_PATHS.map((path) => ({
      url: absoluteUrl(path),
      changeFrequency: path === "/marketplace" ? ("daily" as const) : ("weekly" as const),
      priority: path === "/marketplace" ? 1 : 0.6,
    })),
    ...categoryPaths.map((path) => ({
      url: absoluteUrl(path),
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
  ];

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
    if (listingEntries.length >= listingCap) break;
  }

  return [...staticEntries, ...listingEntries];
}
