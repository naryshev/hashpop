"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { AccountMenu } from "./AccountMenu";

/** Hashpop logo wordmark with red-blue-green accent palette. */
function HashpopLogo() {
  return (
    <Link
      href="/marketplace"
      className="inline-flex items-center gap-1.5 font-bold text-2xl tracking-tight"
      aria-label="Hashpop marketplace"
    >
      <span className="bg-[linear-gradient(100deg,#ff2f3d_0%,#ff8f00_32%,#13a0ff_62%,#6ddf85_100%)] bg-clip-text text-transparent">
        Hashpop
      </span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/hashpop-cart-3d.PNG" alt="" aria-hidden className="h-7 w-auto object-contain" />
    </Link>
  );
}

const TOP_LINKS = [
  { href: "/", label: "Home" },
  { href: "/marketplace", label: "Daily Deals" },
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/support", label: "Help & Contact" },
];

const CATEGORY_LINKS = [
  { href: "/dashboard", label: "Saved", query: "wishlist" },
  { href: "/marketplace", label: "Watches", query: "category=Watches" },
  { href: "/marketplace", label: "Cars", query: "category=Cars" },
  { href: "/marketplace", label: "Computers", query: "category=Computers" },
  { href: "/marketplace", label: "Shoes", query: "category=Shoes" },
  { href: "/marketplace", label: "Clothes", query: "category=Clothes" },
  { href: "/marketplace", label: "Accessories", query: "category=Accessories" },
  { href: "/marketplace", label: "Food products", query: "category=Food%20Products" },
  { href: "/marketplace", label: "Precious metals", query: "category=Precious%20Metals" },
  { href: "/marketplace", label: "Digital goods", query: "category=Digital%20Goods" },
  { href: "/marketplace", label: "Electronic items", query: "category=Electronic%20Items" },
  { href: "/marketplace", label: "Software", query: "category=Software" },
  { href: "/marketplace", label: "Access codes", query: "category=Access%20Codes" },
  { href: "/marketplace", label: "Paper media", query: "category=Paper%20Media" },
];

/** My Hashpop dropdown links. */
const MY_HBAY_LINKS = [
  { href: "/dashboard", label: "Summary" },
  { href: "/offers", label: "Bids/Offers" },
  { href: "/watchlist", label: "Watchlist" },
  { href: "/purchases", label: "Purchase History" },
  { href: "/selling", label: "Selling" },
  { href: "/messages", label: "Messages" },
];

export function HomeHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const isHome = pathname === "/";
  const [searchQuery, setSearchQuery] = useState("");
  const [myHbayOpen, setMyHbayOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [postedWithin, setPostedWithin] = useState("");
  const myHbayRef = useRef<HTMLDivElement>(null);
  const advancedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (myHbayRef.current && !myHbayRef.current.contains(target)) setMyHbayOpen(false);
      if (advancedRef.current && !advancedRef.current.contains(target)) setAdvancedOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) router.push(`/marketplace?q=${encodeURIComponent(searchQuery.trim())}`);
    else router.push("/marketplace");
  };

  const handleAdvancedApply = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    const q = searchQuery.trim();
    if (q) params.set("q", q);
    if (minPrice.trim()) params.set("minPrice", minPrice.trim());
    if (maxPrice.trim()) params.set("maxPrice", maxPrice.trim());
    if (postedWithin) params.set("postedWithin", postedWithin);
    const qs = params.toString();
    router.push(qs ? `/marketplace?${qs}` : "/marketplace");
    setAdvancedOpen(false);
  };

  if (isHome) return null;

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[var(--bg)] backdrop-blur-[20px]">
      {/* Top bar - desktop */}
      <div className="hidden md:block border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 py-2 flex items-center justify-between gap-4 text-sm">
          <div className="flex items-center gap-4">
            <AccountMenu />
            {TOP_LINKS.map(({ href, label }) => (
              <Link key={label} href={href} className="text-silver hover:text-white">
                {label}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-4">
            <Link href="/create" className="text-silver hover:text-white font-medium">
              Sell
            </Link>
            <Link href="/watchlist" className="text-silver hover:text-white">
              Watchlist
            </Link>
            <div
              ref={myHbayRef}
              className="relative inline-block"
              onMouseEnter={() => setMyHbayOpen(true)}
              onMouseLeave={() => setMyHbayOpen(false)}
            >
              <button
                type="button"
                onClick={() => setMyHbayOpen((o) => !o)}
                className="flex items-center gap-1 text-sm text-silver hover:text-white py-2.5 px-2 -my-2 rounded-lg hover:bg-white/5"
                aria-expanded={myHbayOpen}
                aria-haspopup="true"
              >
                My Hashpop
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
              {myHbayOpen && (
                <div className="absolute top-full right-0 mt-0 pt-1 z-50">
                  <div className="min-w-[200px] rounded-lg border border-white/10 bg-[var(--bg)] shadow-xl py-2 z-50">
                    {MY_HBAY_LINKS.map(({ href, label }) => (
                      <Link
                        key={label}
                        href={href}
                        onClick={() => setMyHbayOpen(false)}
                        className="block py-2.5 px-4 text-sm text-silver hover:text-white hover:bg-white/5"
                      >
                        {label}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main nav: logo + search + mobile hamburger */}
      <div className="max-w-6xl mx-auto px-4 py-3 md:py-4">
        {/* Mobile top nav (eBay-like) */}
        <div className="md:hidden space-y-3">
          <div className="flex items-center justify-between">
            <Link
              href="/marketplace"
              className="text-3xl font-extrabold tracking-tight"
              aria-label="Hashpop marketplace"
            >
              <span className="bg-[linear-gradient(100deg,#ff2f3d_0%,#ff8f00_32%,#13a0ff_62%,#6ddf85_100%)] bg-clip-text text-transparent">
                hashpop
              </span>
            </Link>
            <Link
              href="/selling"
              className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/10 p-2.5"
              aria-label="Selling"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/hashpop-cart-3d.PNG"
                alt="Hashpop cart"
                className="h-6 w-auto object-contain"
              />
            </Link>
          </div>
          <form onSubmit={handleSearch} className="flex items-center gap-2">
            <div className="flex min-w-0 flex-1 items-center rounded-full border border-white/10 bg-white/5 px-3">
              <svg
                className="h-5 w-5 text-silver"
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
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for anything"
                className="flex-1 bg-transparent py-2.5 pl-2 text-white placeholder:text-zinc-500 focus:outline-none text-sm"
              />
              <svg
                className="h-5 w-5 text-silver"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                />
              </svg>
            </div>
          </form>
        </div>

        {/* Desktop main nav */}
        <div className="hidden md:flex items-center gap-3 md:gap-4">
          <HashpopLogo />
          {isHome && (
            <button
              type="button"
              className="hidden sm:flex items-center gap-1 text-sm text-silver hover:text-white border border-white/10 rounded-lg px-3 py-2"
            >
              Shop by category
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
          )}
          <form onSubmit={handleSearch} className="flex-1 min-w-0 flex items-center gap-2">
            <div className="flex-1 min-w-0 flex items-center gap-2 rounded-full border border-[#00ffa3]/50 bg-[#00ffa3]/[0.08] px-3.5 py-2 shadow-[0_0_20px_rgba(0,255,163,0.15),inset_0_0_12px_rgba(0,255,163,0.04)]">
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
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Hashpop..."
                className="flex-1 min-w-0 bg-transparent text-sm text-white placeholder:text-[#00ffa3]/40 focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="shrink-0 text-[#00ffa3]/50 hover:text-[#00ffa3] transition-colors"
                  aria-label="Clear search"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            <button type="submit" className="btn-frost-cta text-sm py-2.5 px-4 shrink-0">
              Search
            </button>
            <div ref={advancedRef} className="hidden sm:block relative shrink-0">
              <button
                type="button"
                onClick={() => setAdvancedOpen((o) => !o)}
                className="text-sm text-silver hover:text-white"
              >
                Advanced
              </button>
              {advancedOpen && (
                <div className="absolute right-0 mt-2 w-[320px] rounded-xl border border-white/10 bg-[var(--bg)] shadow-xl p-4 z-50">
                  <form onSubmit={handleAdvancedApply} className="space-y-3">
                    <p className="text-white text-sm font-medium">Advanced Search</p>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className="text-xs text-silver">Min price (HBAR)</span>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={minPrice}
                          onChange={(e) => setMinPrice(e.target.value)}
                          className="input-frost mt-1 w-full text-sm"
                          placeholder="0"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs text-silver">Max price (HBAR)</span>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={maxPrice}
                          onChange={(e) => setMaxPrice(e.target.value)}
                          className="input-frost mt-1 w-full text-sm"
                          placeholder="100"
                        />
                      </label>
                    </div>
                    <label className="block">
                      <span className="text-xs text-silver">Posted within</span>
                      <select
                        value={postedWithin}
                        onChange={(e) => setPostedWithin(e.target.value)}
                        className="input-frost mt-1 w-full text-sm"
                      >
                        <option value="">Any time</option>
                        <option value="1d">Last day</option>
                        <option value="1w">Last week</option>
                        <option value="1m">Last month</option>
                        <option value="3m">Last 3 months</option>
                        <option value="6m">Last 6 months</option>
                        <option value="1y">Last year</option>
                        <option value="2y">Last 2 years</option>
                      </select>
                    </label>
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setMinPrice("");
                          setMaxPrice("");
                          setPostedWithin("");
                          setAdvancedOpen(false);
                          const q = searchQuery.trim();
                          router.push(
                            q ? `/marketplace?q=${encodeURIComponent(q)}` : "/marketplace",
                          );
                        }}
                        className="btn-frost border-white/20 text-xs px-3 py-2"
                      >
                        Reset
                      </button>
                      <button type="submit" className="btn-frost-cta text-xs px-3 py-2">
                        Apply filters
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* Category bar - desktop, only on homepage */}
      {isHome && (
        <div className="hidden md:block border-t border-white/5 overflow-x-auto scrollbar-hide">
          <div className="max-w-6xl mx-auto px-4 py-2 flex items-center gap-4 text-sm shrink-0">
            {CATEGORY_LINKS.map(({ href, label, query }) => (
              <Link
                key={label}
                href={query ? `${href}?${query}` : href}
                className="text-silver hover:text-white whitespace-nowrap"
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
