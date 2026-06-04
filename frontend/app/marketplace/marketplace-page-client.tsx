"use client";
import { listingHref } from "../../lib/listingUrl";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Fuse from "fuse.js";
import { ListingMedia } from "../../components/ListingMedia";
import { WishlistButton } from "../../components/WishlistButton";
import { StatusBadge } from "../../components/ui/status-badge-beautiful-accessible-status-indicators";
import { formatPriceForDisplay } from "../../lib/formatPrice";
import { formatHbarWithUsd } from "../../lib/hbarUsd";
import { useHbarUsd } from "../../hooks/useHbarUsd";
import { canonicalizeCategory } from "../../lib/categories";
import { useHashpackWallet } from "../../lib/hashpackWallet";
import { useProfile, useProfiles } from "../../lib/profiles";
import { TopBarSlot } from "../../lib/topBar";
import { BadgeCheck } from "lucide-react";

function formatListingId(id: string): string {
  if (!id || !id.startsWith("0x") || id.length !== 66) return id;
  try {
    const hex = id.slice(2).replace(/0+$/, "");
    if (hex.length % 2) return id;
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
    const str = new TextDecoder().decode(bytes);
    return /^[\x20-\x7e]+$/.test(str) ? str : `${id.slice(0, 10)}…`;
  } catch {
    return `${id.slice(0, 10)}…`;
  }
}

function normalizeListingStatus(status?: string): string {
  return String(status || "")
    .trim()
    .toUpperCase();
}

function getStatusBadge(
  status?: string,
  onChainConfirmed?: boolean,
): { label: string; className: string; pulseDot?: boolean } {
  const normalized = normalizeListingStatus(status);
  if (normalized === "LISTED") {
    if (onChainConfirmed === false) {
      return {
        label: "PENDING",
        className: "bg-amber-400 border-amber-300 text-black",
      };
    }
    return {
      label: "ACTIVE",
      className: "bg-[#00ffa3] border-[#00ffa3] text-black",
      pulseDot: true,
    };
  }
  if (normalized === "LOCKED") {
    return {
      label: "LOCKED",
      className: "bg-orange-400 border-orange-300 text-black",
    };
  }
  if (normalized === "CANCELLED") {
    return {
      label: "CANCELLED",
      className: "bg-zinc-600 border-zinc-500 text-white",
    };
  }
  return {
    label: "SOLD",
    className: "bg-rose-500 border-rose-400 text-white",
  };
}

function formatSellerDisplay(seller?: string): string {
  if (!seller) return "";
  if (/^\d+\.\d+\.\d+$/.test(seller)) return seller;
  if (seller.startsWith("0x") && seller.length > 12)
    return `${seller.slice(0, 6)}…${seller.slice(-4)}`;
  return seller;
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

type ViewMode = "grid" | "feed" | "editorial";
type SortMode = "recent" | "price-asc" | "price-desc" | "trending";

function parseViewMode(value: string | null): ViewMode {
  if (value === "feed" || value === "editorial") return value;
  return "grid";
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

/** Seller identity line: avatar + display name (or wallet) + verified badge. */
function SellerInline({ seller, size = 16 }: { seller?: string; size?: number }) {
  const profile = useProfile(seller);
  if (!seller) return null;
  const name = profile?.displayName?.trim();
  return (
    <span className="mt-1 flex items-center gap-1 truncate">
      {profile?.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={profile.avatarUrl}
          alt=""
          className="shrink-0 rounded-full object-cover"
          style={{ width: size, height: size }}
        />
      ) : null}
      {name ? (
        <span className="truncate text-silver/70">{name}</span>
      ) : (
        <span className="truncate font-mono text-silver/50">{formatSellerDisplay(seller)}</span>
      )}
      {profile?.kycVerified && (
        <BadgeCheck size={12} className="shrink-0 text-[#00ffa3]" aria-label="KYC verified" />
      )}
    </span>
  );
}

/** Compact star-rating pill; renders nothing when the seller has no ratings. */
function SellerRating({ seller, className }: { seller?: string; className?: string }) {
  const profile = useProfile(seller);
  if (!profile || profile.ratingCount === 0 || profile.ratingAverage == null) return null;
  return (
    <span className={className ?? "flex items-center gap-0.5 text-[10px] text-amber-300/90"}>
      ★ {profile.ratingAverage.toFixed(1)}
      <span className="text-silver/50">({profile.ratingCount})</span>
    </span>
  );
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
  createdAt?: string;
  status?: string;
  onChainConfirmed?: boolean;
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
  const [filterMinPrice, setFilterMinPrice] = useState("");
  const [filterMaxPrice, setFilterMaxPrice] = useState("");
  const [filterPostedWithin, setFilterPostedWithin] = useState("");
  const [filterCondition, setFilterCondition] = useState("");
  const query = searchParams.get("q")?.trim() ?? "";
  const categoryQuery = canonicalizeCategory(searchParams.get("category")?.trim() ?? "");
  const minPriceQuery = searchParams.get("minPrice")?.trim() ?? "";
  const maxPriceQuery = searchParams.get("maxPrice")?.trim() ?? "";
  const postedWithinQuery = searchParams.get("postedWithin")?.trim() ?? "";
  const conditionQuery = searchParams.get("condition")?.trim() ?? "";
  const viewMode: ViewMode = parseViewMode(searchParams.get("view"));
  const sortMode: SortMode = parseSortMode(searchParams.get("sort"));
  const items = initialItems;
  const listingsError = initialError;
  const usdRate = useHbarUsd();
  // Warm the profile cache for every seller in one batched request so cards
  // can render display names, avatars and ratings without per-card fetches.
  useProfiles(items.map((i) => i.seller));

  const setParam = (key: string, value: string | null) => {
    const p = new URLSearchParams(searchParams.toString());
    if (value && value !== "") p.set(key, value);
    else p.delete(key);
    const qs = p.toString();
    router.push(qs ? `/marketplace?${qs}` : "/marketplace");
  };

  const filteredItems = useMemo(() => {
    let categoryMatched = items;
    if (categoryQuery) {
      const normalizedCategory = categoryQuery.toLowerCase();
      const strict = items.filter(
        (item) => canonicalizeCategory(item.category ?? "").toLowerCase() === normalizedCategory,
      );
      if (strict.length > 0) {
        categoryMatched = strict;
      } else {
        const catFuse = new Fuse(items, {
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
        (a, b) =>
          new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
      );
    return sorted;
  }, [
    items,
    query,
    categoryQuery,
    minPriceQuery,
    maxPriceQuery,
    postedWithinQuery,
    conditionQuery,
    sortMode,
  ]);

  // Header chrome is hoisted into the global top bar via portals so the page
  // body holds only content. Title, search-with-filters, and the Create
  // Listing CTA each live in their own named slot. On mobile the slots
  // aren't rendered (no DesktopShell), so the search-with-filter block is
  // duplicated below as a fallback header inside the page body.
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

  const searchCluster = (
    <div className="relative flex w-full max-w-md justify-center">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const q = searchInput.trim();
          const p = new URLSearchParams(searchParams.toString());
          if (q) p.set("q", q);
          else p.delete("q");
          router.push(p.toString() ? `/marketplace?${p.toString()}` : "/marketplace");
          setSearchInput("");
          setFilterOpen(false);
        }}
      >
        <div className="flex items-center gap-1.5 rounded-full border border-[#00ffa3]/50 bg-[#00ffa3]/[0.08] px-3 py-1.5 shadow-[0_0_14px_rgba(0,255,163,0.12),inset_0_0_8px_rgba(0,255,163,0.04)]">
          <svg
            className="h-3.5 w-3.5 shrink-0 text-[#00ffa3]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-4.35-4.35M16 10.5A5.5 5.5 0 115 10.5a5.5 5.5 0 0111 0z"
            />
          </svg>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search listings…"
            className="w-36 bg-transparent text-sm text-white placeholder:text-[#00ffa3]/40 focus:outline-none"
          />
          {/* Filter toggle — replaces the second X */}
          <button
            type="button"
            onClick={() => {
              setFilterOpen((o) => !o);
              setFilterMinPrice(minPriceQuery);
              setFilterMaxPrice(maxPriceQuery);
              setFilterPostedWithin(postedWithinQuery);
              setFilterCondition(conditionQuery);
            }}
            aria-label="Filters"
            className={`shrink-0 transition-colors ${filterOpen || minPriceQuery || maxPriceQuery || postedWithinQuery || conditionQuery ? "text-[#00ffa3]" : "text-[#00ffa3]/50 hover:text-[#00ffa3]"}`}
          >
            {/* sliders / funnel icon */}
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 4h18M7 12h10M11 20h2"
              />
            </svg>
          </button>
        </div>
      </form>
      {/* Filter dropdown */}
      {filterOpen && (
        <div className="absolute right-0 top-full mt-2 w-72 rounded-xl border border-white/10 bg-[#0a0a0a] shadow-2xl p-4 z-50">
          <p className="text-xs font-semibold tracking-widest text-silver uppercase mb-3">
            Filters
          </p>
          <div className="space-y-3">
            <div>
              <span className="text-xs text-silver/70 mb-1 block">Price (HBAR)</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={filterMinPrice}
                  onChange={(e) => setFilterMinPrice(e.target.value)}
                  placeholder="Min"
                  className="input-frost w-full text-sm py-1.5"
                />
                <span className="text-silver/40 text-xs shrink-0">to</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={filterMaxPrice}
                  onChange={(e) => setFilterMaxPrice(e.target.value)}
                  placeholder="Max"
                  className="input-frost w-full text-sm py-1.5"
                />
              </div>
            </div>
            <div>
              <span className="text-xs text-silver/70 mb-1 block">Date listed</span>
              <select
                value={filterPostedWithin}
                onChange={(e) => setFilterPostedWithin(e.target.value)}
                className="input-frost w-full text-sm py-1.5"
              >
                <option value="">Any time</option>
                <option value="1d">Last 24 hours</option>
                <option value="1w">Last week</option>
                <option value="1m">Last month</option>
                <option value="3m">Last 3 months</option>
                <option value="6m">Last 6 months</option>
                <option value="1y">Last year</option>
              </select>
            </div>
            <div>
              <span className="text-xs text-silver/70 mb-1 block">Condition</span>
              <select
                value={filterCondition}
                onChange={(e) => setFilterCondition(e.target.value)}
                className="input-frost w-full text-sm py-1.5"
              >
                <option value="">Any condition</option>
                <option value="Like new">Like new</option>
                <option value="Used">Used</option>
                <option value="Refurbished">Refurbished</option>
                <option value="For parts or repair">For parts or repair</option>
              </select>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  const p = new URLSearchParams(searchParams.toString());
                  p.delete("minPrice");
                  p.delete("maxPrice");
                  p.delete("postedWithin");
                  p.delete("condition");
                  setFilterOpen(false);
                  router.push(p.toString() ? `/marketplace?${p.toString()}` : "/marketplace");
                }}
                className="flex-1 text-xs text-silver hover:text-white border border-white/15 rounded-lg py-1.5 transition-colors"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => {
                  const p = new URLSearchParams(searchParams.toString());
                  if (filterMinPrice) p.set("minPrice", filterMinPrice);
                  else p.delete("minPrice");
                  if (filterMaxPrice) p.set("maxPrice", filterMaxPrice);
                  else p.delete("maxPrice");
                  if (filterPostedWithin) p.set("postedWithin", filterPostedWithin);
                  else p.delete("postedWithin");
                  if (filterCondition) p.set("condition", filterCondition);
                  else p.delete("condition");
                  setFilterOpen(false);
                  router.push(p.toString() ? `/marketplace?${p.toString()}` : "/marketplace");
                }}
                className="flex-1 text-xs btn-frost-cta py-1.5"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const actionsCluster = (
    <Link href="/create" className="text-sm text-chrome hover:text-white font-medium">
      Create Listing
    </Link>
  );

  return (
    <main className="min-h-screen">
      <TopBarSlot name="title">{headerCluster}</TopBarSlot>
      <TopBarSlot name="center">{searchCluster}</TopBarSlot>
      <TopBarSlot name="actions">{actionsCluster}</TopBarSlot>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
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
            <div className="sm:hidden space-y-3">
              {filteredItems.map((item) => (
                <Link
                  key={`${item.itemType}-${item.id}`}
                  href={listingHref(item.id)}
                  className="block glass-card overflow-hidden transition-all duration-200 active:border-white/20"
                >
                  <div className="relative bg-white/5">
                    <ListingMedia
                      listing={item}
                      className="w-full"
                      aspectRatio="square"
                      navigation="arrows"
                      cardSize
                      compactHeight="160px"
                    />
                    <span
                      className={`absolute top-2 left-2 rounded-full inline-flex items-center gap-1.5 border px-2 py-0.5 text-[10px] font-semibold ${getStatusBadge(item.status, item.onChainConfirmed).className}`}
                    >
                      {getStatusBadge(item.status, item.onChainConfirmed).pulseDot ? (
                        <span className="inline-flex h-2 w-2 rounded-full bg-green-400 animate-pulse shadow-[0_0_0_0_rgba(74,222,128,0.7)]" />
                      ) : null}
                      {getStatusBadge(item.status, item.onChainConfirmed).label}
                    </span>
                  </div>
                  <div className="p-3">
                    <h2 className="text-sm font-semibold text-white line-clamp-2 leading-tight">
                      {item.title || formatListingId(item.id) || "Untitled"}
                    </h2>
                    {item.category && (
                      <span className="mt-1 inline-flex rounded-full bg-white/5 px-2 py-0.5 text-[9px] text-silver/80">
                        {canonicalizeCategory(item.category)}
                      </span>
                    )}
                    {item.seller && (
                      <div className="text-[10px]">
                        <SellerInline seller={item.seller} size={14} />
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-1.5">
                      <p className="text-chrome font-semibold">
                        {formatHbarWithUsd(formatPriceForDisplay(item.price || "0"), usdRate)}
                      </p>
                      <div className="flex items-center gap-2">
                        <SellerRating seller={item.seller} />
                        {(item.watchlistCount ?? 0) > 0 && (
                          <span className="text-[10px] text-silver/50 flex items-center gap-0.5">
                            ♡ {item.watchlistCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            <div className="hidden sm:flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                {(
                  [
                    { id: "grid", label: "Grid" },
                    { id: "feed", label: "Feed" },
                    { id: "editorial", label: "Editorial" },
                  ] as { id: ViewMode; label: string }[]
                ).map((v) => {
                  const active = viewMode === v.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setParam("view", v.id === "grid" ? null : v.id)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors border ${
                        active
                          ? "border-[#00ffa3]/40 bg-[#00ffa3]/10 text-[#00ffa3]"
                          : "border-white/10 text-silver hover:text-white hover:border-white/20"
                      }`}
                    >
                      {v.label}
                    </button>
                  );
                })}
                <span className="text-xs text-silver/60 ml-2">
                  {filteredItems.length.toLocaleString()} result
                  {filteredItems.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-widest text-silver/60">
                  Sort
                </span>
                {(
                  [
                    { id: "recent", label: "Recent" },
                    { id: "price-asc", label: "Price ↑" },
                    { id: "price-desc", label: "Price ↓" },
                    { id: "trending", label: "Trending" },
                  ] as { id: SortMode; label: string }[]
                ).map((s) => {
                  const active = sortMode === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setParam("sort", s.id === "recent" ? null : s.id)}
                      className={`rounded-full px-3 py-1 text-xs transition-colors border ${
                        active
                          ? "border-[#00ffa3]/40 bg-[#00ffa3]/10 text-[#00ffa3]"
                          : "border-white/10 text-silver hover:text-white hover:border-white/20"
                      }`}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {viewMode === "grid" && (
              <div className="hidden sm:grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredItems.map((item) => (
                  <Link
                    key={`${item.itemType}-${item.id}`}
                    href={listingHref(item.id)}
                    className="glass-card overflow-hidden transition-all duration-200 hover:border-white/20 hover:shadow-glow"
                  >
                    <div className="relative bg-white/5">
                      <ListingMedia
                        listing={item}
                        className="w-full"
                        aspectRatio="square"
                        slideshow="hover"
                        cardSize
                        compactHeight="220px"
                      />
                      <div className="absolute top-2 right-2">
                        <WishlistButton itemId={item.id} itemType={item.itemType} compact />
                      </div>
                      <span
                        className={`absolute top-2 left-2 rounded-full inline-flex items-center gap-1.5 border px-2 py-0.5 text-[10px] font-semibold ${getStatusBadge(item.status, item.onChainConfirmed).className}`}
                      >
                        {getStatusBadge(item.status, item.onChainConfirmed).pulseDot ? (
                          <span className="inline-flex h-2 w-2 rounded-full bg-green-400 animate-pulse shadow-[0_0_0_0_rgba(74,222,128,0.7)]" />
                        ) : null}
                        {getStatusBadge(item.status, item.onChainConfirmed).label}
                      </span>
                    </div>
                    <div className="p-4">
                      <h2 className="text-base font-semibold text-white line-clamp-2 leading-snug">
                        {item.title || formatListingId(item.id) || "Untitled"}
                      </h2>
                      {item.category && (
                        <span className="mt-1.5 inline-flex rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-silver/80">
                          {canonicalizeCategory(item.category)}
                        </span>
                      )}
                      {item.seller && (
                        <div className="text-[11px]">
                          <SellerInline seller={item.seller} />
                        </div>
                      )}
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-chrome font-semibold text-lg">
                          {formatHbarWithUsd(formatPriceForDisplay(item.price || "0"), usdRate)}
                        </p>
                        <div className="flex items-center gap-2">
                          <SellerRating seller={item.seller} className="flex items-center gap-0.5 text-xs text-amber-300/90" />
                          {(item.watchlistCount ?? 0) > 0 && (
                            <span className="text-xs text-silver/50 flex items-center gap-1">
                              ♡ {item.watchlistCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {viewMode === "feed" && (
              <div className="hidden sm:block divide-y divide-white/5 rounded-xl border border-white/10 bg-white/[0.02]">
                {filteredItems.map((item) => {
                  const badge = getStatusBadge(item.status, item.onChainConfirmed);
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
                          {item.seller && <SellerInline seller={item.seller} size={14} />}
                          <SellerRating seller={item.seller} />
                          <span
                            className={`rounded-full inline-flex items-center gap-1.5 border px-2 py-0.5 text-[9px] font-semibold ${badge.className}`}
                          >
                            {badge.pulseDot ? (
                              <span className="inline-flex h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                            ) : null}
                            {badge.label}
                          </span>
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
                          <div className="text-silver/50">
                            ♡ {item.watchlistCount} watching
                          </div>
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
                    filteredItems.find(
                      (i) => normalizeListingStatus(i.status) === "LISTED",
                    ) || filteredItems[0];
                  const rest = filteredItems.filter((i) => i.id !== hero?.id);
                  return (
                    <>
                      {hero && (
                        <Link
                          href={listingHref(hero.id)}
                          className="block relative overflow-hidden rounded-2xl border border-white/10 group"
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
                            <span className="rounded-full bg-[#00ffa3] text-black text-[10px] font-bold tracking-widest px-3 py-1">
                              EDITOR&apos;S PICK
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
                              <span className="rounded-glass btn-frost-cta px-4 py-2 text-sm">
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
                        <div className="flex items-baseline justify-between mb-3">
                          <h3 className="text-lg font-bold tracking-tight">Recently listed</h3>
                          <span className="text-xs text-silver/60">
                            {rest.length.toLocaleString()} more
                          </span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 auto-rows-[120px]">
                          {rest.map((item, i) => {
                            const tall = i % 5 === 1 || i % 5 === 4;
                            const badge = getStatusBadge(item.status, item.onChainConfirmed);
                            return (
                              <Link
                                key={`${item.itemType}-${item.id}`}
                                href={listingHref(item.id)}
                                className={`relative block overflow-hidden rounded-xl border border-white/10 group ${
                                  tall ? "row-span-2" : ""
                                }`}
                                style={{ minHeight: tall ? 256 : 120 }}
                              >
                                <ListingMedia
                                  listing={item}
                                  className="absolute inset-0 w-full h-full"
                                  aspectRatio="square"
                                  slideshow="auto"
                                  cardSize
                                  compactHeight={tall ? "256px" : "120px"}
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                                <span
                                  className={`absolute top-2 left-2 rounded-full inline-flex items-center gap-1.5 border px-2 py-0.5 text-[9px] font-semibold ${badge.className}`}
                                >
                                  {badge.pulseDot ? (
                                    <span className="inline-flex h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                                  ) : null}
                                  {badge.label}
                                </span>
                                <div className="absolute left-3 right-3 bottom-2 text-white">
                                  <div className="text-xs font-semibold line-clamp-1">
                                    {item.title || formatListingId(item.id) || "Untitled"}
                                  </div>
                                  <div className="flex items-baseline justify-between mt-0.5">
                                    <span className="text-sm font-bold text-chrome">
                                      {formatHbarWithUsd(
                                        formatPriceForDisplay(item.price || "0"),
                                        usdRate,
                                      )}
                                    </span>
                                  </div>
                                </div>
                              </Link>
                            );
                          })}
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
