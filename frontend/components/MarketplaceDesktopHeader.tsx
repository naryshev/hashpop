"use client";

import { useEffect, useState, type FormEvent, type Ref } from "react";
import Link from "next/link";
import { Search as SearchIcon, ShoppingCart } from "lucide-react";
import { useCart } from "../lib/cart";
import { formatDockBadgeCount } from "../lib/dockBadge";
import { HashpopWordmark } from "./HashpopWordmark";
import { NotificationBell } from "./NotificationBell";
import { ProfileAvatarButton } from "./MarketplaceBrandHeader";
import { DockBadge } from "./ui/DockBadge";

/**
 * Marketplace slim bar at ≥768px. Cart mark sits left of the mint ring-o
 * wordmark. Search is neutral glass. Right cluster is Create, cart, bell, profile.
 */
export function MarketplaceDesktopHeader({
  searchValue,
  onSearchChange,
  onSearchSubmit,
  searchInputRef,
}: {
  searchValue: string;
  onSearchChange: (value: string) => void;
  onSearchSubmit: (event: FormEvent) => void;
  searchInputRef?: Ref<HTMLInputElement>;
}) {
  const { count: cartCount } = useCart();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const badgeCount = mounted ? cartCount : 0;

  return (
    <header
      data-testid="marketplace-desktop-header"
      className="hp-desktop-bar sticky top-0 z-30 hidden h-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 overflow-hidden border-0 border-white/[0.06] bg-[#0b111b]/90 px-0 backdrop-blur-xl md:grid md:h-[72px] md:overflow-visible md:border-b md:px-5"
    >
      <Link
        href="/marketplace"
        data-testid="marketplace-desktop-brand"
        aria-label="Hashpop home"
        className="flex shrink-0 items-center gap-2.5"
      >
        {/* Product cart-H (same asset as the shell and splash). Not the outline cart. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/hashpop-cart-3d.PNG"
          alt=""
          data-testid="marketplace-cart-mark"
          className="h-9 w-auto object-contain"
        />
        <HashpopWordmark size="header" />
      </Link>

      <form onSubmit={onSearchSubmit} className="min-w-0">
        <div
          data-testid="marketplace-desktop-search"
          className="mx-auto flex h-11 w-full max-w-[560px] items-center rounded-full border border-white/10 bg-white/[0.06] px-4 backdrop-blur-md"
        >
          <SearchIcon size={18} className="shrink-0 text-white/55" aria-hidden />
          <input
            ref={searchInputRef}
            type="text"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search marketplace…"
            aria-label="Search marketplace"
            className="min-w-0 flex-1 bg-transparent pl-2 text-[15px] text-white placeholder:text-white/45 focus:outline-none"
          />
        </div>
      </form>

      <div className="flex shrink-0 items-center gap-1">
        <Link
          href="/create"
          data-testid="marketplace-desktop-create"
          className="mr-2 whitespace-nowrap px-2 text-[15px] font-semibold text-[#00ffa3] hover:text-white"
        >
          Create
        </Link>
        <Link
          href="/cart"
          data-testid="marketplace-desktop-cart"
          className="relative flex h-10 w-10 items-center justify-center text-white/90 hover:text-white"
          aria-label={
            formatDockBadgeCount(badgeCount) ? `Cart, ${formatDockBadgeCount(badgeCount)}` : "Cart"
          }
        >
          <span className="relative inline-flex">
            <ShoppingCart size={22} aria-hidden />
            <DockBadge count={badgeCount} />
          </span>
        </Link>
        <NotificationBell variant="marketplace" />
        <ProfileAvatarButton testId="marketplace-desktop-profile" />
      </div>
    </header>
  );
}
