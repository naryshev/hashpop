import type { MetadataRoute } from "next";
import { getApiUrl } from "../lib/apiUrl";
import { buildSitemap, type SitemapListing } from "../lib/seo/sitemap";

export const dynamic = "force-dynamic";

/**
 * Public listings come from GET /api/listings — the same feed marketplace SSR
 * uses. That endpoint returns the latest on-chain-confirmed LISTED rows
 * (backend take: 100). To cover a larger catalog, raise that cap or add a
 * paginated public listing feed and map it in `buildSitemap`. Do not call
 * admin routes from here.
 *
 * Dynamic on purpose: a build machine often cannot reach the API, and a
 * frozen empty sitemap would ship without listing URLs.
 */
async function fetchPublicListings(): Promise<SitemapListing[]> {
  try {
    const res = await fetch(`${getApiUrl()}/api/listings`, {
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { listings?: SitemapListing[] };
    return data.listings ?? [];
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const listings = await fetchPublicListings();
  return buildSitemap(listings);
}
