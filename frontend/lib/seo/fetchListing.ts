import * as React from "react";
import { getApiUrl } from "../apiUrl";
import type { SeoListing } from "./metadata";

export type PublicListingFetch =
  | { status: "ok"; listing: SeoListing }
  | { status: "not_found" }
  | { status: "unavailable" };

/**
 * Public listing read used by generateMetadata, the listing page, and JSON-LD.
 * Same endpoint the listing client already calls: GET /api/listing/:id.
 *
 * 404 is a confirmed miss. Timeouts, network errors, and 5xx are unavailable
 * so the page can noindex and retry instead of becoming a hard 404.
 * Responses are not cached: a stored 404 would turn a listing that
 * sync-listing just wrote into a 404 for the person who created it.
 */
export async function loadPublicListing(id: string): Promise<PublicListingFetch> {
  let trimmed = id.trim();
  if (!trimmed) return { status: "not_found" };
  try {
    trimmed = decodeURIComponent(trimmed);
  } catch {
    // Keep the raw id when it is not valid percent-encoding.
  }
  if (!trimmed.trim()) return { status: "not_found" };
  try {
    const res = await fetch(`${getApiUrl()}/api/listing/${encodeURIComponent(trimmed)}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    if (res.status === 404) return { status: "not_found" };
    if (!res.ok) return { status: "unavailable" };
    const data = (await res.json()) as { listing?: SeoListing | null };
    if (!data.listing?.id) return { status: "unavailable" };
    return { status: "ok", listing: data.listing };
  } catch {
    return { status: "unavailable" };
  }
}

// React.cache dedupes the metadata pass and the page render. The public
// react package used by unit tests does not export cache; skip dedupe there.
const dedupe = (React as { cache?: <T extends typeof loadPublicListing>(fn: T) => T }).cache;

export const fetchPublicListing: typeof loadPublicListing = dedupe
  ? dedupe(loadPublicListing)
  : loadPublicListing;
