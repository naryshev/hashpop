/**
 * Listing SKU/variant JSON stored on Listing.variants.
 * Keep in sync with frontend/lib/listingVariants.ts.
 */
export const MAX_LISTING_VARIANTS = 20;

export type ListingVariant = {
  id: string;
  label: string;
  price: string;
  mediaIndex: number | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asPrice(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return String(value);
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n <= 0) return null;
  return trimmed;
}

function asMediaIndex(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(n) || n < 0) return null;
  return n;
}

function newId(): string {
  return `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function parseListingVariants(raw: unknown): ListingVariant[] {
  if (raw == null) return [];
  const list = Array.isArray(raw) ? raw : [];
  const out: ListingVariant[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    if (out.length >= MAX_LISTING_VARIANTS) break;
    if (!isRecord(item)) continue;
    const label = asTrimmedString(item.label);
    const price = asPrice(item.price);
    if (!label || !price) continue;
    let id = asTrimmedString(item.id) || newId();
    if (seen.has(id)) id = newId();
    seen.add(id);
    out.push({
      id,
      label: label.slice(0, 80),
      price,
      mediaIndex: asMediaIndex(item.mediaIndex),
    });
  }
  return out;
}

export function listingVariantsForDb(raw: unknown): ListingVariant[] | undefined {
  if (raw === undefined) return undefined;
  return parseListingVariants(raw);
}
