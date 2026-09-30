import { CATEGORY_GROUPS, canonicalizeCategory } from "./categories";
import { formatPriceForDisplay } from "./formatPrice";
import type { ListingType } from "./marketplaceFilters";
import type { MapBounds } from "./mapTiles";

/** Sheet shows the closest listings in the current map area. */
export const NEARBY_SHEET_LIMIT = 50;

const METERS_PER_MILE = 1609.344;

const DIGITAL_CATEGORIES = new Set(
  CATEGORY_GROUPS.find((group) => group.group === "Digital & Software")?.categories ?? [],
);

export const NEARBY_PRICE_BANDS = [
  { id: "any", label: "Any price", chip: "Price ℏ" },
  { id: "under-25", label: "Under 25 ℏ", chip: "Under 25 ℏ" },
  { id: "25-100", label: "25–100 ℏ", chip: "25–100 ℏ" },
  { id: "over-100", label: "100+ ℏ", chip: "100+ ℏ" },
] as const;

export type NearbyPriceBand = (typeof NEARBY_PRICE_BANDS)[number]["id"];

export type NearbyListing = {
  id: string;
  title: string | null;
  subtitle: string | null;
  description: string | null;
  price: string | null;
  lat: number;
  lng: number;
  imageUrl: string | null;
  mediaUrls: string[];
  seller?: string;
  status?: string;
  requireEscrow?: boolean | null;
  category: string | null;
  condition: string | null;
  city: string | null;
};

export type NearbySheetItem = NearbyListing & {
  distanceMeters: number | null;
  distanceLabel: string | null;
};

export type NearbyCriteria = {
  query: string;
  listingType: ListingType;
  priceBand: NearbyPriceBand;
  condition: string;
};

function finiteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

export function isDigitalListingCategory(category: string | null | undefined): boolean {
  return DIGITAL_CATEGORIES.has(canonicalizeCategory(category ?? ""));
}

export function nearbyHbar(price: string | null | undefined): number | null {
  const amount = Number(formatPriceForDisplay(price));
  return Number.isFinite(amount) ? amount : null;
}

/** Pin text is the listing price in ℏ. Star ratings are never used. */
export function nearbyPinLabel(price: string | null | undefined): string {
  return `${formatPriceForDisplay(price)} ℏ`;
}

export function nearbyCountLabel(count: number): string {
  return count === 1 ? "1 listing nearby" : `${count} listings nearby`;
}

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Creative lock uses miles (`0.8 mi`) on the sheet card. */
export function formatNearbyDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return "";
  const miles = meters / METERS_PER_MILE;
  if (miles < 0.1) return "< 0.1 mi";
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}

export function isInsideBounds(lat: number, lng: number, bounds: MapBounds): boolean {
  if (lat < bounds.south || lat > bounds.north) return false;
  if (bounds.west <= bounds.east) return lng >= bounds.west && lng <= bounds.east;
  return lng >= bounds.west || lng <= bounds.east;
}

export function parseNearbyListing(raw: unknown): NearbyListing | null {
  if (!raw || typeof raw !== "object") return null;
  const listing = raw as Record<string, unknown>;
  const id = listing.id == null ? "" : String(listing.id);
  const lat = finiteNumber(listing.locationLat);
  const lng = finiteNumber(listing.locationLng);
  if (!id || lat == null || lng == null) return null;
  const mediaUrls = Array.isArray(listing.mediaUrls)
    ? listing.mediaUrls.filter((url): url is string => typeof url === "string")
    : [];
  return {
    id,
    title: text(listing.title),
    subtitle: text(listing.subtitle),
    description: text(listing.description),
    price: listing.price == null || listing.price === "" ? null : String(listing.price),
    lat,
    lng,
    imageUrl: text(listing.imageUrl),
    mediaUrls,
    seller: text(listing.seller) ?? undefined,
    status: text(listing.status) ?? undefined,
    requireEscrow: typeof listing.requireEscrow === "boolean" ? listing.requireEscrow : null,
    category: text(listing.category),
    condition: text(listing.condition),
    city: text(listing.city),
  };
}

function matchesQuery(listing: NearbyListing, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [
    listing.title,
    listing.subtitle,
    listing.description,
    listing.category,
    listing.condition,
    listing.city,
  ].some((field) => field?.toLowerCase().includes(needle));
}

function matchesType(listing: NearbyListing, listingType: ListingType): boolean {
  if (listingType === "all") return true;
  const digital = isDigitalListingCategory(listing.category);
  return listingType === "digital" ? digital : !digital;
}

function matchesPrice(listing: NearbyListing, band: NearbyPriceBand): boolean {
  if (band === "any") return true;
  const hbar = nearbyHbar(listing.price);
  if (hbar == null) return false;
  if (band === "under-25") return hbar < 25;
  if (band === "25-100") return hbar >= 25 && hbar <= 100;
  return hbar > 100;
}

function matchesCondition(listing: NearbyListing, condition: string): boolean {
  const expected = condition.trim().toLowerCase();
  if (!expected) return true;
  return (listing.condition ?? "").trim().toLowerCase() === expected;
}

export function filterNearbyListings(
  listings: NearbyListing[],
  criteria: NearbyCriteria,
): NearbyListing[] {
  return listings.filter(
    (listing) =>
      matchesQuery(listing, criteria.query) &&
      matchesType(listing, criteria.listingType) &&
      matchesPrice(listing, criteria.priceBand) &&
      matchesCondition(listing, criteria.condition),
  );
}

function withDistance(
  listing: NearbyListing,
  focus: { lat: number; lng: number } | null,
): NearbySheetItem {
  if (!focus) return { ...listing, distanceMeters: null, distanceLabel: null };
  const distanceMeters = haversineMeters(focus.lat, focus.lng, listing.lat, listing.lng);
  return {
    ...listing,
    distanceMeters,
    distanceLabel: formatNearbyDistance(distanceMeters),
  };
}

/**
 * Listings inside the map bounds, closest to the map focus first.
 * `pinId` stays in the sheet when that listing matched the filters,
 * even if the 50-cap or the viewport would have dropped it.
 */
export function selectNearbySheet(
  listings: NearbyListing[],
  criteria: NearbyCriteria & {
    bounds: MapBounds | null;
    focus: { lat: number; lng: number } | null;
    pinId?: string | null;
    limit?: number;
  },
): { totalInArea: number; items: NearbySheetItem[] } {
  const limit = criteria.limit ?? NEARBY_SHEET_LIMIT;
  const matched = filterNearbyListings(listings, criteria);
  const inArea = criteria.bounds
    ? matched.filter((listing) => isInsideBounds(listing.lat, listing.lng, criteria.bounds!))
    : matched;
  const ranked = inArea
    .map((listing) => withDistance(listing, criteria.focus))
    .sort((a, b) => {
      if (a.distanceMeters == null && b.distanceMeters == null) return 0;
      if (a.distanceMeters == null) return 1;
      if (b.distanceMeters == null) return -1;
      return a.distanceMeters - b.distanceMeters;
    });
  let items = ranked.slice(0, limit);
  if (criteria.pinId && !items.some((item) => item.id === criteria.pinId)) {
    const forced = matched.find((listing) => listing.id === criteria.pinId);
    if (forced) items = [withDistance(forced, criteria.focus), ...items].slice(0, limit);
  }
  return { totalInArea: inArea.length, items };
}
