import type { MetadataRoute } from "next";
import { buildRequestSitemap } from "../lib/seo/publicListings";

export const dynamic = "force-dynamic";

/**
 * Category and listing URLs are computed on each request from GET /api/listings,
 * the same feed marketplace SSR uses. That endpoint returns the latest
 * on-chain-confirmed rows (backend take: 100). To cover a larger catalog,
 * raise that cap or add a paginated public listing feed and map it in
 * `buildSitemap`. Do not call admin routes from here.
 *
 * Dynamic on purpose: a build machine often cannot reach the API. When the
 * feed is unreachable, `buildRequestSitemap` returns the static URLs only.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return buildRequestSitemap();
}
