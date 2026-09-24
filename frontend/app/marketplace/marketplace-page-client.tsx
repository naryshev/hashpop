"use client";
import { formatListingId, listingHref } from "../../lib/listingUrl";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Fuse from "fuse.js";
import { ListingMedia } from "../../components/ListingMedia";
import { ListingCard, formatSellerDisplay } from "../../components/ListingCard";
import { TrustStrip } from "../../components/TrustStrip";
import { StatusBadge } from "../../components/ui/status-badge-beautiful-accessible-status-indicators";
import { formatPriceForDisplay } from "../../lib/formatPrice";
import { formatHbarWithUsd } from "../../lib/hbarUsd";
import { useHbarUsd } from "../../hooks/useHbarUsd";
import { canonicalizeCategory, CATEGORY_GROUPS } from "../../lib/categories";
import { useHashpackWallet } from "../../lib/hashpackWallet";
import { getApiUrl } from "../../lib/apiUrl";
import { useProfiles } from "../../lib/profiles";
import { TopBarSlot } from "../../lib/topBar";
import { listingCta, material } from "../../lib/materials";
import { cn } from "../../lib/utils";
import { parseViewMode, viewModeQueryValue, type ViewMode } from "../../lib/marketplaceView";
import {
  marketplaceHref,
  resetMarketplaceFilters,
  withAdvancedFilters,
  withCategory,
  withListingType,
  withSort,
  type AdvancedFilterDraft,
  type ListingType,
  type SortMode,
} from "../../lib/marketplaceFilters";
import { MarketplaceFilterPanel } from "../../components/MarketplaceFilterPanel";
import { MarketplaceMobileHeader } from "../../components/MarketplaceMobileHeader";
import { ChevronDown, Search as SearchIcon, SlidersHorizontal } from "lucide-react";

function normalizeListingStatus(status?: string): string {
  return String(status || "")
    .trim()
    .toUpperCase();
}

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

function relativeTimeShort(iso?: string): string {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms) || ms < 0) return "";
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const d = Math.floor(hr / 24);
  if (d < 30) return `${d}d`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo`;
  return `${Math.floor(mo / 12)}y`;
}

export type ListingItem = {
  id: string;
  price?: string;
  title?: string | null;
  subtitle?: string | null;
  description?: string | null;
  category?: string | null;
  condition?: string | null;
  watchlistCount?: number;
  seller?: string;
  imageUrl?: string | null;
  mediaUrls?: string[];
  city?: string | null;
  createdAt?: string;
  status?: string;
  onChainConfirmed?: boolean;
  requireEscrow?: boolean | null;
  itemType: "listing";
};

export default function MarketplacePageClient({
  initialItems,
  initialError,
}: {
  initialItems: ListingItem[];
  initialError: string | null;
}) {
  const { isConnected } = useHashpackWallet();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchInput, setSearchInput] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // "F" focuses the top-bar search (unless the user is already typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "f" || e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (document.activeElement?.tagName ?? "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      e.preventDefault();
      searchInputRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const [filterMinPrice, setFilterMinPrice] = useState("");
  const [filterMaxPrice, setFilterMaxPrice] = useState("");
  const [filterPostedWithin, setFilterPostedWithin] = useState("");
  const [filterCondition, setFilterCondition] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const query = searchParams.get("q")?.trim() ?? "";
  const categoryQuery = canonicalizeCategory(searchParams.get("category")?.trim() ?? "");
  const minPriceQuery = searchParams.get("minPrice")?.trim() ?? "";
  const maxPriceQuery = searchParams.get("maxPrice")?.trim() ?? "";
  const postedWithinQuery = searchParams.get("postedWithin")?.trim() ?? "";
  const conditionQuery = searchParams.get("condition")?.trim() ?? "";
  const locationQuery = searchParams.get("location")?.trim() ?? "";
  const viewMode: ViewMode = parseViewMode(searchParams.get("view"));
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
  const [listingsError, setListingsError] = useState<string | null>(initialError);
  useEffect(() => {
    if (initialItems.length > 0) return;
    let cancelled = false;
    fetch(`${getApiUrl()}/api/listings`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data: { listings?: ListingItem[] }) => {
        if (cancelled) return;
        const list = (data.listings ?? []).map((l) => ({
          ...l,
          itemType: "listing" as const,
        }));
        if (list.length > 0) {
          setItems(list);
          setListingsError(null);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const usdRate = useHbarUsd();
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

  const setParam = (key: string, value: string | null) => {
    const p = new URLSearchParams(searchParams.toString());
    if (value && value !== "") p.set(key, value);
    else p.delete(key);
    const qs = p.toString();
    router.push(qs ? `/marketplace?${qs}` : "/marketplace");
  };

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
      } else {
        const catFuse = new Fuse(typeMatched, {
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
        const fuse = new Fuse(categoryMatched, {
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

    const minPrice = minPriceQuery !== "" ? Number(minPriceQuery) : null;
    const maxPrice = maxPriceQuery !== "" ? Number(maxPriceQuery) : null;
    const min = minPrice != null && !Number.isNaN(minPrice) ? minPrice : null;
    const max = maxPrice != null && !Number.isNaN(maxPrice) ? maxPrice : null;
    const postedDays = parsePostedWithinDays(postedWithinQuery);
    const now = Date.now();
    const maxAgeMs = postedDays ? postedDays * 24 * 60 * 60 * 1000 : null;

    const filtered = queryMatched.filter((item) => {
      const hbar = Number(formatPriceForDisplay(item.price || "0"));
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
      const n = Number(formatPriceForDisplay(i.price || "0"));
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
  ]);

  // Desktop header chrome is hoisted into the global top bar via portals.
  // Below `sm`, the marketplace page renders its own header and search row.
  const headerCluster = (
    <div className="flex items-center gap-2">
      <span className="text-base font-semibold tracking-tight text-white">Marketplace</span>
      {isConnected ? (
        <span className="inline-flex items-center gap-1 h-5 px-2 text-[10px] font-medium border border-[#00ffa3]/40 bg-[#00ffa3]/10 text-[#00ffa3] shadow-[0_0_8px_rgba(0,255,163,0.2)]">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#00ffa3] shadow-[0_0_4px_rgba(0,255,163,0.8)]" />
          Authenticated
        </span>
      ) : (
        <StatusBadge status="error" className="h-5 px-2 text-[10px]">
          Connect
        </StatusBadge>
      )}
    </div>
  );

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

  const openFilterPanel = () => {
    setFilterOpen((o) => !o);
    setFilterMinPrice(minPriceQuery);
    setFilterMaxPrice(maxPriceQuery);
    setFilterPostedWithin(postedWithinQuery);
    setFilterCondition(conditionQuery);
    setFilterLocation(locationQuery);
  };

  const hasActiveFilter = !!(
    minPriceQuery ||
    maxPriceQuery ||
    postedWithinQuery ||
    conditionQuery ||
    locationQuery ||
    sortMode !== "recent"
  );

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

  const renderFilterSortPanel = (browse: boolean) => (
    <MarketplaceFilterPanel
      browse={browse}
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
      onCategory={(category) => router.push(marketplaceHref(withCategory(searchParams, category)))}
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

  // Top-bar search — rectangular rounded "Find…" field with an F shortcut
  // hint, hosted in the global top bar's center slot next to the logo/nav.
  const topBarSearch = (
    <div className="relative">
      <form onSubmit={submitSearch}>
        <div className="flex w-80 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] py-1 pl-3 pr-1 transition-colors duration-300 focus-within:border-[#00ffa3]/40">
          <SearchIcon size={14} className="shrink-0 text-silver" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Find..."
            className="flex-1 bg-transparent text-sm text-white placeholder:text-silver/50 focus:outline-none"
          />
          <button
            type="button"
            onClick={openFilterPanel}
            aria-label="Filters & sort"
            className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors duration-300 ${
              filterOpen || hasActiveFilter
                ? "bg-[#00ffa3]/10 text-[#00ffa3]"
                : "text-silver hover:bg-white/10 hover:text-white"
            }`}
          >
            <SlidersHorizontal size={14} />
          </button>
        </div>
      </form>
      {filterOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-white/10 bg-[#0a0a0a] p-4 shadow-2xl">
          {renderFilterSortPanel(false)}
        </div>
      )}
    </div>
  );

  const actionsCluster = (
    <Link href="/create" className="text-sm text-chrome hover:text-white font-medium">
      Create Listing
    </Link>
  );

  // View-mode dropdown (Editorial / Feed / Grid) — triggered by a carat next
  // to the section title, replacing the old pill row.
  const viewDropdown = (
    <div className="relative">
      <button
        type="button"
        onClick={() => setViewMenuOpen((o) => !o)}
        aria-label="Change view"
        aria-expanded={viewMenuOpen}
        className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-silver transition-colors duration-300 hover:bg-white/5 hover:text-white"
      >
        {viewMode === "editorial" ? "Editorial" : viewMode === "feed" ? "Feed" : "Grid"}
        <ChevronDown
          size={13}
          className={`transition-transform duration-300 ${viewMenuOpen ? "rotate-180" : ""}`}
        />
      </button>
      {viewMenuOpen && (
        <div className="absolute left-0 top-full z-50 mt-1 w-36 rounded-xl border border-white/10 bg-[#0a0a0a] p-1.5 shadow-2xl">
          {(
            [
              { id: "editorial", label: "Editorial" },
              { id: "feed", label: "Feed" },
              { id: "grid", label: "Grid" },
            ] as { id: ViewMode; label: string }[]
          ).map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => {
                setViewMenuOpen(false);
                setParam("view", viewModeQueryValue(v.id));
              }}
              className={`block w-full rounded-lg px-3 py-1.5 text-left text-xs transition-colors duration-300 ${
                viewMode === v.id ? "bg-[#00ffa3]/10 text-[#00ffa3]" : "text-white hover:bg-white/5"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <main className="min-h-screen">
      <TopBarSlot name="title">{headerCluster}</TopBarSlot>
      <TopBarSlot name="center">
        <div className="hidden md:block">{topBarSearch}</div>
      </TopBarSlot>
      <TopBarSlot name="actions">{actionsCluster}</TopBarSlot>
      <div className="px-3 py-4 sm:px-4">
        <MarketplaceMobileHeader
          searchValue={searchInput}
          onSearchChange={setSearchInput}
          onSearchSubmit={submitSearch}
          filterOpen={filterOpen}
          onOpenFilters={openFilterPanel}
          onCloseFilters={() => setFilterOpen(false)}
          filterSheet={renderFilterSortPanel(true)}
        />

        {(() => {
          const removeFilter = (keys: string[]) => {
            const p = new URLSearchParams(searchParams.toString());
            keys.forEach((k) => p.delete(k));
            const qs = p.toString();
            router.push(qs ? `/marketplace?${qs}` : "/marketplace");
          };

          const pills: { label: string; keys: string[] }[] = [];
          if (query) pills.push({ label: `"${query}"`, keys: ["q"] });
          if (categoryQuery) pills.push({ label: categoryQuery, keys: ["category"] });
          if (minPriceQuery && maxPriceQuery)
            pills.push({
              label: `${minPriceQuery}–${maxPriceQuery} HBAR`,
              keys: ["minPrice", "maxPrice"],
            });
          else if (minPriceQuery)
            pills.push({ label: `\u2265 ${minPriceQuery} HBAR`, keys: ["minPrice"] });
          else if (maxPriceQuery)
            pills.push({ label: `\u2264 ${maxPriceQuery} HBAR`, keys: ["maxPrice"] });
          if (postedWithinQuery) {
            const labelMap: Record<string, string> = {
              "1d": "Last day",
              "1w": "Last week",
              "1m": "Last month",
              "3m": "Last 3 months",
              "6m": "Last 6 months",
              "1y": "Last year",
              "2y": "Last 2 years",
            };
            pills.push({
              label: labelMap[postedWithinQuery] ?? postedWithinQuery,
              keys: ["postedWithin"],
            });
          }
          if (conditionQuery) pills.push({ label: conditionQuery, keys: ["condition"] });
          if (locationQuery) pills.push({ label: `📍 ${locationQuery}`, keys: ["location"] });

          if (!pills.length) return null;
          return (
            <div className="mb-6 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold tracking-widest text-silver uppercase">
                  Active Filters{" "}
                  <span className="text-[#00ffa3]">
                    · {filteredItems.length} Result{filteredItems.length !== 1 ? "s" : ""}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => router.push("/marketplace")}
                  className="text-sm text-silver hover:text-white transition-colors"
                >
                  Clear all
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {pills.map(({ label, keys }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => removeFilter(keys)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#00ffa3]/60 bg-[#00ffa3]/10 px-3 py-1 text-sm text-[#00ffa3] hover:bg-[#00ffa3]/20 transition-colors"
                  >
                    {label}
                    <span aria-hidden className="text-[#00ffa3]/70 text-base leading-none">
                      ×
                    </span>
                  </button>
                ))}
              </div>
            </div>
          );
        })()}
        {listingsError ? (
          <p className="text-amber-400/90 text-sm">
            {listingsError} Ensure the backend is running and PostgreSQL is up (e.g.{" "}
            <code className="text-chrome">docker compose up -d db</code>).
          </p>
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
            {/* Mobile 2-up: media-first tiles, 10px gap. */}
            <div className="grid grid-cols-2 gap-2.5 sm:hidden">
              {filteredItems.map((item) => (
                <ListingCard
                  key={`${item.itemType}-${item.id}`}
                  item={item}
                  density="compact"
                  variant="softTrust"
                />
              ))}
            </div>
            {viewMode !== "editorial" && (
              <div className="hidden sm:flex items-center gap-2 mb-3">
                <h3 className="text-lg font-bold tracking-tight text-white">Recently listed</h3>
                {viewDropdown}
                <span className="ml-1 text-xs text-silver/60">
                  {filteredItems.length.toLocaleString()} result
                  {filteredItems.length === 1 ? "" : "s"}
                </span>
              </div>
            )}

            {viewMode === "grid" && (
              <div className="hidden gap-4 sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {filteredItems.map((item) => (
                  <ListingCard
                    key={`${item.itemType}-${item.id}`}
                    item={item}
                    density="regular"
                    variant="softTrust"
                  />
                ))}
              </div>
            )}

            {viewMode === "feed" && (
              <div
                className={cn(
                  material.regular,
                  "hidden divide-y divide-hairline rounded-[16px] sm:block",
                )}
              >
                {filteredItems.map((item) => {
                  return (
                    <Link
                      key={`${item.itemType}-${item.id}`}
                      href={listingHref(item.id)}
                      className="grid grid-cols-[88px_minmax(0,1fr)_140px_120px] gap-4 items-center px-4 py-3 hover:bg-white/[0.03] transition-colors"
                    >
                      <div className="relative h-[88px] w-[88px] overflow-hidden rounded-lg bg-white/5">
                        <ListingMedia
                          listing={{
                            imageUrl: item.imageUrl,
                            mediaUrls: item.mediaUrls?.slice(0, 1) ?? null,
                          }}
                          className="w-full"
                          aspectRatio="square"
                          cardSize
                          compactHeight="88px"
                        />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-white truncate">
                          {item.title || formatListingId(item.id) || "Untitled"}
                        </h3>
                        <div className="mt-1 flex items-center gap-3 text-[11px] text-silver/70 flex-wrap">
                          {item.category && (
                            <span className="rounded-full bg-white/5 px-2 py-0.5 text-silver/80">
                              {item.category}
                            </span>
                          )}
                          {item.condition && (
                            <span className="text-silver/60">{item.condition}</span>
                          )}
                          {item.seller && (
                            <TrustStrip
                              density="inline"
                              address={item.seller}
                              linkToProfile={false}
                            />
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="text-base font-bold text-chrome">
                          {formatHbarWithUsd(formatPriceForDisplay(item.price || "0"), usdRate)}
                        </div>
                      </div>
                      <div className="text-right text-[11px] text-silver/70 leading-relaxed">
                        {item.createdAt && (
                          <div>Listed {relativeTimeShort(item.createdAt)} ago</div>
                        )}
                        {(item.watchlistCount ?? 0) > 0 && (
                          <div className="text-silver/50">♡ {item.watchlistCount} watching</div>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}

            {viewMode === "editorial" && (
              <div className="hidden sm:block space-y-6">
                {(() => {
                  const hero =
                    filteredItems.find((i) => normalizeListingStatus(i.status) === "LISTED") ||
                    filteredItems[0];
                  const rest = filteredItems.filter((i) => i.id !== hero?.id);
                  return (
                    <>
                      {hero && (
                        <Link
                          href={listingHref(hero.id)}
                          className="group relative block overflow-hidden rounded-[20px] border border-hairline"
                        >
                          <div className="relative h-[280px] sm:h-[320px] bg-gradient-to-br from-[#1b2940] to-[#0b111b]">
                            <ListingMedia
                              listing={hero}
                              className="absolute inset-0 w-full h-full"
                              aspectRatio="video"
                              slideshow="auto"
                              cardSize
                              compactHeight="320px"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                          </div>
                          <div className="absolute left-6 top-6">
                            <span className="rounded-full bg-chrome px-3 py-1 text-[10px] font-bold text-on-chrome">
                              Editor&apos;s pick
                            </span>
                          </div>
                          <div className="absolute left-6 right-6 bottom-6 max-w-2xl">
                            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                              {hero.title || formatListingId(hero.id) || "Featured listing"}
                            </h2>
                            {hero.subtitle && (
                              <p className="mt-2 text-sm text-white/75 line-clamp-2">
                                {hero.subtitle}
                              </p>
                            )}
                            <div className="mt-4 flex items-center gap-3 flex-wrap">
                              <span className={cn(listingCta.filled, "w-auto px-5")}>
                                Buy for{" "}
                                {formatHbarWithUsd(
                                  formatPriceForDisplay(hero.price || "0"),
                                  usdRate,
                                )}
                              </span>
                              {hero.seller && (
                                <span className="text-xs font-mono text-white/60">
                                  Seller {formatSellerDisplay(hero.seller)}
                                </span>
                              )}
                            </div>
                          </div>
                        </Link>
                      )}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-bold tracking-tight">Recently listed</h3>
                            {viewDropdown}
                          </div>
                          <span className="text-xs text-silver/60">
                            {rest.length.toLocaleString()} more
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                          {rest.map((item) => (
                            <ListingCard
                              key={`${item.itemType}-${item.id}`}
                              item={item}
                              density="regular"
                              variant="softTrust"
                            />
                          ))}
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
