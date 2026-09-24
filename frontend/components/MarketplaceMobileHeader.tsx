"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { Funnel, Search as SearchIcon, SlidersHorizontal, User } from "lucide-react";
import { useHashpackWallet } from "../lib/hashpackWallet";
import { useSignInModal } from "../lib/signInModal";
import { profileAvatarUrl, useProfile } from "../lib/profiles";
import { material } from "../lib/materials";
import { cn } from "../lib/utils";
import { NotificationBell } from "./NotificationBell";
import { ProfileCardSheet } from "./ProfileCardSheet";
import { Sheet } from "./ui/Sheet";

/** Sheet portals to document.body, so gate it to the mobile breakpoint. */
function useMobileSheet() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      setIsMobile(true);
      return;
    }
    const query = window.matchMedia("(max-width: 639px)");
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
          "flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full text-silver",
        )}
      >
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt="" className="h-full w-full object-cover" />
        ) : (
          <User size={18} aria-hidden />
        )}
      </button>
      <ProfileCardSheet open={profileOpen} onClose={() => setProfileOpen(false)} />
    </>
  );
}

/**
 * Marketplace-only mobile chrome (below `sm`). Centered Hashpop wordmark,
 * bell + glass profile, and one search/Filter row. The Filter button and the
 * sliders inside the search field open the same sheet.
 */
export function MarketplaceMobileHeader({
  searchValue,
  onSearchChange,
  onSearchSubmit,
  filterOpen,
  onOpenFilters,
  onCloseFilters,
  filterSheet,
}: {
  searchValue: string;
  onSearchChange: (value: string) => void;
  onSearchSubmit: (event: FormEvent) => void;
  filterOpen: boolean;
  onOpenFilters: () => void;
  onCloseFilters: () => void;
  filterSheet: ReactNode;
}) {
  const mobileSheet = useMobileSheet();
  return (
    <div data-testid="marketplace-mobile-header" className="mb-3 sm:hidden">
      <div className="relative flex min-h-[52px] items-center justify-end">
        <Link
          href="/marketplace"
          aria-label="Hashpop home"
          className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
        >
          <span
            data-testid="marketplace-logo"
            className="text-[26px] font-extrabold leading-none tracking-tight text-white"
          >
            <span className="sr-only">Hashpop</span>
            <span aria-hidden>
              Hashp
              <span className="mx-px inline-block h-[0.62em] w-[0.62em] translate-y-[0.02em] rounded-full bg-[#00ffa3] align-middle shadow-[0_0_8px_rgba(0,255,163,0.55)]" />
              p
            </span>
          </span>
          <span
            data-testid="marketplace-wordmark"
            className="mt-1 pl-[0.28em] text-[10px] font-medium lowercase tracking-[0.28em] text-silver"
          >
            marketplace
          </span>
        </Link>
        <div className="relative z-10 flex items-center gap-1.5">
          <NotificationBell variant="mobile" />
          <ProfileAvatarButton />
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <form onSubmit={onSearchSubmit} className="min-w-0 flex-1">
          <div className="flex h-11 items-center gap-2 rounded-full border border-white/15 bg-[#141c27] pl-3.5 pr-1.5">
            <SearchIcon size={16} className="shrink-0 text-silver/80" aria-hidden />
            <input
              type="text"
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search Hashpop..."
              aria-label="Search Hashpop"
              className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-silver/50 focus:outline-none"
            />
            <button
              type="button"
              data-testid="marketplace-filter-sliders"
              onClick={onOpenFilters}
              aria-label="Filters and sort"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#00ffa3]"
            >
              <SlidersHorizontal size={16} aria-hidden />
            </button>
          </div>
        </form>
        <button
          type="button"
          data-testid="marketplace-filter-button"
          onClick={onOpenFilters}
          className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border border-[#00ffa3]/70 bg-transparent px-3.5 text-sm font-medium text-[#00ffa3]"
        >
          <Funnel size={15} aria-hidden />
          Filter
        </button>
      </div>

      <Sheet
        open={filterOpen && mobileSheet}
        onClose={onCloseFilters}
        detent="large"
        title="Filters"
        ariaLabel="Filters"
      >
        {filterSheet}
      </Sheet>
    </div>
  );
}
