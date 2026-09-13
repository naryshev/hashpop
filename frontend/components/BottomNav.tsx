"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Map as MapIcon, MessageSquare, Plus, ShoppingCart, Store } from "lucide-react";
import { useCart } from "../lib/cart";
import { NearbyMap } from "./NearbyMap";
import { TabBar, type TabBarItem } from "./ui/TabBar";

/**
 * Mobile primary nav. Owns routing, cart badge, Nearby overlay, and the
 * immersive-hide listener; chrome lives in TabBar so screens cannot fork it.
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

  const isActive = (href: string) =>
    pathname === href || (href !== "/" && pathname.startsWith(href));

  const items: TabBarItem[] = [
    {
      id: "marketplace",
      href: "/marketplace",
      label: "Marketplace",
      icon: <Store className="h-6 w-6" />,
    },
    {
      id: "nearby",
      label: "Nearby",
      icon: <MapIcon className="h-6 w-6" />,
    },
    {
      id: "cart",
      href: "/cart",
      label: "Cart",
      icon: <ShoppingCart className="h-6 w-6" />,
      badge: cartCount,
    },
    {
      id: "messages",
      href: "/messages",
      label: "Messages",
      icon: <MessageSquare className="h-6 w-6" />,
    },
  ];

  const activeId = mapOpen
    ? "nearby"
    : isActive("/marketplace")
      ? "marketplace"
      : isActive("/cart")
        ? "cart"
        : isActive("/messages")
          ? "messages"
          : undefined;

  return (
    <>
      <TabBar
        items={items}
        activeId={activeId}
        hidden={immersive}
        onSelect={(id) => {
          if (id === "nearby") setMapOpen((open) => !open);
          else setMapOpen(false);
        }}
        centerAction={{
          id: "create",
          href: "/create",
          label: "Create listing",
          icon: <Plus className="h-6 w-6" strokeWidth={2.6} />,
        }}
      />
      <NearbyMap open={mapOpen} onClose={() => setMapOpen(false)} />
    </>
  );
}
