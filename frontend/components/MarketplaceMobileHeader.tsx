"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { Funnel, Search as SearchIcon, SlidersHorizontal, User } from "lucide-react";
import { useHashpackWallet } from "../lib/hashpackWallet";
import { useSignInModal } from "../lib/signInModal";
import { profileAvatarUrl, useProfile } from "../lib/profiles";
import { material } from "../lib/materials";
import { cn } from "../lib/utils";
import { HashpopWordmark } from "./HashpopWordmark";
import { NotificationBell } from "./NotificationBell";
import { ProfileCardSheet } from "./ProfileCardSheet";
import { Sheet } from "./ui/Sheet";

const FILTER_DETENTS = ["medium", "large"] as const;

/** Sheet portals to document.body, so gate it to viewports below 768px. */
function useMobileSheet() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      setIsMobile(true);
      return;
    }
    const query = window.matchMedia("(max-width: 767px)");
    const apply = () => setIsMobile(query.matches);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);
  return isMobile;
}

function ProfileAvatarButton() {
  const { accountId, address, isConnected } = useHashpackWallet();
  const { openSignIn } = useSignInModal();
  const [profileOpen, setProfileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const signedIn = mounted && isConnected;
  const profile = useProfile(signedIn ? (address ?? accountId) : null);
  const avatar = signedIn ? profileAvatarUrl(profile) : null;

  return (
    <>
      <button
        type="button"
        data-testid="marketplace-profile"
        aria-label={signedIn ? "Open profile" : "Sign in"}
        onClick={() => (signedIn ? setProfileOpen(true) : openSignIn())}
        className={cn(
          material.chrome,
          "flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full text-white/90",
        )}
      >
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt="" className="h-full w-full object-cover" />
        ) : (
          <User size={20} aria-hidden />
        )}
      </button>
      <ProfileCardSheet open={profileOpen} onClose={() => setProfileOpen(false)} />
    </>
  );
}

/**
 * Marketplace chrome below 768px. Brand row is a 3-column grid so the
 * wordmark is centered on the screen. Sliders open Sort; Filter opens the sheet.
 */
export function MarketplaceMobileHeader({
  searchValue,
  onSearchChange,
  onSearchSubmit,
  filterOpen,
  onOpenFilters,
  onCloseFilters,
  filterCount,
  resultCount,
  onClearFilters,
  onShowResults,
  filterSheet,
  sortOpen,
  onOpenSort,
  onCloseSort,
  sortSheet,
}: {
  searchValue: string;
  onSearchChange: (value: string) => void;
  onSearchSubmit: (event: FormEvent) => void;
  filterOpen: boolean;
  onOpenFilters: () => void;
  onCloseFilters: () => void;
  filterCount: number;
  resultCount: number;
  onClearFilters: () => void;
  onShowResults: () => void;
  filterSheet: ReactNode;
  sortOpen: boolean;
  onOpenSort: () => void;
  onCloseSort: () => void;
  sortSheet: ReactNode;
}) {
  const mobileSheet = useMobileSheet();
  const filtersActive = filterCount > 0;
  return (
    <div
      data-testid="marketplace-mobile-header"
      className="mb-3 pt-[calc(env(safe-area-inset-top)+12px)] md:hidden"
    >
      <div className="grid h-14 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center">
        <div aria-hidden />
        <Link href="/marketplace" aria-label="Hashpop home" className="flex flex-col items-center">
          <HashpopWordmark />
          <span
            data-testid="marketplace-wordmark"
            className="mt-0.5 text-[12px] font-medium lowercase leading-none tracking-[0.12em] text-white/60"
          >
            marketplace
          </span>
        </Link>
        <div className="flex items-center justify-end gap-2">
          <NotificationBell variant="marketplace" />
          <ProfileAvatarButton />
        </div>
      </div>

      <div className="mt-3 flex h-11 items-center gap-2">
        <form onSubmit={onSearchSubmit} className="min-w-0 flex-1">
          <div
            data-testid="marketplace-search-field"
            className="flex h-11 items-center rounded-[22px] border border-white/10 bg-material-chrome pl-[14px] backdrop-blur-material"
          >
            <SearchIcon size={20} className="shrink-0 text-white/60" aria-hidden />
            <input
              type="text"
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search Hashpop…"
              aria-label="Search Hashpop"
              className="min-w-0 flex-1 bg-transparent px-2 text-[16px] text-white placeholder:text-white/50 focus:outline-none"
            />
            <button
              type="button"
              data-testid="marketplace-sort-button"
              onClick={onOpenSort}
              aria-label="Sort"
              className="flex h-11 w-11 shrink-0 items-center justify-end pr-[14px] text-[#00ffa3]"
            >
              <SlidersHorizontal size={20} aria-hidden />
            </button>
          </div>
        </form>
        <button
          type="button"
          data-testid="marketplace-filter-button"
          onClick={onOpenFilters}
          className={cn(
            "inline-flex h-11 shrink-0 items-center gap-1.5 rounded-[22px] border bg-material-chrome px-[14px] text-[15px] font-semibold text-[#00ffa3] backdrop-blur-material",
            filtersActive ? "border-[#00ffa3]" : "border-[#00ffa3]/40",
          )}
        >
          <Funnel size={18} aria-hidden />
          {filtersActive ? `Filter · ${filterCount}` : "Filter"}
        </button>
      </div>

      <Sheet
        open={filterOpen && mobileSheet}
        onClose={onCloseFilters}
        detent="medium"
        detents={[...FILTER_DETENTS]}
        title="Filters"
        ariaLabel="Filters"
        footer={
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              data-testid="filter-clear"
              onClick={onClearFilters}
              className="text-[15px] font-medium text-white/80"
            >
              Clear
            </button>
            <button
              type="button"
              data-testid="filter-show"
              onClick={onShowResults}
              className="btn-mint rounded-full px-4 py-2.5 text-[15px] font-semibold"
            >
              Show {resultCount} results
            </button>
          </div>
        }
      >
        {filterSheet}
      </Sheet>

      <Sheet
        open={sortOpen && mobileSheet}
        onClose={onCloseSort}
        detent="medium"
        title="Sort"
        ariaLabel="Sort"
      >
        {sortSheet}
      </Sheet>
    </div>
  );
}
