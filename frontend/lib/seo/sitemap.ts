import { CATEGORY_GROUPS } from "../categories";
import { countActiveListingsInCategory, isActiveListingStatus } from "../marketplaceCategory";
import { absoluteUrl } from "./host";
import { listingCanonicalPath } from "./metadata";

/**
 * Indexable routes that are not account-specific.
 * `/` is the homepage. `/about` is the about page. `/marketplace` stays beside them.
 */
export const PUBLIC_SITEMAP_PATHS = [
  "/",
  "/marketplace",
  "/categories",
  "/privacy",
  "/terms",
  "/help",
  "/about",
  "/support",
] as const;

/** Second guard on top of GET /api/listings (backend take: 100). */
export const SITEMAP_LISTING_CAP = 500;

/**
 * `/marketplace?category=` URLs for catalog categories whose active listing
 * count is greater than zero. The count comes from `listings` (the public
 * feed at request time), not a fixed set of categories.
 */
export function categorySitemapPaths(listings: SitemapListing[] = []): string[] {
  const paths: string[] = [];
  for (const group of CATEGORY_GROUPS) {
    for (const category of group.categories) {
      if (countActiveListingsInCategory(listings, category) === 0) continue;
      paths.push(`/marketplace?category=${encodeURIComponent(category)}`);
    }
  }
  return paths;
}

export type SitemapListing = {
  id: string;
  status?: string | null;
  category?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
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

/**
 * The indexer re-upserts ItemListed on each poll, and Prisma `@updatedAt`
 * moves to the current time even when the row did not change. A timestamp
 * this close to sitemap generation is that touch, not a modification.
 */
const UPDATED_AT_TOUCH_MS = 60_000;

/**
 * Real updatedAt from the feed. createdAt when updatedAt is missing or is
 * only the current time. Omit lastmod when neither field is a timestamp.
 * Never synthesize "now".
 */
function listingLastModified(listing: SitemapListing, now: number): string | undefined {
  const updated = lastModified(listing.updatedAt);
  const created = lastModified(listing.createdAt);
  if (updated && Math.abs(Date.parse(updated) - now) >= UPDATED_AT_TOUCH_MS) return updated;
  return created;
}

function staticChangeFrequency(path: string): "daily" | "weekly" {
  return path === "/" || path === "/marketplace" ? "daily" : "weekly";
}

function staticPriority(path: string): number {
  if (path === "/") return 1;
  if (path === "/marketplace") return 0.9;
  return 0.6;
}

export function buildSitemap(
  listings: SitemapListing[],
  options?: { categoryPaths?: string[]; listingCap?: number; now?: number },
): SitemapEntry[] {
  const now = options?.now ?? Date.now();
  const categoryPaths = options?.categoryPaths ?? categorySitemapPaths(listings);
  const listingCap = options?.listingCap ?? SITEMAP_LISTING_CAP;
  const staticEntries: SitemapEntry[] = [
    ...PUBLIC_SITEMAP_PATHS.map((path) => ({
      url: absoluteUrl(path),
      changeFrequency: staticChangeFrequency(path),
      priority: staticPriority(path),
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
    if (!isActiveListingStatus(listing.status)) continue;
    const modified = listingLastModified(listing, now);
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
