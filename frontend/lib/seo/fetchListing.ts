import { cache } from "react";
import { getApiUrl } from "../apiUrl";
import type { SeoListing } from "./metadata";

/**
 * Public listing read used by generateMetadata, the listing page, and JSON-LD.
 * Same endpoint the listing client already calls: GET /api/listing/:id.
 * React cache() dedupes the metadata pass and the page render.
 */
export const fetchPublicListing = cache(async (id: string): Promise<SeoListing | null> => {
  let trimmed = id.trim();
  if (!trimmed) return null;
  try {
    trimmed = decodeURIComponent(trimmed);
  } catch {
    // Keep the raw id when it is not valid percent-encoding.
  }
  try {
    const res = await fetch(`${getApiUrl()}/api/listing/${encodeURIComponent(trimmed)}`, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { listing?: SeoListing | null };
    if (!data.listing?.id) return null;
    return data.listing;
  } catch {
    return null;
  }
});
