/**
 * Profile page view model. Every column, tab, and badge here is derived from
 * fields the existing APIs already return. Missing inputs stay as an em dash.
 * This module does not invent followers, member-since, or a mark-sold action.
 */
import { completionPercent } from "./mediaTrust";
import { formatContractAmountToHbar, parseHbarAmount, withHbarGlyph } from "./formatPrice";

export type ProfileTabId = "shop" | "sold" | "purchased" | "likes" | "reviews";

export type ProfileTab = { id: ProfileTabId; label: string };

/**
 * Own: Shop, Sold, Purchased, Likes.
 * Public: Shop, Sold, Reviews, plus Likes when the public wishlist read succeeds.
 * Likes sits before Reviews so the item grids stay together.
 */
export function profileTabList(isSelf: boolean, likesAvailable: boolean): ProfileTab[] {
  if (isSelf) {
    return [
      { id: "shop", label: "Shop" },
      { id: "sold", label: "Sold" },
      { id: "purchased", label: "Purchased" },
      { id: "likes", label: "Likes" },
    ];
  }
  const tabs: ProfileTab[] = [
    { id: "shop", label: "Shop" },
    { id: "sold", label: "Sold" },
  ];
  if (likesAvailable) tabs.push({ id: "likes", label: "Likes" });
  tabs.push({ id: "reviews", label: "Reviews" });
  return tabs;
}

export type ProfileStatId = "deals" | "listings" | "completion" | "rating";

export type ProfileStat = {
  id: ProfileStatId;
  value: string;
  label: string;
};

/** Shown in a stat column when that number was not returned. */
export const PROFILE_STAT_MISSING = "—";

export type ProfileStatInput = {
  /**
   * Tile count on the Sold tab. That tab is seller-role purchases plus archived
   * listings that are no longer listed, so this is the deals column. It is not
   * `successfulCompletions`, which can stay 0 while those rows exist.
   * Null when the purchases or listings read has not landed.
   */
  soldCount?: number | null;
  /**
   * Active shop listings from the user payload. Fills the first column only
   * when `soldCount` is unknown.
   */
  activeListings?: number | null;
  successfulCompletions?: number | null;
  totalSales?: number | null;
  ratingAverage?: number | null;
  ratingCount?: number | null;
};

function isCount(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function formatCount(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}

/**
 * Always three columns: deals, completion %, and ★ rating.
 * A missing number is "—". Active listings stand in for deals only when the
 * Sold-tab count has not loaded, so the row never collapses to a single "0".
 */
export function profileStatColumns(input: ProfileStatInput): ProfileStat[] {
  const deals: ProfileStat = isCount(input.soldCount)
    ? { id: "deals", value: formatCount(input.soldCount), label: "deals" }
    : isCount(input.activeListings)
      ? { id: "listings", value: formatCount(input.activeListings), label: "listings" }
      : { id: "deals", value: PROFILE_STAT_MISSING, label: "deals" };

  const pct = completionPercent(input.successfulCompletions, input.totalSales);
  const completion: ProfileStat = {
    id: "completion",
    value: pct == null ? PROFILE_STAT_MISSING : `${pct}%`,
    label: "completion",
  };

  let rating: ProfileStat = { id: "rating", value: PROFILE_STAT_MISSING, label: "rating" };
  if (
    input.ratingAverage != null &&
    Number.isFinite(input.ratingAverage) &&
    isCount(input.ratingCount) &&
    input.ratingCount > 0
  ) {
    const rounded = Math.round(input.ratingAverage * 10) / 10;
    const value = Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1);
    rating = {
      id: "rating",
      value: `★ ${value}`,
      label: `rating (${formatCount(input.ratingCount)})`,
    };
  }

  return [deals, completion, rating];
}

type SoldSale = { role?: string | null; listingId?: string | null };
type SoldListing = { id: string; status?: string | null };

/**
 * The Sold tab: seller-role purchases, plus archived listings that are not
 * still listed and are not already represented by one of those sales.
 */
export function selectSoldEntries<S extends SoldSale, L extends SoldListing>(
  sales: S[],
  archived: L[],
): { sales: S[]; archived: L[] } {
  const sellerSales = sales.filter((sale) => sale.role === "seller");
  const covered = new Set(
    sellerSales.map((sale) => sale.listingId).filter((id): id is string => !!id),
  );
  const extras = archived.filter(
    (listing) =>
      !covered.has(listing.id) && String(listing.status ?? "").toUpperCase() !== "LISTED",
  );
  return { sales: sellerSales, archived: extras };
}

export const PROFILE_EARNINGS_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export function hbarNumber(price: string | null | undefined): number {
  const n = parseHbarAmount(price);
  return Number.isFinite(n) ? n : 0;
}

export function chainAmountToHbar(amount: string | null | undefined): number {
  const n = Number(formatContractAmountToHbar(amount ?? "0").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/** ℏ first, grouped, with the thin space Direction C uses before the glyph. */
export function formatProfileHbar(amount: number): string {
  if (!Number.isFinite(amount)) return withHbarGlyph("0");
  const rounded = Math.round(amount * 100) / 100;
  const text = rounded.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return withHbarGlyph(text);
}

export function formatProfileFiat(hbar: number, usdPerHbar: number | null): string | null {
  if (usdPerHbar == null || !(usdPerHbar > 0) || !Number.isFinite(hbar)) return null;
  const usd = hbar * usdPerHbar;
  if (usd > 0 && usd < 0.01) return `≈ $${usd.toFixed(4)}`;
  return `≈ $${usd.toFixed(2)}`;
}

export type EarningsSale = {
  role?: string | null;
  amount?: string | null;
  createdAt?: string | null;
};

export function earnedLast30Hbar(sales: EarningsSale[], now = Date.now()): number {
  const cutoff = now - PROFILE_EARNINGS_WINDOW_MS;
  return sales.reduce((sum, sale) => {
    if (sale.role !== "seller") return sum;
    const at = Date.parse(sale.createdAt ?? "");
    if (!Number.isFinite(at) || at < cutoff || at > now) return sum;
    return sum + hbarNumber(sale.amount);
  }, 0);
}

export function potentialRevenueHbar(activeListings: { price?: string | null }[]): number {
  return activeListings.reduce((sum, listing) => sum + hbarNumber(listing.price), 0);
}

const OPEN_ESCROW_STATES = new Set(["AWAITING_SHIPMENT", "AWAITING_CONFIRMATION", "SHIPPED"]);

export type OpenEscrowSummary = { hbar: number; deals: number };

/** Null when nothing is still locked. Complete and refunded deals are not escrow. */
export function summarizeOpenEscrow(
  views: { state?: string | null; amount?: string | null }[],
): OpenEscrowSummary | null {
  const open = views.filter((view) =>
    OPEN_ESCROW_STATES.has(String(view.state ?? "").toUpperCase()),
  );
  if (open.length === 0) return null;
  const hbar = open.reduce((sum, view) => sum + chainAmountToHbar(view.amount), 0);
  return { hbar, deals: open.length };
}

export type EarningsColumnId = "earned" | "potential" | "escrow";

export type EarningsColumn = {
  id: EarningsColumnId;
  amountLabel: string;
  caption: string;
  detail: string;
  fiatLabel: string | null;
};

export function profileEarnings(input: {
  sales: EarningsSale[];
  activeListings: { price?: string | null }[];
  openEscrow: OpenEscrowSummary | null;
  usdPerHbar: number | null;
  now?: number;
}): EarningsColumn[] {
  const earned = earnedLast30Hbar(input.sales, input.now);
  const potential = potentialRevenueHbar(input.activeListings);
  const activeCount = input.activeListings.length;
  const columns: EarningsColumn[] = [
    {
      id: "earned",
      amountLabel: formatProfileHbar(earned),
      caption: "earned",
      detail: "Last 30 days",
      fiatLabel: formatProfileFiat(earned, input.usdPerHbar),
    },
    {
      id: "potential",
      amountLabel: formatProfileHbar(potential),
      caption: "potential",
      detail: `From ${activeCount} active ${activeCount === 1 ? "listing" : "listings"}`,
      fiatLabel: formatProfileFiat(potential, input.usdPerHbar),
    },
  ];
  if (input.openEscrow && input.openEscrow.deals > 0) {
    const deals = input.openEscrow.deals;
    columns.push({
      id: "escrow",
      amountLabel: formatProfileHbar(input.openEscrow.hbar),
      caption: "protected payment",
      detail: `From ${deals} open ${deals === 1 ? "deal" : "deals"}`,
      fiatLabel: formatProfileFiat(input.openEscrow.hbar, input.usdPerHbar),
    });
  }
  return columns;
}

export type TileBadgeTone = "sold" | "escrow" | "offer";

export type TileBadge = { label: string; tone: TileBadgeTone };

/** At most one badge. Sold beats in-escrow, which beats an active offer. */
export function profileTileBadge(input: {
  status?: string | null;
  hasActiveOffer?: boolean;
}): TileBadge | null {
  const status = String(input.status ?? "")
    .trim()
    .toUpperCase();
  if (status === "SOLD" || status === "COMPLETED") return { label: "Sold", tone: "sold" };
  if (status === "LOCKED") return { label: "Protected", tone: "escrow" };
  if (input.hasActiveOffer) return { label: "Offer", tone: "offer" };
  return null;
}

export type ShopSort = "newest" | "price-asc" | "price-desc";

export type ShopFilter = {
  sort: ShopSort;
  category: string | null;
  minPrice: number | null;
  maxPrice: number | null;
};

export const DEFAULT_SHOP_FILTER: ShopFilter = {
  sort: "newest",
  category: null,
  minPrice: null,
  maxPrice: null,
};

export function shopFilterIsConstrained(filter: ShopFilter): boolean {
  return filter.category != null || filter.minPrice != null || filter.maxPrice != null;
}

export function shopCategories(items: { category?: string | null }[]): string[] {
  const seen = new Set<string>();
  for (const item of items) {
    const category = item.category?.trim();
    if (category) seen.add(category);
  }
  return Array.from(seen).sort((a, b) => a.localeCompare(b));
}

export function filterShopListings<
  T extends { price?: string | null; category?: string | null; createdAt?: string | null },
>(items: T[], filter: ShopFilter): T[] {
  const next = items.filter((item) => {
    if (filter.category && (item.category?.trim() || "") !== filter.category) return false;
    const price = hbarNumber(item.price);
    if (filter.minPrice != null && price < filter.minPrice) return false;
    if (filter.maxPrice != null && price > filter.maxPrice) return false;
    return true;
  });
  next.sort((a, b) => {
    if (filter.sort === "price-asc") return hbarNumber(a.price) - hbarNumber(b.price);
    if (filter.sort === "price-desc") return hbarNumber(b.price) - hbarNumber(a.price);
    const at = Date.parse(a.createdAt ?? "");
    const bt = Date.parse(b.createdAt ?? "");
    return (Number.isFinite(bt) ? bt : 0) - (Number.isFinite(at) ? at : 0);
  });
  return next;
}

export function activeListingsLabel(count: number): string {
  const noun = count === 1 ? "listing" : "listings";
  return `Active (${formatCount(count)} ${noun})`;
}

export const OWN_SHOP_EMPTY = {
  headline: "No active listings",
  body: "List an item so buyers can find you.",
  cta: "Start selling",
} as const;

export const PUBLIC_SHOP_EMPTY = {
  headline: "Nothing listed right now.",
} as const;
