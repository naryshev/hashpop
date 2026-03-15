import { Suspense } from "react";
import { getApiUrl } from "../../lib/apiUrl";
import { isActiveStatus } from "../../lib/listingFormat";
import MarketplacePageClient, { type ListingItem } from "./marketplace-page-client";

async function loadInitialMarketplaceListings(): Promise<{ items: ListingItem[]; error: string | null }> {
  try {
    const res = await fetch(`${getApiUrl()}/api/listings`, { cache: "no-store" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({} as { error?: string }));
      return {
        items: [],
        error: body?.error || (res.status === 503 ? "Backend or database unavailable." : "Failed to load listings."),
      };
    }
    const data = (await res.json()) as { listings?: ListingItem[] };
    const list = (data.listings || []).map((l) => ({ ...l, itemType: "listing" as const }));
    const sorted = list.sort((a, b) => {
      const aActive = isActiveStatus(a.status);
      const bActive = isActiveStatus(b.status);
      if (aActive !== bActive) return aActive ? -1 : 1;
      return new Date((b.createdAt as string) || 0).getTime() - new Date((a.createdAt as string) || 0).getTime();
    });
    return { items: sorted, error: null };
  } catch (e) {
    return { items: [], error: e instanceof Error ? e.message : "Failed to load listings." };
  }
}

export default async function MarketplacePage() {
  const { items, error } = await loadInitialMarketplaceListings();
  return (
    <Suspense fallback={<main className="min-h-screen"><div className="max-w-6xl mx-auto px-4 sm:px-6 py-6"><p className="text-silver">Loading listings…</p></div></main>}>
      <MarketplacePageClient initialItems={items} initialError={error} />
    </Suspense>
  );
}
