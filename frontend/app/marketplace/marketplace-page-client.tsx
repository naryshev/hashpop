"use client";
import { listingHref } from "../../lib/listingUrl";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { useSignInModal } from "../../lib/signInModal";
import { profileAvatarUrl, profileDisplayName, useProfile, useProfiles } from "../../lib/profiles";
import { TopBarSlot } from "../../lib/topBar";
import {
  BadgeCheck,
  Bell,
  Car,
  ChevronDown,
  Footprints,
  Laptop,
  LayoutGrid,
  Palette,
  Search as SearchIcon,
  ShoppingCart,
  SlidersHorizontal,
  Smartphone,
  Sofa,
  Watch,
} from "lucide-react";
import { ProfileCardSheet } from "../../components/ProfileCardSheet";

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
  if (value === "feed" || value === "grid") return value;
  return "editorial";
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
  const name = profileDisplayName(profile);
  const avatar = profileAvatarUrl(profile);
  return (
    <span className="mt-1 flex items-center gap-1 truncate">
      {avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatar}
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
  city?: string | null;
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
  const { isConnected, address, accountId } = useHashpackWallet();
  const { openSignIn } = useSignInModal();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchInput, setSearchInput] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const [profileCardOpen, setProfileCardOpen] = useState(false);
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
  const items = initialItems;
  const listingsError = initialError;
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
      if (
        locationQuery &&
        (item.city ?? "").trim().toLowerCase() !== locationQuery.toLowerCase()
      )
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
    locationQuery,
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

  const hasActiveFilter =
    !!(minPriceQuery || maxPriceQuery || postedWithinQuery || conditionQuery || locationQuery || sortMode !== "recent");

  // Distinct cities present in the current listing set, used to populate the
  // location dropdown. Cap to 50 to keep the panel manageable.
  const knownCities = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) {
      const c = it.city?.trim();
      if (c) set.add(c);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b)).slice(0, 50);
  }, [items]);

  const renderFilterSortPanel = () => (
    <div className="absolute right-0 top-full mt-2 w-72 rounded-xl border border-white/10 bg-[#0a0a0a] p-4 shadow-2xl z-50">
      <p className="text-xs font-semibold uppercase tracking-widest text-silver">Sort</p>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        {(
          [
            { id: "recent", label: "Recent" },
            { id: "trending", label: "Trending" },
            { id: "price-asc", label: "Price ↑" },
            { id: "price-desc", label: "Price ↓" },
          ] as { id: SortMode; label: string }[]
        ).map((s) => {
          const active = sortMode === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setParam("sort", s.id === "recent" ? null : s.id)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                active
                  ? "border-[#00ffa3]/40 bg-[#00ffa3]/10 text-[#00ffa3]"
                  : "border-white/10 text-silver hover:border-white/20 hover:text-white"
              }`}
            >
              {s.label}
            </button>
          );
        })}
      </div>
      <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-silver">Filters</p>
      <div className="mt-2 space-y-3">
        <div>
          <span className="mb-1 block text-xs text-silver/70">Location</span>
          <select
            value={filterLocation}
            onChange={(e) => setFilterLocation(e.target.value)}
            className="input-frost w-full py-1.5 text-sm"
          >
            <option value="">All locations</option>
            {knownCities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <span className="mb-1 block text-xs text-silver/70">Price (HBAR)</span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              step="any"
              value={filterMinPrice}
              onChange={(e) => setFilterMinPrice(e.target.value)}
              placeholder="Min"
              className="input-frost w-full py-1.5 text-sm"
            />
            <span className="shrink-0 text-xs text-silver/40">to</span>
            <input
              type="number"
              min="0"
              step="any"
              value={filterMaxPrice}
              onChange={(e) => setFilterMaxPrice(e.target.value)}
              placeholder="Max"
              className="input-frost w-full py-1.5 text-sm"
            />
          </div>
        </div>
        <div>
          <span className="mb-1 block text-xs text-silver/70">Date listed</span>
          <select
            value={filterPostedWithin}
            onChange={(e) => setFilterPostedWithin(e.target.value)}
            className="input-frost w-full py-1.5 text-sm"
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
          <span className="mb-1 block text-xs text-silver/70">Condition</span>
          <select
            value={filterCondition}
            onChange={(e) => setFilterCondition(e.target.value)}
            className="input-frost w-full py-1.5 text-sm"
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
              p.delete("location");
              p.delete("sort");
              setFilterOpen(false);
              router.push(p.toString() ? `/marketplace?${p.toString()}` : "/marketplace");
            }}
            className="flex-1 rounded-lg border border-white/15 py-1.5 text-xs text-silver transition-colors hover:text-white"
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
              if (filterLocation) p.set("location", filterLocation);
              else p.delete("location");
              setFilterOpen(false);
              router.push(p.toString() ? `/marketplace?${p.toString()}` : "/marketplace");
            }}
            className="btn-frost-cta flex-1 py-1.5 text-xs"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );

  // Wallet chip shown top-left of the mobile header — account number only
  // (no avatar) with a carat that slides up the profile card sheet.
  const walletLabel = accountId ?? (address ? `${address.slice(0, 6)}…${address.slice(-4)}` : null);

  // Top-bar search — rectangular rounded "Find…" field with an F shortcut
  // hint, hosted in the global top bar's center slot next to the logo/nav.
  const topBarSearch = (
    <div className="flex items-center gap-2">
      <form onSubmit={submitSearch}>
        <div className="flex w-80 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-1.5 transition-colors duration-300 focus-within:border-[#00ffa3]/40">
          <SearchIcon size={14} className="shrink-0 text-silver" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Find..."
            className="flex-1 bg-transparent text-sm text-white placeholder:text-silver/50 focus:outline-none"
          />
          <kbd className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-silver/70">
            F
          </kbd>
        </div>
      </form>
      <div className="relative">
        <button
          type="button"
          onClick={openFilterPanel}
          aria-label="Filters & sort"
          className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-colors duration-300 ${
            filterOpen || hasActiveFilter
              ? "border-[#00ffa3]/50 bg-[#00ffa3]/10 text-[#00ffa3]"
              : "border-white/10 bg-white/5 text-silver hover:text-white"
          }`}
        >
          <SlidersHorizontal size={14} />
        </button>
        {filterOpen && renderFilterSortPanel()}
      </div>
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
                setParam("view", v.id === "editorial" ? null : v.id);
              }}
              className={`block w-full rounded-lg px-3 py-1.5 text-left text-xs transition-colors duration-300 ${
                viewMode === v.id
                  ? "bg-[#00ffa3]/10 text-[#00ffa3]"
                  : "text-white hover:bg-white/5"
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
        {/* Mobile-only top section: location chip, watchlist/alerts icons,
            inline search + filter button, and a horizontal category carousel
            matching the redesigned mobile marketplace. */}
        <div className="sm:hidden mb-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            {walletLabel ? (
              <button
                type="button"
                onClick={() => setProfileCardOpen(true)}
                aria-label="Open profile"
                className="-ml-2 flex items-center gap-1.5 rounded-full px-2 py-2 text-white"
              >
                <span className="font-mono text-sm font-semibold">{walletLabel}</span>
                <ChevronDown size={14} className="text-silver" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => openSignIn()}
                aria-label="Log in"
                className="-ml-2 flex items-center gap-1.5 rounded-full px-2 py-2 text-white"
              >
                <span className="text-sm font-semibold">Login</span>
                <ChevronDown size={14} className="text-silver" />
              </button>
            )}
            <div className="flex items-center gap-1">
              <Link
                href="/watchlist"
                aria-label="Cart"
                className="rounded-full p-2 text-silver hover:text-white"
              >
                <ShoppingCart size={18} />
              </Link>
              <Link
                href="/activity"
                aria-label="Notifications"
                className="rounded-full p-2 text-silver hover:text-white"
              >
                <Bell size={18} />
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <form onSubmit={submitSearch} className="flex-1">
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 focus-within:border-[#00ffa3]/40">
                <SearchIcon size={14} className="text-silver" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="What are you looking for?"
                  className="flex-1 bg-transparent text-sm text-white placeholder:text-silver/50 focus:outline-none"
                />
              </div>
            </form>
            <div className="relative">
              <button
                type="button"
                onClick={openFilterPanel}
                aria-label="Filters & sort"
                className={`inline-flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
                  filterOpen || hasActiveFilter
                    ? "bg-[#00ffa3]/10 text-[#00ffa3]"
                    : "bg-white/5 text-silver hover:text-white"
                }`}
              >
                <SlidersHorizontal size={16} />
              </button>
              {filterOpen && renderFilterSortPanel()}
            </div>
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Categories</h3>
              <Link
                href="/categories"
                className="text-[11px] text-silver/70 hover:text-white"
              >
                See all
              </Link>
            </div>
            <div className="-mx-1 flex gap-2 overflow-x-auto pb-1 px-1 scrollbar-none">
              {(
                [
                  { label: "All", href: "/marketplace", icon: LayoutGrid },
                  { label: "Watches", href: "/marketplace?category=Watches", icon: Watch },
                  {
                    label: "Phones",
                    href: "/marketplace?category=Smartphones%20%26%20Phones",
                    icon: Smartphone,
                  },
                  { label: "Cars", href: "/marketplace?category=Cars%20%26%20Trucks", icon: Car },
                  { label: "Laptops", href: "/marketplace?category=Laptops", icon: Laptop },
                  { label: "Furniture", href: "/marketplace?category=Furniture", icon: Sofa },
                  { label: "Art", href: "/marketplace?category=Art%20%26%20Prints", icon: Palette },
                  {
                    label: "Sneakers",
                    href: "/marketplace?category=Shoes%20%26%20Sneakers",
                    icon: Footprints,
                  },
                ] as { label: string; href: string; icon: typeof LayoutGrid }[]
              ).map((c) => {
                const isActive =
                  (c.label === "All" && !categoryQuery) ||
                  decodeURIComponent(c.href.split("category=")[1] ?? "") === categoryQuery;
                const Icon = c.icon;
                return (
                  <Link
                    key={c.label}
                    href={c.href}
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                      isActive
                        ? "border-[#00ffa3]/40 bg-[#00ffa3]/10 text-[#00ffa3]"
                        : "border-white/10 bg-white/5 text-silver hover:text-white"
                    }`}
                  >
                    <Icon size={14} />
                    {c.label}
                  </Link>
                );
              })}
            </div>
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
              <div className="hidden sm:grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
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
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-bold tracking-tight">Recently listed</h3>
                            {viewDropdown}
                          </div>
                          <span className="text-xs text-silver/60">
                            {rest.length.toLocaleString()} more
                          </span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6 gap-4 auto-rows-[120px]">
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
      <ProfileCardSheet open={profileCardOpen} onClose={() => setProfileCardOpen(false)} />
    </main>
  );
}
