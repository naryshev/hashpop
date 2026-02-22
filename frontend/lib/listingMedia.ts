import { resolveListingImageUrl } from "./listingImageUrl";

/**
 * Normalize listing media to an array of image URLs (for display).
 * Supports legacy imageUrl and new mediaUrls.
 */
export function getListingMediaUrls(listing: {
  imageUrl?: string | null;
  mediaUrls?: string[] | null;
}): string[] {
  const urls = listing.mediaUrls;
  if (urls && Array.isArray(urls) && urls.length > 0) {
    return urls.map((u) => resolveListingImageUrl(u)).filter(Boolean) as string[];
  }
  const single = resolveListingImageUrl(listing.imageUrl);
  return single ? [single] : [];
}
