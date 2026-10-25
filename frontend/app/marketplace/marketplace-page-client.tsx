"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ListingCard } from "../../components/ListingCard";
import { parseHbarAmount } from "../../lib/formatPrice";
import { canonicalizeCategory, CATEGORY_GROUPS } from "../../lib/categories";
import { getApiUrl } from "../../lib/apiUrl";
import { useProfiles } from "../../lib/profiles";
import {
  activeFilterCount,
  clearListingFilters,
  marketplaceHref,
  resetMarketplaceFilters,
  withAdvancedFilters,
  withListingType,
  withSort,
  type AdvancedFilterDraft,
  type ListingType,
  type SortMode,
} from "../../lib/marketplaceFilters";
import {
  MarketplaceFilterPanel,
  MarketplaceSortPanel,
} from "../../components/MarketplaceFilterPanel";
import { MarketplaceMobileHeader } from "../../components/MarketplaceMobileHeader";
import { MarketplaceDesktopHeader } from "../../components/MarketplaceDesktopHeader";
import { MarketplaceDesktopToolbar } from "../../components/MarketplaceDesktopToolbar";
import {
  MarketplaceBrowseRail,
  MarketplaceFilterDrawer,
  RAIL_PRICE_CEILING,
} from "../../components/MarketplaceBrowseRail";
import { LISTINGS_UNAVAILABLE_COPY, type ListingItem } from "../../lib/loadMarketplaceListings";

export type { ListingItem };

function parsePostedWithinDays(value: string): number | null {
  if (!value) return null;
  const daysMap: Record<string, number> = {
    "1d": 1,
    "1w": 7,
    "1m": 30,
    "3m": 90,
    "6m": 180,
    "1y": 365,
    "2y": 730,
  };
  return daysMap[value] ?? null;
}

// Digital goods = the "Digital & Software" category group (software, digital
// downloads, access codes & gift cards, NFTs). Everything else is physical.
const DIGITAL_CATEGORIES = new Set(
  CATEGORY_GROUPS.find((g) => g.group === "Digital & Software")?.categories ?? [],
);
const ALL_CATEGORIES = CATEGORY_GROUPS.flatMap((g) => g.categories);

function parseListingType(value: string | null): ListingType {
  return value === "physical" || value === "digital" ? value : "all";
}

function parseSortMode(value: string | null): SortMode {
  if (value === "price-asc" || value === "price-desc" || value === "trending") return value;
  return "recent";
}

export default function MarketplacePageClient({
  initialItems,
  initialError,
  intro = null,
  about = null,
}: {
  initialItems: ListingItem[];
  initialError: boolean;
  /** Server-rendered homepage intro. Omitted on /marketplace. */
  intro?: ReactNode;
  /** Server-rendered homepage about section. Omitted on /marketplace. */
  about?: ReactNode;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get("q")?.trim() ?? "";
  const [searchInput, setSearchInput] = useState(query);
  // Both header search fields read this value. Keep them on ?q= across
  // client navigations (listing search, back/forward), not only first mount.
  useEffect(() => {
    setSearchInput(query);
  }, [query]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [desktopFilterOpen, setDesktopFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // "F" focuses the top-bar search (unless the user is already typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "f" || e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (document.activeElement?.tagName ?? "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      e.preventDefault();
      const input = searchInputRef.current;
      if (input && input.offsetParent !== null) input.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const [filterMinPrice, setFilterMinPrice] = useState("");
  const [filterMaxPrice, setFilterMaxPrice] = useState("");
  const [filterPostedWithin, setFilterPostedWithin] = useState("");
  const [filterCondition, setFilterCondition] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const categoryQuery = canonicalizeCategory(searchParams.get("category")?.trim() ?? "");
  const minPriceQuery = searchParams.get("minPrice")?.trim() ?? "";
  const maxPriceQuery = searchParams.get("maxPrice")?.trim() ?? "";
  const postedWithinQuery = searchParams.get("postedWithin")?.trim() ?? "";
  const conditionQuery = searchParams.get("condition")?.trim() ?? "";
  const locationQuery = searchParams.get("location")?.trim() ?? "";
  const sortMode: SortMode = parseSortMode(searchParams.get("sort"));
  const typeQuery: ListingType = parseListingType(searchParams.get("type"));
  // Category pills for the selected listing type (layer 2 of the mobile
  // filter). All → every category; physical/digital → their halves.
  const typeCategories = useMemo(() => {
    if (typeQuery === "digital") return ALL_CATEGORIES.filter((c) => DIGITAL_CATEGORIES.has(c));
    if (typeQuery === "physical") return ALL_CATEGORIES.filter((c) => !DIGITAL_CATEGORIES.has(c));
    return ALL_CATEGORIES;
  }, [typeQuery]);
  // Items start from the SSR payload but live in state so the client can
  // recover when the server-side fetch timed out or failed (bounded TTFB),
  // and so refreshes can revalidate without a full reload.
  const [items, setItems] = useState<ListingItem[]>(initialItems);
  const [listingsError, setListingsError] = useState(initialError);
  const [retrying, setRetrying] = useState(false);
  // fuse.js is only the fuzzy fallback. Keep it out of the default first load.
  const [FuseCtor, setFuseCtor] = useState<typeof import("fuse.js").default | null>(null);

  const reloadListings = async (isCancelled?: () => boolean) => {
    setRetrying(true);
    try {
      const response = await fetch(`${getApiUrl()}/api/listings`, { cache: "no-store" });
      if (!response.ok) throw new Error(`listings request failed (${response.status})`);
      const data = (await response.json()) as { listings?: ListingItem[] };
      const list = (data.listings ?? []).map((l) => ({
        ...l,
        itemType: "listing" as const,
      }));
      if (isCancelled?.()) return;
      setItems(list);
      setListingsError(false);
    } catch (error) {
      console.error("[marketplace] failed to load listings", error);
      if (isCancelled?.()) return;
      setListingsError(true);
    } finally {
      if (!isCancelled?.()) setRetrying(false);
    }
  };

  useEffect(() => {
    if (initialItems.length > 0) return;
    let cancelled = false;
    void reloadListings(() => cancelled);
    return () => {
      cancelled = true;
    };
    // Retry is explicit. The mount recovery only runs when SSR had nothing to show.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Warm the profile cache for every seller in one batched request so cards
  // can render display names, avatars and ratings without per-card fetches.
  useProfiles(items.map((i) => i.seller));

  // Signal the boot splash that the marketplace (the default landing route)
  // has mounted and its content is in the DOM, so the splash fades into a
  // fully-rendered page rather than the empty Suspense fallback.
  useEffect(() => {
    (window as unknown as { __hashpopReady?: boolean }).__hashpopReady = true;
    window.dispatchEvent(new Event("hashpop:ready"));
  }, []);

  const fuzzyNeeded = Boolean(query || categoryQuery);
  useEffect(() => {
    if (!fuzzyNeeded || FuseCtor) return;
    let cancelled = false;
    void import("fuse.js").then((mod) => {
      if (!cancelled) setFuseCtor(() => mod.default);
    });
    return () => {
      cancelled = true;
    };
  }, [fuzzyNeeded, FuseCtor]);

  const filteredItems = useMemo(() => {
    // Listing type (all / physical / digital) narrows before category/query.
    let typeMatched = items;
    if (typeQuery !== "all") {
      typeMatched = items.filter((item) => {
        const digital = DIGITAL_CATEGORIES.has(canonicalizeCategory(item.category ?? ""));
        return typeQuery === "digital" ? digital : !digital;
      });
    }
    let categoryMatched = typeMatched;
    if (categoryQuery) {
      const normalizedCategory = categoryQuery.toLowerCase();
      const strict = typeMatched.filter(
        (item) => canonicalizeCategory(item.category ?? "").toLowerCase() === normalizedCategory,
      );
      if (strict.length > 0) {
        categoryMatched = strict;
      } else if (FuseCtor) {
        const catFuse = new FuseCtor(typeMatched, {
          includeScore: true,
          threshold: 0.3,
          ignoreLocation: true,
          keys: [{ name: "category", weight: 1 }],
        });
        categoryMatched = catFuse.search(categoryQuery).map((r) => r.item);
      }
    }

    let queryMatched = categoryMatched;
    if (query) {
      const q = query.toLowerCase();
      // Substring match first — exact word/phrase hits in any field
      const substringHits = categoryMatched.filter((item) =>
        [item.title, item.subtitle, item.description, item.category].some((f) =>
          f?.toLowerCase().includes(q),
        ),
      );
      if (substringHits.length > 0) {
        queryMatched = substringHits;
      } else {
        // Tight fuzzy fallback (threshold 0.2 ≈ only near-exact matches)
        if (FuseCtor) {
          const fuse = new FuseCtor(categoryMatched, {
            includeScore: true,
            threshold: 0.2,
            minMatchCharLength: 3,
            ignoreLocation: true,
            keys: [
              { name: "title", weight: 0.55 },
              { name: "subtitle", weight: 0.15 },
              { name: "description", weight: 0.2 },
              { name: "category", weight: 0.1 },
            ],
          });
          queryMatched = fuse.search(query).map((r) => r.item);
        }
      }
    }

    const minPrice = minPriceQuery !== "" ? Number(minPriceQuery) : null;
    const maxPrice = maxPriceQuery !== "" ? Number(maxPriceQuery) : null;
    const min = minPrice != null && !Number.isNaN(minPrice) ? minPrice : null;
    const max = maxPrice != null && !Number.isNaN(maxPrice) ? maxPrice : null;
    const postedDays = parsePostedWithinDays(postedWithinQuery);
    const now = Date.now();
    const maxAgeMs = postedDays ? postedDays * 24 * 60 * 60 * 1000 : null;

    const filtered = queryMatched.filter((item) => {
      const hbar = parseHbarAmount(item.price || "0");
      if (min != null && (Number.isNaN(hbar) || hbar < min)) return false;
      if (max != null && (Number.isNaN(hbar) || hbar > max)) return false;
      if (maxAgeMs != null) {
        const createdMs = new Date(item.createdAt || 0).getTime();
        if (!createdMs || Number.isNaN(createdMs)) return false;
        if (now - createdMs > maxAgeMs) return false;
      }
      if (conditionQuery && item.condition?.toLowerCase() !== conditionQuery.toLowerCase())
        return false;
      if (locationQuery && (item.city ?? "").trim().toLowerCase() !== locationQuery.toLowerCase())
        return false;
      return true;
    });

    const sorted = [...filtered];
    const priceOf = (i: ListingItem) => {
      const n = parseHbarAmount(i.price || "0");
      return Number.isNaN(n) ? 0 : n;
    };
    if (sortMode === "price-asc") sorted.sort((a, b) => priceOf(a) - priceOf(b));
    else if (sortMode === "price-desc") sorted.sort((a, b) => priceOf(b) - priceOf(a));
    else if (sortMode === "trending")
      sorted.sort((a, b) => (b.watchlistCount ?? 0) - (a.watchlistCount ?? 0));
    else
      sorted.sort(
        (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
      );
    return sorted;
  }, [
    items,
    query,
    typeQuery,
    categoryQuery,
    locationQuery,
    minPriceQuery,
    maxPriceQuery,
    postedWithinQuery,
    conditionQuery,
    sortMode,
    FuseCtor,
  ]);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchInput.trim();
    const p = new URLSearchParams(searchParams.toString());
    if (q) p.set("q", q);
    else p.delete("q");
    router.push(p.toString() ? `/marketplace?${p.toString()}` : "/marketplace");
    setSearchInput("");
    setFilterOpen(false);
  };

  const syncFilterDraft = () => {
    setFilterMinPrice(minPriceQuery);
    setFilterMaxPrice(maxPriceQuery);
    setFilterPostedWithin(postedWithinQuery);
    setFilterCondition(conditionQuery);
    setFilterLocation(locationQuery);
  };

  const openFilterPanel = () => {
    setSortOpen(false);
    setFilterOpen((o) => !o);
    syncFilterDraft();
  };

  const openSortSheet = () => {
    setFilterOpen(false);
    setSortOpen((o) => !o);
  };

  // Distinct cities present in the current listing set, used to populate the
  // location dropdown. Cap to 50 to keep the panel manageable.
  const knownCities = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) {
      const c = it.city?.trim();
      if (c) set.add(c);
    }
    return Array.from(set)
      .sort((a, b) => a.localeCompare(b))
      .slice(0, 50);
  }, [items]);

  const filterDraft: AdvancedFilterDraft = {
    minPrice: filterMinPrice,
    maxPrice: filterMaxPrice,
    postedWithin: filterPostedWithin,
    condition: filterCondition,
    location: filterLocation,
  };

  const renderFilterSortPanel = (browse: boolean, sheet = false) => (
    <MarketplaceFilterPanel
      browse={browse}
      showSort={!sheet}
      showActions={!sheet}
      sortMode={sortMode}
      type={typeQuery}
      category={categoryQuery}
      categories={typeCategories}
      cities={knownCities}
      draft={filterDraft}
      onDraft={(next) => {
        setFilterMinPrice(next.minPrice);
        setFilterMaxPrice(next.maxPrice);
        setFilterPostedWithin(next.postedWithin);
        setFilterCondition(next.condition);
        setFilterLocation(next.location);
      }}
      onSort={(sort) => router.push(marketplaceHref(withSort(searchParams, sort)))}
      onType={(type) => router.push(marketplaceHref(withListingType(searchParams, type)))}
      onReset={() => {
        setFilterOpen(false);
        router.push(marketplaceHref(resetMarketplaceFilters(searchParams)));
      }}
      onApply={() => {
        setFilterOpen(false);
        router.push(marketplaceHref(withAdvancedFilters(searchParams, filterDraft)));
      }}
    />
  );

  const filterCount = activeFilterCount({
    type: typeQuery,
    category: categoryQuery,
    minPrice: minPriceQuery,
    maxPrice: maxPriceQuery,
    postedWithin: postedWithinQuery,
    condition: conditionQuery,
    location: locationQuery,
  });

  const priceCeiling = useMemo(() => {
    let highest = 0;
    for (const item of items) {
      const n = parseHbarAmount(item.price || "0");
      if (!Number.isNaN(n)) highest = Math.max(highest, n);
    }
    if (highest <= RAIL_PRICE_CEILING) return RAIL_PRICE_CEILING;
    return Math.ceil(highest / 50) * 50;
  }, [items]);

  const urlDraft: AdvancedFilterDraft = {
    minPrice: minPriceQuery,
    maxPrice: maxPriceQuery,
    postedWithin: postedWithinQuery,
    condition: conditionQuery,
    location: locationQuery,
  };

  const pushDraft = (partial: Partial<AdvancedFilterDraft>) => {
    router.push(marketplaceHref(withAdvancedFilters(searchParams, { ...urlDraft, ...partial })));
  };

  const commitPrice = (min: string, max: string) => {
    const next = new URLSearchParams(searchParams.toString());
    if (min) next.set("minPrice", min);
    else next.delete("minPrice");
    if (max) next.set("maxPrice", max);
    else next.delete("maxPrice");
    router.replace(marketplaceHref(next));
  };

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(min-width: 1024px)");
    const closeDrawer = () => {
      if (query.matches) setDesktopFilterOpen(false);
    };
    query.addEventListener("change", closeDrawer);
    return () => query.removeEventListener("change", closeDrawer);
  }, []);

  const renderBrowseRail = () => (
    <MarketplaceBrowseRail
      type={typeQuery}
      location={locationQuery}
      condition={conditionQuery}
      minPrice={minPriceQuery}
      maxPrice={maxPriceQuery}
      cities={knownCities}
      priceCeiling={priceCeiling}
      onType={(type) => router.push(marketplaceHref(withListingType(searchParams, type)))}
      onLocation={(location) => pushDraft({ location })}
      onCondition={(condition) => pushDraft({ condition })}
      onPrice={commitPrice}
      onClear={() => router.push(marketplaceHref(clearListingFilters(searchParams)))}
    />
  );

  return (
    <main className="min-h-screen">
      <MarketplaceDesktopHeader
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        onSearchSubmit={submitSearch}
        searchInputRef={searchInputRef}
      />
      <div className="px-3 pb-4 md:px-5 md:pb-6 md:pt-4">
        <MarketplaceMobileHeader
          searchValue={searchInput}
          onSearchChange={setSearchInput}
          onSearchSubmit={submitSearch}
          filterOpen={filterOpen}
          onOpenFilters={openFilterPanel}
          onCloseFilters={() => setFilterOpen(false)}
          filterCount={filterCount}
          resultCount={filteredItems.length}
          onClearFilters={() => {
            setFilterMinPrice("");
            setFilterMaxPrice("");
            setFilterPostedWithin("");
            setFilterCondition("");
            setFilterLocation("");
            router.push(marketplaceHref(clearListingFilters(searchParams)));
          }}
          onShowResults={() => {
            setFilterOpen(false);
            router.push(marketplaceHref(withAdvancedFilters(searchParams, filterDraft)));
          }}
          filterSheet={renderFilterSortPanel(true, true)}
          sortOpen={sortOpen}
          onOpenSort={openSortSheet}
          onCloseSort={() => setSortOpen(false)}
          sortSheet={
            <MarketplaceSortPanel
              sortMode={sortMode}
              onSort={(sort) => router.push(marketplaceHref(withSort(searchParams, sort)))}
            />
          }
        />

        <div className="lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start lg:gap-5">
          <aside className="sticky top-[72px] z-10 hidden self-start lg:block">
            <div className="max-h-[calc(100dvh-5.5rem)] overflow-y-auto">{renderBrowseRail()}</div>
          </aside>
          <div className="min-w-0">
            {intro}
            <MarketplaceDesktopToolbar
              resultCount={filteredItems.length}
              sortMode={sortMode}
              filterCount={filterCount}
              onSort={(sort) => router.push(marketplaceHref(withSort(searchParams, sort)))}
              onOpenFilters={() => setDesktopFilterOpen(true)}
            />
            {listingsError ? (
              <div className="rounded-glass-lg border border-white/10 bg-white/[0.04] px-4 py-6 text-center">
                <p className="font-sans text-[15px] font-normal leading-[22px] text-white/70">
                  {LISTINGS_UNAVAILABLE_COPY}
                </p>
                <button
                  type="button"
                  onClick={() => void reloadListings()}
                  disabled={retrying}
                  className="btn-mint mt-4 inline-flex h-11 items-center rounded-full px-5 text-[15px] font-semibold disabled:opacity-60"
                >
                  Try again
                </button>
              </div>
            ) : filteredItems.length === 0 ? (
              <p className="text-silver">
                {query && categoryQuery
                  ? `No listings matched "${query}" in ${categoryQuery}.`
                  : query
                    ? `No listings matched "${query}".`
                    : categoryQuery
                      ? `No listings found in ${categoryQuery}.`
                      : minPriceQuery || maxPriceQuery || postedWithinQuery
                        ? "No listings matched your advanced filters."
                        : "No listings found. Create one to get started!"}
              </p>
            ) : (
              <>
                {/* Mobile 2-up: 12px page margins, 8px gutter. Desktop is the same soft-trust grid. */}
                <div data-testid="listing-grid" className="grid grid-cols-2 gap-2 md:hidden">
                  {filteredItems.map((item, index) => (
                    <ListingCard
                      key={`${item.itemType}-${item.id}`}
                      item={item}
                      density="compact"
                      variant="softTrust"
                      priority={index === 0}
                    />
                  ))}
                </div>
                <div
                  data-testid="listing-grid"
                  className="hidden gap-4 md:grid md:grid-cols-2 xl:grid-cols-3"
                >
                  {filteredItems.map((item) => (
                    <ListingCard
                      key={`${item.itemType}-${item.id}`}
                      item={item}
                      density="regular"
                      variant="softTrust"
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
        {about}
      </div>
      <MarketplaceFilterDrawer open={desktopFilterOpen} onClose={() => setDesktopFilterOpen(false)}>
        {renderBrowseRail()}
      </MarketplaceFilterDrawer>
    </main>
  );
}
