"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Map as MapIcon, MessageSquare, Plus, ShoppingCart, Store, UserCircle } from "lucide-react";
import { useHashpackWallet } from "../lib/hashpackWallet";
import { useCart } from "../lib/cart";
import { NearbyMap } from "./NearbyMap";

type NavItem = {
  href: string;
  icon: React.ReactNode;
  label: string;
};

/**
 * Floating bottom navigation bar shown on mobile. Six cells: Marketplace and
 * Map on the left, the Create FAB in the middle, then Cart (with a count
 * badge), Profile and Messages. Labels are dropped — each cell is an
 * icon-only tap target.
 */
export function BottomNav() {
  const pathname = usePathname();
  const { address, accountId } = useHashpackWallet();
  const { count: cartCount } = useCart();
  const [mapOpen, setMapOpen] = useState(false);
  const profileHref =
    address || accountId
      ? `/profile/${encodeURIComponent(address || accountId || "")}`
      : "/dashboard";

  const leftItems: NavItem[] = [
    {
      href: "/marketplace",
      icon: <Store className="h-5 w-5 md:h-6 md:w-6" />,
      label: "Marketplace",
    },
  ];

  const rightItems: NavItem[] = [
    {
      href: profileHref,
      icon: <UserCircle className="h-5 w-5 md:h-6 md:w-6" />,
      label: "Profile",
    },
    {
      href: "/messages",
      icon: <MessageSquare className="h-5 w-5 md:h-6 md:w-6" />,
      label: "Messages",
    },
  ];

  const isActive = (href: string) =>
    pathname === href || (href !== "/" && pathname.startsWith(href));

  const NavBtn = ({ item }: { item: NavItem }) => {
    const active = isActive(item.href);
    return (
      <Link
        href={item.href}
        aria-label={item.label}
        className={`flex h-12 items-center justify-center transition-colors md:h-14 ${
          active ? "text-chrome" : "text-silver/70 hover:text-white"
        }`}
      >
        {item.icon}
      </Link>
    );
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-[60] px-3 md:hidden"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 12px)" }}
      aria-label="Primary navigation"
    >
      <div className="mx-auto grid max-w-sm grid-cols-6 items-center rounded-3xl border border-white/10 bg-[#0e1422]/95 px-2 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.45)] backdrop-blur-xl">
        {leftItems.map((item) => (
          <NavBtn key={item.href} item={item} />
        ))}
        <button
          type="button"
          onClick={() => setMapOpen(true)}
          aria-label="Items near you"
          className="flex h-12 items-center justify-center text-silver/70 transition-colors hover:text-white"
        >
          <MapIcon className="h-5 w-5" />
        </button>
        <Link
          href="/create"
          aria-label="Create listing"
          className="flex items-center justify-center"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[linear-gradient(135deg,#00b37a_0%,#00ffa3_55%,#00e5ff_100%)] text-black shadow-[0_4px_16px_rgba(0,255,163,0.4)] transition-transform hover:scale-105">
            <Plus className="h-6 w-6" strokeWidth={2.6} />
          </span>
        </Link>
        <Link
          href="/cart"
          aria-label="Cart"
          className={`relative flex h-12 items-center justify-center transition-colors ${
            isActive("/cart") ? "text-chrome" : "text-silver/70 hover:text-white"
          }`}
        >
          <ShoppingCart className="h-5 w-5" />
          {cartCount > 0 && (
            <span className="absolute right-1.5 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#00ffa3] px-1 text-[9px] font-bold text-black">
              {cartCount > 9 ? "9+" : cartCount}
            </span>
          )}
        </Link>
        {rightItems.map((item) => (
          <NavBtn key={item.href} item={item} />
        ))}
      </div>
      <NearbyMap open={mapOpen} onClose={() => setMapOpen(false)} />
    </nav>
  );
}
