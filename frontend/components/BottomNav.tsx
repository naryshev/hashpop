"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const links = [
  { href: "/messages", label: "Alerts", icon: "bell" },
  { href: "/marketplace", label: "Search", icon: "search" },
  { href: "/dashboard", label: "My Hashpop", icon: "dashboard" },
  { href: "/selling", label: "Selling", icon: "sell" },
];

const signInLinks = [
  { href: "/dashboard", label: "My Hashpop", icon: "dashboard" },
  { href: "/messages", label: "Alerts", icon: "bell" },
];

function Icon({ name }: { name: string }) {
  const c = "w-5 h-5";
  switch (name) {
    case "home":
      return (
        <svg className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      );
    case "browse":
      return (
        <svg className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
          />
        </svg>
      );
    case "sell":
      return (
        <svg className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
          />
        </svg>
      );
    case "search":
      return (
        <svg className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-4.35-4.35M16 10.5A5.5 5.5 0 115 10.5a5.5 5.5 0 0111 0z"
          />
        </svg>
      );
    case "bell":
      return (
        <svg className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V4a2 2 0 10-4 0v1.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
      );
    case "dashboard":
      return (
        <svg className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
      );
    default:
      return null;
  }
}

export function BottomNav({
  signInMode = false,
  showMenu: _showMenu = false,
  onMenuClick: _onMenuClick,
}: {
  signInMode?: boolean;
  showMenu?: boolean;
  onMenuClick?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const navLinks = signInMode ? signInLinks : links;
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMinPrice, setFilterMinPrice] = useState("");
  const [filterMaxPrice, setFilterMaxPrice] = useState("");
  const [filterPostedWithin, setFilterPostedWithin] = useState("");
  const [filterCondition, setFilterCondition] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const navRef = useRef<HTMLElement>(null);

  const totalCols = (!signInMode ? 1 : 0) + navLinks.length;
  const hasActiveFilters = !!(filterMinPrice || filterMaxPrice || filterPostedWithin || filterCondition);

  useEffect(() => {
    if (searchOpen) {
      const t = setTimeout(() => searchInputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [searchOpen]);

  const closeAll = () => {
    setSearchOpen(false);
    setFilterOpen(false);
    setSearchQuery("");
    searchInputRef.current?.blur();
  };

  useEffect(() => {
    if (!searchOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAll();
    };
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) closeAll();
    };
    document.addEventListener("keydown", handleKey);
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("touchstart", handleOutside);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("touchstart", handleOutside);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchOpen]);

  const buildParams = (q: string) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (filterMinPrice) p.set("minPrice", filterMinPrice);
    if (filterMaxPrice) p.set("maxPrice", filterMaxPrice);
    if (filterPostedWithin) p.set("postedWithin", filterPostedWithin);
    if (filterCondition) p.set("condition", filterCondition);
    return p.toString();
  };

  const submitSearch = () => {
    const q = searchQuery.trim();
    const params = buildParams(q);
    closeAll();
    router.push(params ? `/marketplace?${params}` : "/marketplace");
  };

  const applyFilters = () => {
    const q = searchQuery.trim();
    const params = buildParams(q);
    closeAll();
    router.push(params ? `/marketplace?${params}` : "/marketplace");
  };

  const clearFilters = () => {
    setFilterMinPrice("");
    setFilterMaxPrice("");
    setFilterPostedWithin("");
    setFilterCondition("");
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    submitSearch();
  };

  return (
    <nav
      ref={navRef}
      className={`fixed top-0 left-0 right-0 z-30 bg-black/90 backdrop-blur-[20px] shadow-[0_4px_16px_rgba(0,0,0,0.4)] ${signInMode ? "" : "md:hidden"}`}
      style={{ paddingTop: "env(safe-area-inset-top, 0)" }}
    >
      <div
        className="grid items-center border-b border-white/10"
        style={{ gridTemplateColumns: `repeat(${totalCols}, minmax(0, 1fr))` }}
      >
        {/* Home — always first on non-sign-in nav */}
        {!signInMode && (
          <Link
            href="/marketplace"
            className={`flex flex-col items-center justify-center gap-0.5 py-2 px-1 transition-colors ${
              pathname === "/marketplace" ? "text-chrome" : "text-silver hover:text-white"
            }`}
          >
            <Icon name="home" />
            <span className="text-[11px] font-medium">Home</span>
          </Link>
        )}

        {navLinks.map(({ href, label, icon }) => {
          const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));

          // Search gets a special glowing bubble + slide-down panel
          if (icon === "search") {
            return (
              <button
                key="search"
                type="button"
                onClick={() => (searchOpen ? closeAll() : setSearchOpen(true))}
                className="flex flex-col items-center justify-center py-2 px-1"
                aria-label={searchOpen ? "Close search" : "Open search"}
                aria-expanded={searchOpen}
              >
                <span
                  className={`inline-flex items-center justify-center rounded-lg px-4 py-1.5 transition-all duration-200 ${
                    searchOpen || isActive
                      ? "bg-[#00ffa3]/15 border border-[#00ffa3]/60 text-[#00ffa3] shadow-[0_0_10px_rgba(0,255,163,0.35)]"
                      : "bg-white/5 border border-white/15 text-silver hover:bg-[#00ffa3]/10 hover:border-[#00ffa3]/40 hover:text-[#00ffa3] hover:shadow-[0_0_8px_rgba(0,255,163,0.25)]"
                  }`}
                >
                  <Icon name="search" />
                </span>
              </button>
            );
          }

          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center justify-center gap-0.5 py-2 px-1 transition-colors ${
                isActive ? "text-chrome" : "text-silver hover:text-white"
              }`}
            >
              <Icon name={icon} />
              <span className="text-[11px] font-medium">{label}</span>
            </Link>
          );
        })}
      </div>

      {/* Sliding search bar */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-out ${
          searchOpen ? "max-h-20 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <form onSubmit={handleSearch} className="px-3 py-2.5">
          <div className="flex items-center gap-2 rounded-full border border-[#00ffa3]/50 bg-[#00ffa3]/8 px-3.5 py-2 shadow-[0_0_20px_rgba(0,255,163,0.15),inset_0_0_12px_rgba(0,255,163,0.04)]">
            <svg
              className="h-4 w-4 shrink-0 text-[#00ffa3]"
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
              ref={searchInputRef}
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Hashpop..."
              className="flex-1 bg-transparent text-sm text-white placeholder:text-[#00ffa3]/40 focus:outline-none"
              aria-label="Search query"
            />
            {/* Filter icon — toggles filter panel */}
            <button
              type="button"
              onClick={() => setFilterOpen((o) => !o)}
              className={`shrink-0 transition-colors ${filterOpen || hasActiveFilters ? "text-[#00ffa3]" : "text-[#00ffa3]/60 hover:text-[#00ffa3]"}`}
              aria-label="Toggle filters"
              aria-expanded={filterOpen}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
      </div>

      {/* Sliding filter panel */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-out ${
          searchOpen && filterOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="px-3 pb-3 space-y-3 border-t border-white/10 pt-2.5">
          <p className="text-[10px] font-semibold tracking-widest text-silver/60 uppercase">Filters</p>

          {/* Price range */}
          <div>
            <span className="text-xs text-silver/70 mb-1.5 block">Price (HBAR)</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                step="any"
                value={filterMinPrice}
                onChange={(e) => setFilterMinPrice(e.target.value)}
                placeholder="Min"
                className="flex-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-sm text-white placeholder:text-white/30 focus:border-[#00ffa3]/50 focus:outline-none"
              />
              <span className="text-silver/40 text-xs shrink-0">–</span>
              <input
                type="number"
                min="0"
                step="any"
                value={filterMaxPrice}
                onChange={(e) => setFilterMaxPrice(e.target.value)}
                placeholder="Max"
                className="flex-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-sm text-white placeholder:text-white/30 focus:border-[#00ffa3]/50 focus:outline-none"
              />
            </div>
          </div>

          {/* Date + Condition row */}
          <div className="flex gap-2">
            <select
              value={filterPostedWithin}
              onChange={(e) => setFilterPostedWithin(e.target.value)}
              className="flex-1 rounded-lg border border-white/10 bg-[#0b111b] px-2 py-1.5 text-sm text-white focus:border-[#00ffa3]/50 focus:outline-none"
            >
              <option value="">Any time</option>
              <option value="1d">Last 24h</option>
              <option value="1w">Last week</option>
              <option value="1m">Last month</option>
              <option value="3m">Last 3 months</option>
              <option value="6m">Last 6 months</option>
              <option value="1y">Last year</option>
            </select>
            <select
              value={filterCondition}
              onChange={(e) => setFilterCondition(e.target.value)}
              className="flex-1 rounded-lg border border-white/10 bg-[#0b111b] px-2 py-1.5 text-sm text-white focus:border-[#00ffa3]/50 focus:outline-none"
            >
              <option value="">Any condition</option>
              <option value="new">New</option>
              <option value="like new">Like New</option>
              <option value="good">Good</option>
              <option value="fair">Fair</option>
              <option value="poor">Poor</option>
            </select>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 pt-0.5">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="flex-1 rounded-lg border border-white/10 py-2 text-xs text-silver/70 hover:text-white transition-colors"
              >
                Clear
              </button>
            )}
            <button
              type="button"
              onClick={applyFilters}
              className="flex-1 rounded-lg bg-[#00ffa3]/15 border border-[#00ffa3]/50 py-2 text-xs font-semibold text-[#00ffa3] hover:bg-[#00ffa3]/25 transition-colors"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
