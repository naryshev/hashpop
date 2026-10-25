import { Suspense } from "react";
import type { Metadata } from "next";
<<<<<<< HEAD
import { loadInitialMarketplaceListings } from "../../lib/loadMarketplaceListings";
import { marketplaceMetadata } from "../../lib/seo/metadata";
import MarketplacePageClient from "./marketplace-page-client";

export function generateMetadata(): Metadata {
  return marketplaceMetadata();
=======
import { getApiUrl } from "../../lib/apiUrl";
import { isActiveListingStatus } from "../../lib/marketplaceCategory";
import { withEmptyCategoryRobots } from "../../lib/seo/categoryRobots";
import { marketplaceMetadata } from "../../lib/seo/metadata";
import { fetchPublicListings } from "../../lib/seo/publicListings";
import MarketplacePageClient, { type ListingItem } from "./marketplace-page-client";

export async function generateMetadata({
  searchParams,
}: {
  searchParams?: { category?: string | string[] };
}): Promise<Metadata> {
  const base = marketplaceMetadata();
  const raw = searchParams?.category;
  const category = Array.isArray(raw) ? raw[0] : raw;
  if (!category?.trim()) return base;
  const loaded = await fetchPublicListings();
  return withEmptyCategoryRobots(base, loaded, category);
}

async function loadInitialMarketplaceListings(): Promise<{
  items: ListingItem[];
  error: string | null;
}> {
  try {
    const [listingsRes, countsRes] = await Promise.all([
      // Bound the SSR fetch so a slow backend can't stall the whole page's
      // TTFB — on timeout the client refetches after hydration instead.
      fetch(`${getApiUrl()}/api/listings`, {
        cache: "no-store",
        signal: AbortSignal.timeout(3500),
      }),
      fetch(`${getApiUrl()}/api/wishlist/counts`, {
        cache: "no-store",
        signal: AbortSignal.timeout(3500),
      }),
    ]);
    if (!listingsRes.ok) {
      const body = await listingsRes.json().catch(() => ({}) as { error?: string });
      return {
        items: [],
        error:
          body?.error ||
          (listingsRes.status === 503
            ? "Backend or database unavailable."
            : "Failed to load listings."),
      };
    }
    const data = (await listingsRes.json()) as { listings?: ListingItem[] };
    const counts: Record<string, number> = countsRes.ok
      ? (((await countsRes.json()) as { counts?: Record<string, number> }).counts ?? {})
      : {};
    const list = (data.listings || []).map((l) => ({
      ...l,
      itemType: "listing" as const,
      watchlistCount: counts[l.id] ?? 0,
    }));
    const sorted = list.sort((a, b) => {
      const aActive = isActiveListingStatus(a.status);
      const bActive = isActiveListingStatus(b.status);
      if (aActive !== bActive) return aActive ? -1 : 1;
      return (
        new Date((b.createdAt as string) || 0).getTime() -
        new Date((a.createdAt as string) || 0).getTime()
      );
    });
    return { items: sorted, error: null };
  } catch (e) {
    return { items: [], error: e instanceof Error ? e.message : "Failed to load listings." };
  }
>>>>>>> 8e8c0ea (Index sitemap categories only when they have active listings.)
}

export default async function MarketplacePage() {
  const { items, error } = await loadInitialMarketplaceListings();
  return (
    <Suspense
      fallback={
        <main className="min-h-screen">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
            <p className="text-silver">Loading listings…</p>
          </div>
        </main>
      }
    >
      <MarketplacePageClient initialItems={items} initialError={error} />
    </Suspense>
  );
}
