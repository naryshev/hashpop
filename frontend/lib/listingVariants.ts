export const MAX_LISTING_VARIANTS = 20;

export type ListingVariant = {
  id: string;
  label: string;
  /** Absolute price in HBAR (same units as listing.price). */
  price: string;
  /** Optional index into listing.mediaUrls. */
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

export function newListingVariantId(): string {
  return `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function newListingVariant(partial?: Partial<ListingVariant>): ListingVariant {
  return {
    id: partial?.id?.trim() || newListingVariantId(),
    label: partial?.label?.trim() ?? "",
    price: partial?.price?.trim() ?? "",
    mediaIndex: partial?.mediaIndex ?? null,
  };
}

/**
 * Sanitize unknown JSON (API / Prisma) into listing variants.
 * Invalid entries are dropped. Missing/empty input yields [].
 */
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
    let id = asTrimmedString(item.id) || newListingVariantId();
    if (seen.has(id)) id = newListingVariantId();
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

export function listingHasVariants(raw: unknown): boolean {
  return parseListingVariants(raw).length > 0;
}

export function selectedListingVariant(
  variants: ListingVariant[],
  selectedId: string | null | undefined,
): ListingVariant | null {
  if (variants.length === 0) return null;
  if (selectedId) {
    const match = variants.find((v) => v.id === selectedId);
    if (match) return match;
  }
  return variants[0] ?? null;
}

/** Price the buyer pays: selected variant absolute price, else listing price. */
export function resolveListingPrice(opts: {
  listingPrice: string;
  variants?: unknown;
  selectedVariantId?: string | null;
}): string {
  const variants = parseListingVariants(opts.variants);
  const selected = selectedListingVariant(variants, opts.selectedVariantId);
  if (selected) return selected.price;
  return opts.listingPrice;
}

export function validateListingVariantsDraft(variants: ListingVariant[]): string | null {
  if (variants.length === 0) return null;
  if (variants.length > MAX_LISTING_VARIANTS) {
    return `Listings are limited to ${MAX_LISTING_VARIANTS} options.`;
  }
  for (const [i, v] of variants.entries()) {
    if (!v.label.trim()) return `Option ${i + 1} needs a name.`;
    const n = Number(v.price);
    if (!v.price.trim() || !Number.isFinite(n) || n <= 0) {
      return `Option ${i + 1} needs a price greater than 0.`;
    }
  }
  return null;
}
