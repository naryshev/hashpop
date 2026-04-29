"use client";

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
import { AddressDisplay } from "../../components/AddressDisplay";

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
  const { isConnected, address } = useHashpackWallet();
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
  const items = initialItems;
  const listingsError = initialError;
  const usdRate = useHbarUsd();

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
        [item.title, item.subtitle, item.description, item.category]
          .some((f) => f?.toLowerCase().includes(q)),
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

    return queryMatched.filter((item) => {
      const hbar = Number(formatPriceForDisplay(item.price || "0"));
      if (min != null && (Number.isNaN(hbar) || hbar < min)) return false;
      if (max != null && (Number.isNaN(hbar) || hbar > max)) return false;
      if (maxAgeMs != null) {
        const createdMs = new Date(item.createdAt || 0).getTime();
        if (!createdMs || Number.isNaN(createdMs)) return false;
        if (now - createdMs > maxAgeMs) return false;
      }
      if (conditionQuery && item.condition?.toLowerCase() !== conditionQuery.toLowerCase()) return false;
      return true;
    });
  }, [items, query, categoryQuery, minPriceQuery, maxPriceQuery, postedWithinQuery, conditionQuery]);

  return (
    <main className="min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-white">Marketplace</h1>
            {isConnected ? (
              <span className="inline-flex items-center gap-1 h-6 px-2.5 text-[11px] font-medium border border-[#00ffa3]/40 bg-[#00ffa3]/10 text-[#00ffa3] shadow-[0_0_8px_rgba(0,255,163,0.2)]">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#00ffa3] shadow-[0_0_4px_rgba(0,255,163,0.8)]" />
                Authenticated
              </span>
            ) : (
              <StatusBadge status="error" className="h-6 px-2.5 text-[11px]">
                Connect
              </StatusBadge>
            )}
          </div>
          <div className="flex items-center gap-3">
            {/* Desktop: always-visible inline search + filter dropdown */}
            <div className="hidden md:flex relative">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const q = searchInput.trim();
                  const p = new URLSearchParams(searchParams.toString());
                  if (q) p.set("q", q); else p.delete("q");
                  router.push(p.toString() ? `/marketplace?${p.toString()}` : "/marketplace");
                  setSearchInput("");
                  setFilterOpen(false);
                }}
              >
                <div className="flex items-center gap-1.5 rounded-full border border-[#00ffa3]/50 bg-[#00ffa3]/[0.08] px-3 py-1.5 shadow-[0_0_14px_rgba(0,255,163,0.12),inset_0_0_8px_rgba(0,255,163,0.04)]">
                  <svg className="h-3.5 w-3.5 shrink-0 text-[#00ffa3]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M16 10.5A5.5 5.5 0 115 10.5a5.5 5.5 0 0111 0z" />
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
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18M7 12h10M11 20h2" />
                    </svg>
                  </button>
                </div>
              </form>
              {/* Filter dropdown */}
              {filterOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 rounded-xl border border-white/10 bg-[#0a0a0a] shadow-2xl p-4 z-50">
                  <p className="text-xs font-semibold tracking-widest text-silver uppercase mb-3">Filters</p>
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
                          p.delete("minPrice"); p.delete("maxPrice");
                          p.delete("postedWithin"); p.delete("condition");
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
                          if (filterMinPrice) p.set("minPrice", filterMinPrice); else p.delete("minPrice");
                          if (filterMaxPrice) p.set("maxPrice", filterMaxPrice); else p.delete("maxPrice");
                          if (filterPostedWithin) p.set("postedWithin", filterPostedWithin); else p.delete("postedWithin");
                          if (filterCondition) p.set("condition", filterCondition); else p.delete("condition");
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
            <Link href="/create" className="text-sm text-chrome hover:text-white font-medium">
              Create Listing
            </Link>
          </div>
        </div>
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
            pills.push({ label: `${minPriceQuery}–${maxPriceQuery} HBAR`, keys: ["minPrice", "maxPrice"] });
          else if (minPriceQuery)
            pills.push({ label: `\u2265 ${minPriceQuery} HBAR`, keys: ["minPrice"] });
          else if (maxPriceQuery)
            pills.push({ label: `\u2264 ${maxPriceQuery} HBAR`, keys: ["maxPrice"] });
          if (postedWithinQuery) {
            const labelMap: Record<string, string> = {
              "1d": "Last day", "1w": "Last week", "1m": "Last month",
              "3m": "Last 3 months", "6m": "Last 6 months", "1y": "Last year", "2y": "Last 2 years",
            };
            pills.push({ label: labelMap[postedWithinQuery] ?? postedWithinQuery, keys: ["postedWithin"] });
          }
          if (conditionQuery) pills.push({ label: conditionQuery, keys: ["condition"] });

          if (!pills.length) return null;
          return (
            <div className="mb-6 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold tracking-widest text-silver uppercase">
                  Active Filters{" "}
                  <span className="text-[#00ffa3]">· {filteredItems.length} Result{filteredItems.length !== 1 ? "s" : ""}</span>
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
                    <span aria-hidden className="text-[#00ffa3]/70 text-base leading-none">×</span>
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
              {filteredItems.map((item) => {
                const isOwn = address && item.seller?.toLowerCase() === address.toLowerCase();
                return (
                <Link
                  key={`${item.itemType}-${item.id}`}
                  href={`/listing/${encodeURIComponent(item.id)}`}
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
                    {item.seller && (
                      <p className="text-silver/50 text-[10px] mt-1 font-mono truncate">
                        <AddressDisplay address={item.seller} showAvatar />
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-1.5">
                      <p className={`font-semibold ${isOwn ? "text-amber-400" : "text-chrome"}`}>
                        {formatHbarWithUsd(formatPriceForDisplay(item.price || "0"), usdRate)}
                      </p>
                      {(item.watchlistCount ?? 0) > 0 && (
                        <span className="text-[10px] text-silver/50 flex items-center gap-0.5">
                          ♡ {item.watchlistCount}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
                );
              })}
            </div>
            <div className="hidden sm:grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredItems.map((item) => {
                const isOwn = address && item.seller?.toLowerCase() === address.toLowerCase();
                return (
                <Link
                  key={`${item.itemType}-${item.id}`}
                  href={`/listing/${encodeURIComponent(item.id)}`}
                  className={`glass-card overflow-hidden transition-all duration-200 ${isOwn ? "hover:border-amber-400/50 hover:shadow-[0_0_22px_rgba(251,191,36,0.35)]" : "hover:border-white/20 hover:shadow-glow"}`}
                >
                  <div className="relative bg-white/5">
                    <ListingMedia
                      listing={item}
                      className="w-full"
                      aspectRatio="square"
                      navigation="arrows"
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
                    {item.seller && (
                      <p className="text-silver/50 text-[11px] mt-1 font-mono truncate">
                        <AddressDisplay address={item.seller} showAvatar />
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-chrome font-semibold text-lg">
                        {formatHbarWithUsd(formatPriceForDisplay(item.price || "0"), usdRate)}
                      </p>
                      {(item.watchlistCount ?? 0) > 0 && (
                        <span className="text-xs text-silver/50 flex items-center gap-1">
                          ♡ {item.watchlistCount}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
                );
              })}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
