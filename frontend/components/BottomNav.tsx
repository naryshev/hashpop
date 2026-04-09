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
    case "menu":
      return (
        <svg className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
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
  showMenu = false,
  onMenuClick,
}: {
  signInMode?: boolean;
  showMenu?: boolean;
  onMenuClick?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const navLinks = signInMode ? signInLinks : links;
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const totalCols = (showMenu ? 1 : 0) + navLinks.length;

  useEffect(() => {
    if (searchOpen) {
      const t = setTimeout(() => searchInputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [searchOpen]);

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery("");
    searchInputRef.current?.blur();
  };

  useEffect(() => {
    if (!searchOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSearch();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchOpen]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    closeSearch();
    const q = searchQuery.trim();
    router.push(q ? `/marketplace?q=${encodeURIComponent(q)}` : "/marketplace");
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-30 bg-black/90 backdrop-blur-[20px] shadow-[0_4px_16px_rgba(0,0,0,0.4)] ${signInMode ? "" : "md:hidden"}`}
      style={{ paddingTop: "env(safe-area-inset-top, 0)" }}
    >
      <div
        className="grid items-center border-b border-white/10"
        style={{ gridTemplateColumns: `repeat(${totalCols}, minmax(0, 1fr))` }}
      >
        {/* Hamburger — leftmost, only when sidebar is present */}
        {showMenu && (
          <button
            type="button"
            onClick={onMenuClick}
            className="flex flex-col items-center justify-center gap-0.5 py-2 px-1 text-silver hover:text-white transition-colors"
            aria-label="Open menu"
          >
            <Icon name="menu" />
            <span className="text-[11px] font-medium">Menu</span>
          </button>
        )}

        {navLinks.map(({ href, label, icon }) => {
          const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));

          // Search gets a special glowing bubble + slide-down panel
          if (icon === "search") {
            return (
              <button
                key="search"
                type="button"
                onClick={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
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

      {/* Sliding green search panel */}
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
            <button
              type="button"
              onClick={closeSearch}
              className="shrink-0 text-[#00ffa3]/50 hover:text-[#00ffa3] transition-colors"
              aria-label="Close search"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </form>
      </div>
    </nav>
  );
}
