import { getApiUrl } from "../lib/apiUrl";
import HomePageClient, { type ListingRecord } from "./home-page-client";

function normalizeListingStatus(status?: string): string {
  return String(status || "")
    .trim()
    .toUpperCase();
}

function isActiveStatus(status?: string): boolean {
  return normalizeListingStatus(status) === "LISTED";
}

async function loadInitialListings(): Promise<{ listings: ListingRecord[]; error: string | null }> {
  try {
    const res = await fetch(`${getApiUrl()}/api/listings`, { cache: "no-store" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}) as { error?: string });
      return {
        listings: [],
        error:
          body?.error ||
          (res.status === 503 ? "Backend or database unavailable." : "Failed to load listings."),
      };
    }
    const data = (await res.json()) as { listings?: ListingRecord[] };
    const list = (data.listings || []).map((l) => ({ ...l, itemType: "listing" as const }));
    const sorted = list
      .sort((a, b) => {
        const aActive = isActiveStatus(a.status);
        const bActive = isActiveStatus(b.status);
        if (aActive !== bActive) return aActive ? -1 : 1;
        return (
          new Date((b.createdAt as string) || 0).getTime() -
          new Date((a.createdAt as string) || 0).getTime()
        );
      })
      .slice(0, 8);
    return { listings: sorted, error: null };
  } catch (e) {
    return { listings: [], error: e instanceof Error ? e.message : "Failed to load listings." };
  }
}

export default async function Home() {
  const { listings, error } = await loadInitialListings();
  return <HomePageClient initialListings={listings} initialError={error} />;
}
