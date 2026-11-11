import { canonicalizeCategory } from "./categories";

/**
 * Marketplace "active" means the public feed row is still LISTED.
 * Same check the marketplace page uses when it sorts active rows first.
 * Chain overrides can turn a confirmed row into LOCKED, SOLD, or CANCELLED;
 * those are not active.
 */
export function isActiveListingStatus(status?: string | null): boolean {
  return (
    String(status || "")
      .trim()
      .toUpperCase() === "LISTED"
  );
}

export type CategoryListing = {
  id?: string | null;
  status?: string | null;
  category?: string | null;
};

/**
 * Active rows whose category is this one, using the marketplace's strict
 * match: canonicalize both sides, then compare case-insensitively.
 * The count is whatever the caller passes in — nothing is hardcoded.
 */
export function countActiveListingsInCategory(
  listings: CategoryListing[],
  categoryParam: string | null | undefined,
): number {
  const wanted = canonicalizeCategory(categoryParam?.trim() ?? "").toLowerCase();
  if (!wanted) return 0;
  let count = 0;
  for (const listing of listings) {
    if (!listing.id?.trim()) continue;
    if (!isActiveListingStatus(listing.status)) continue;
    if (canonicalizeCategory(listing.category).toLowerCase() !== wanted) continue;
    count += 1;
  }
  return count;
}
