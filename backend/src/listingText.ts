/** Trim listing copy. Whitespace-only and non-strings become null. */
export function trimmedOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * PATCH title. An omitted title stays unchanged. A title that was sent must
 * trim to a non-empty string; otherwise the edit is rejected.
 */
export function patchListingTitle(title: unknown): { ok: true; value?: string } | { ok: false } {
  if (title === undefined) return { ok: true };
  if (typeof title !== "string") return { ok: false };
  const value = title.trim();
  if (value === "") return { ok: false };
  return { ok: true, value };
}

/**
 * Sync title. Omitted titles stay unchanged. A blank title is stored as the
 * trimmed string so the upsert still writes the on-chain listing.
 */
export function syncListingTitle(title: unknown): { value: string; empty: boolean } | undefined {
  if (typeof title !== "string") return undefined;
  const value = title.trim();
  return { value, empty: value === "" };
}
