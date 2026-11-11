"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Footer } from "./Footer";
import { MarketplaceBrandHeader } from "./MarketplaceBrandHeader";
import { MarketplaceDesktopHeader } from "./MarketplaceDesktopHeader";

/**
 * Site chrome for every consumer route. Desktop (≥768) always shows the
 * marketplace slim header: wordmark left, centered "Search marketplace…",
 * then Create, cart, bell, and profile. `/` and `/marketplace` render that
 * header themselves (their search filters in place); every other route gets
 * it here and its search submits to the marketplace. The old compact bar
 * (cart icon, "Search listings", icon row, Sign in pill) is gone.
 */
export function DesktopShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  const showFooter =
    pathname === "/" ||
    pathname === "/about" ||
    pathname === "/marketplace" ||
    pathname.startsWith("/marketplace");
  // `/` and `/marketplace` paint MarketplaceDesktopHeader inside the page so
  // the search field drives the grid directly. Every other route gets the
  // same header from the shell.
  const marketplaceHome = pathname === "/" || pathname === "/marketplace";

  // Mobile page header lives here in the shell — OUTSIDE the route-keyed fade
  // wrapper below — so it stays put on page switches while the content still
  // eases in. Marketplace renders its own mobile header (brand row + search).
  // Cart, Messages, Purchases, Offers, Create, My Hashpop, About, profile,
  // Terms, and Privacy share that same brand row (no search or filter). The
  // top inset is hp-brand-safe-top. Focused screens (listing, order,
  // activity…) keep their own back-button chrome on mobile.
  const MOBILE_HEADER_ROUTES = [
    "/cart",
    "/messages",
    "/purchases",
    "/offers",
    "/create",
    "/dashboard",
    "/about",
  ];
  const profileRoute = pathname.startsWith("/profile/");
  const legalRoute = pathname === "/terms" || pathname === "/privacy";
  const showMobileHeader = MOBILE_HEADER_ROUTES.includes(pathname) || profileRoute || legalRoute;
  const isAdminRoute = pathname.startsWith("/admin") || pathname.startsWith("/area51");
  // Full-screen surfaces (open message thread) hide all chrome.
  const [immersive, setImmersive] = useState(false);
  useEffect(() => {
    const onImmersive = (e: Event) => setImmersive(!!(e as CustomEvent).detail);
    window.addEventListener("hashpop:immersive", onImmersive);
    return () => window.removeEventListener("hashpop:immersive", onImmersive);
  }, []);

  // Admin owns its own rail + top bar. Consumer marketplace chrome (and the
  // floating dock) must not leak onto /admin — especially the non-admin stub.
  if (isAdminRoute) {
    return <div className="min-h-[100dvh] bg-bg">{children}</div>;
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Shared marketplace slim bar on every non-marketplace route. Search
          submits to the marketplace. Hidden below md (hp-desktop-bar), so
          mobile chrome is unchanged. */}
      {!marketplaceHome && (
        <MarketplaceDesktopHeader
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          onSearchSubmit={(event) => {
            event.preventDefault();
            const q = searchQuery.trim();
            router.push(q ? `/marketplace?q=${encodeURIComponent(q)}` : "/marketplace");
            setSearchQuery("");
          }}
        />
      )}

      {/* Content area: seamless full-bleed page on both viewports — no
          bordered center card. Mobile gets bottom padding so content clears
          the floating BottomNav; the document itself scrolls. */}
      <main className="flex min-h-[100dvh] flex-1 flex-col pb-24 md:min-h-0 md:pb-0">
        {showMobileHeader && !immersive && (
          // Top inset lives on MarketplaceBrandHeader (hp-brand-safe-top).
          // Desktop uses MarketplaceDesktopHeader, so this row stays mobile-only.
          <div className="px-3 md:hidden">
            <MarketplaceBrandHeader />
          </div>
        )}
        {/* Content takes the available height so the footer (marketplace
            and /about, both viewports) stays pinned to the bottom. Keyed on
            pathname so each route change eases in gently instead of snapping. */}
        <div key={pathname} className="flex-1 animate-[fadeSlideUp_0.5s_ease-out]">
          {children}
        </div>
        {showFooter && <Footer />}
      </main>
    </div>
  );
}
