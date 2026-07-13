"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Map as MapIcon, MessageSquare, Plus, ShoppingCart, Store } from "lucide-react";
import { useCart } from "../lib/cart";
import { NearbyMap } from "./NearbyMap";

type NavItem = {
  href: string;
  icon: React.ReactNode;
  label: string;
};

/**
 * Floating bottom navigation bar shown on mobile. Five cells: Marketplace and
 * Map on the left, the Create FAB in the middle, then Cart (with a count
 * badge) and Messages. Profile lives in the wallet chip at the top of the
 * marketplace, not here. Labels are dropped — each cell is an icon-only tap
 * target.
 */
export function BottomNav() {
  const pathname = usePathname();
  const { count: cartCount } = useCart();
  const [mapOpen, setMapOpen] = useState(false);

  // Full-screen surfaces (an open message thread) hide the bar entirely —
  // their own back button is the only navigation.
  const [immersive, setImmersive] = useState(false);
  useEffect(() => {
    const onImmersive = (e: Event) => setImmersive(!!(e as CustomEvent).detail);
    window.addEventListener("hashpop:immersive", onImmersive);
    return () => window.removeEventListener("hashpop:immersive", onImmersive);
  }, []);

  const leftItems: NavItem[] = [
    {
      href: "/marketplace",
      icon: <Store className="h-5 w-5 md:h-6 md:w-6" />,
      label: "Marketplace",
    },
  ];

  const rightItems: NavItem[] = [
    {
      href: "/messages",
      icon: <MessageSquare className="h-5 w-5 md:h-6 md:w-6" />,
      label: "Messages",
    },
  ];

  const isActive = (href: string) =>
    pathname === href || (href !== "/" && pathname.startsWith(href));

  const NavBtn = ({ item }: { item: NavItem }) => {
    const active = isActive(item.href) && !mapOpen;
    return (
      <Link
        href={item.href}
        aria-label={item.label}
        onClick={() => setMapOpen(false)}
        className={`flex h-12 items-center justify-center transition-colors md:h-14 ${
          active ? "text-chrome" : "text-silver/70 hover:text-white"
        }`}
      >
        {item.icon}
      </Link>
    );
  };

  if (immersive) return null;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-[60] px-3 md:hidden"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 12px)" }}
      aria-label="Primary navigation"
    >
      <div className="mx-auto grid max-w-sm grid-cols-5 items-center rounded-3xl border border-white/10 bg-[#0e1422]/95 px-2 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.45)] backdrop-blur-xl">
        {leftItems.map((item) => (
          <NavBtn key={item.href} item={item} />
        ))}
        <button
          type="button"
          onClick={() => setMapOpen((o) => !o)}
          aria-label="Items near you"
          className={`flex h-12 items-center justify-center transition-colors ${
            mapOpen ? "text-chrome" : "text-silver/70 hover:text-white"
          }`}
        >
          <MapIcon className="h-5 w-5" />
        </button>
        <Link
          href="/create"
          aria-label="Create listing"
          onClick={() => setMapOpen(false)}
          className="flex items-center justify-center"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[linear-gradient(135deg,#00b37a_0%,#00ffa3_55%,#00e5ff_100%)] text-black shadow-[0_4px_16px_rgba(0,255,163,0.4)] transition-transform hover:scale-105">
            <Plus className="h-6 w-6" strokeWidth={2.6} />
          </span>
        </Link>
        <Link
          href="/cart"
          aria-label="Cart"
          onClick={() => setMapOpen(false)}
          className={`relative flex h-12 items-center justify-center transition-colors ${
            isActive("/cart") && !mapOpen ? "text-chrome" : "text-silver/70 hover:text-white"
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
