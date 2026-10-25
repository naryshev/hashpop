/**
 * Accessible name for a listing photo.
 * The cover image uses the listing title. Later images are "{title}, photo N"
 * (photo 2 is the second image).
 */
export function listingImageAlt(title: string | null | undefined, index = 0): string {
  const name = (title ?? "").trim() || "Listing";
  if (index <= 0) return name;
  return `${name}, photo ${index + 1}`;
}
