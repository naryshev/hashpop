import type { Metadata } from "next";
import { countActiveListingsInCategory } from "../marketplaceCategory";
import type { PublicListingsResult } from "./publicListings";

/**
 * Category views with zero active listings are not worth indexing.
 * Titles, descriptions, and canonicals stay on the metadata object passed in.
 * A failed feed is not treated as empty — we don't know the count yet.
 */
export function withEmptyCategoryRobots(
  metadata: Metadata,
  loaded: PublicListingsResult,
  categoryParam: string | string[] | null | undefined,
): Metadata {
  const category = Array.isArray(categoryParam) ? categoryParam[0] : categoryParam;
  if (!category?.trim()) return metadata;
  if (!loaded.ok) return metadata;
  if (countActiveListingsInCategory(loaded.listings, category) > 0) return metadata;
  return { ...metadata, robots: "noindex,follow" };
}
