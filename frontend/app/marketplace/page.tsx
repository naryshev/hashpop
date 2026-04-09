import { Suspense } from "react";
import { getApiUrl } from "../../lib/apiUrl";
import MarketplacePageClient, { type ListingItem } from "./marketplace-page-client";

function normalizeListingStatus(status?: string): string {
  return String(status || "")
    .trim()
    .toUpperCase();
}

function isActiveStatus(status?: string): boolean {
  return normalizeListingStatus(status) === "LISTED";
}

async function loadInitialMarketplaceListings(): Promise<{
  items: ListingItem[];
  error: string | null;
}> {
  try {
    const [listingsRes, countsRes] = await Promise.all([
      fetch(`${getApiUrl()}/api/listings`, { cache: "no-store" }),
      fetch(`${getApiUrl()}/api/wishlist/counts`, { cache: "no-store" }),
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
      ? ((await countsRes.json()) as { counts?: Record<string, number> }).counts ?? {}
      : {};
    const list = (data.listings || []).map((l) => ({
      ...l,
      itemType: "listing" as const,
      watchlistCount: counts[l.id] ?? 0,
    }));
    const sorted = list.sort((a, b) => {
      const aActive = isActiveStatus(a.status);
      const bActive = isActiveStatus(b.status);
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
