export const MIN_LISTING_DESCRIPTION_LENGTH = 50;

export const LISTING_DESCRIPTION_ERROR =
  "Add a real description of at least 50 characters. Spaces and punctuation alone don't count.";

/** Trimmed length and a rejection of whitespace / punctuation-only filler. */
export function listingDescriptionError(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  if (trimmed.length < MIN_LISTING_DESCRIPTION_LENGTH) return LISTING_DESCRIPTION_ERROR;
  const meaningful = trimmed.replace(/[\s\p{P}]+/gu, "");
  if (meaningful.length === 0) return LISTING_DESCRIPTION_ERROR;
  return null;
}

/**
 * Edit path. An unchanged description (including a legacy short one) is allowed.
 * A changed description has to pass the create rule.
 */
export function listingDescriptionChangeError(
  previous: string | null | undefined,
  next: string | null | undefined,
): string | null {
  const prev = (previous ?? "").trim();
  const incoming = (next ?? "").trim();
  if (incoming === prev) return null;
  return listingDescriptionError(incoming);
}
