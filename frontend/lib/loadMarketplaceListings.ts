import { getApiUrl } from "./apiUrl";

export type ListingItem = {
  id: string;
  price?: string;
  title?: string | null;
  subtitle?: string | null;
  description?: string | null;
  category?: string | null;
  condition?: string | null;
  watchlistCount?: number;
  seller?: string;
  imageUrl?: string | null;
  mediaUrls?: string[];
  city?: string | null;
  createdAt?: string;
  status?: string;
  onChainConfirmed?: boolean;
  requireEscrow?: boolean | null;
  itemType: "listing";
};

function normalizeListingStatus(status?: string): string {
  return String(status || "")
    .trim()
    .toUpperCase();
}

function isActiveStatus(status?: string): boolean {
  return normalizeListingStatus(status) === "LISTED";
}

/** Shown in the grid. Never include status codes, stacks, or infra hints. */
export const LISTINGS_UNAVAILABLE_COPY = "Listings are taking a moment to load. Try again.";

function logListingsFailure(detail: unknown) {
  console.error("[marketplace] failed to load listings", detail);
}

/** Next throws this while prerendering a no-store fetch. It must propagate. */
function isDynamicServerUsage(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    (error as { digest?: unknown }).digest === "DYNAMIC_SERVER_USAGE"
  );
}

export async function loadInitialMarketplaceListings(): Promise<{
  items: ListingItem[];
  error: boolean;
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
      logListingsFailure({ status: listingsRes.status, body });
      return { items: [], error: true };
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
      const aActive = isActiveStatus(a.status);
      const bActive = isActiveStatus(b.status);
      if (aActive !== bActive) return aActive ? -1 : 1;
      return (
        new Date((b.createdAt as string) || 0).getTime() -
        new Date((a.createdAt as string) || 0).getTime()
      );
    });
    return { items: sorted, error: false };
  } catch (e) {
    if (isDynamicServerUsage(e)) throw e;
    logListingsFailure(e);
    return { items: [], error: true };
  }
}
