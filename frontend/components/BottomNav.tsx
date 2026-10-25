"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Map as MapIcon, MessageSquare, Plus, ShoppingCart, Store } from "lucide-react";
import { useCart } from "../lib/cart";
import { useUnreadCount } from "../hooks/useUnreadCount";
import { hrefWithoutNearbyView, isNearbyView } from "../lib/nearbyView";
import { TabBar, type TabBarItem } from "./ui/TabBar";

/** Reads `?view=nearby` under Suspense so the dock itself can still server-render. */
function NearbyFromUrl({
  onOpen,
  searchRef,
}: {
  onOpen: () => void;
  searchRef: { current: string };
}) {
  const searchParams = useSearchParams();
  searchRef.current = searchParams.toString();
  const nearby = isNearbyView(searchParams);
  useEffect(() => {
    if (nearby) onOpen();
  }, [nearby, onOpen]);
  return null;
}

/**
 * Mobile primary nav. Owns routing, cart badge, Nearby overlay, and the
 * immersive-hide listener; chrome lives in TabBar so screens cannot fork it.
 */
export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { count: cartCount } = useCart();
  const unreadThreads = useUnreadCount();
  const [mapOpen, setMapOpen] = useState(false);
  const [NearbyMap, setNearbyMap] = useState<typeof import("./NearbyMap").NearbyMap | null>(null);
  const searchRef = useRef("");
  const openNearby = useCallback(() => setMapOpen(true), []);

  useEffect(() => {
    if (!mapOpen || NearbyMap) return;
    let cancelled = false;
    void import("./NearbyMap").then((mod) => {
      if (!cancelled) setNearbyMap(() => mod.NearbyMap);
    });
    return () => {
      cancelled = true;
    };
  }, [mapOpen, NearbyMap]);

  const closeNearby = useCallback(() => {
    setMapOpen(false);
    const current = searchRef.current;
    if (!isNearbyView(new URLSearchParams(current))) return;
    router.replace(hrefWithoutNearbyView(pathname, new URLSearchParams(current)), {
      scroll: false,
    });
  }, [pathname, router]);

  // Full-screen surfaces (an open message thread) hide the bar entirely —
  // their own back button is the only navigation.
  const [immersive, setImmersive] = useState(false);
  useEffect(() => {
    const onImmersive = (e: Event) => setImmersive(!!(e as CustomEvent).detail);
    window.addEventListener("hashpop:immersive", onImmersive);
    return () => window.removeEventListener("hashpop:immersive", onImmersive);
  }, []);

  const isActive = (href: string) =>
    pathname === href ||
    (href === "/marketplace" && pathname === "/") ||
    (href !== "/" && pathname.startsWith(href));

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
      badge: unreadThreads,
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
        hidden={immersive || pathname.startsWith("/admin") || pathname.startsWith("/area51")}
        onSelect={(id) => {
          if (id === "nearby") {
            if (mapOpen) closeNearby();
            else setMapOpen(true);
          } else closeNearby();
        }}
        centerAction={{
          id: "create",
          href: "/create",
          label: "Create listing",
          icon: <Plus className="h-6 w-6" strokeWidth={2.6} />,
        }}
      />
      <Suspense fallback={null}>
        <NearbyFromUrl onOpen={openNearby} searchRef={searchRef} />
      </Suspense>
      {NearbyMap ? <NearbyMap open={mapOpen} onClose={closeNearby} /> : null}
    </>
  );
}
