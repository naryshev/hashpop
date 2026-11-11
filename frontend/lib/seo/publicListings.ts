import { getApiUrl } from "../apiUrl";
import { buildSitemap, type SitemapEntry, type SitemapListing } from "./sitemap";

export type PublicListingsResult =
  | { ok: true; listings: SitemapListing[] }
  | { ok: false; listings: [] };

/**
 * GET /api/listings — the same public feed the marketplace SSR uses.
 * A down or unreadable backend is an empty result, not a thrown error.
 */
export async function fetchPublicListings(
  fetchImpl: typeof fetch = fetch,
): Promise<PublicListingsResult> {
  try {
    const res = await fetchImpl(`${getApiUrl()}/api/listings`, {
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return { ok: false, listings: [] };
    const data = (await res.json()) as { listings?: SitemapListing[] };
    return { ok: true, listings: Array.isArray(data.listings) ? data.listings : [] };
  } catch {
    return { ok: false, listings: [] };
  }
}

/** Sitemap for this request. A thrown loader still yields the static URLs. */
export async function buildRequestSitemap(
  load: () => Promise<PublicListingsResult> = fetchPublicListings,
): Promise<SitemapEntry[]> {
  try {
    const loaded = await load();
    return buildSitemap(loaded.listings);
  } catch {
    return buildSitemap([]);
  }
}
