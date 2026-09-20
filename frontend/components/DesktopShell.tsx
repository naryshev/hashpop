"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Store,
  PlusSquare,
  Heart,
  MessageSquare,
  Info,
  Tag,
  Receipt,
  Wallet,
  LayoutGrid,
  PackageCheck,
  Search as SearchIcon,
  ShoppingCart,
} from "lucide-react";
import { useCart } from "../lib/cart";
import { useUnreadCount } from "../hooks/useUnreadCount";
import { useHashpackWallet } from "../lib/hashpackWallet";
import { useSignInModal } from "../lib/signInModal";
import { useTopBarSlotFilled, useTopBarSlotRef } from "../lib/topBar";
import { cn } from "../lib/utils";
import { Footer } from "./Footer";
import { MobileTopBar } from "./MobileTopBar";
import { ProfileCardSheet } from "./ProfileCardSheet";
import { MessagesModal } from "./MessagesModal";
import { NotificationBell } from "./NotificationBell";
import { DockBadge } from "./ui/DockBadge";
import { formatDockBadgeCount } from "../lib/dockBadge";

type NavItem = {
  label: string;
  href?: string;
  icon: React.ReactNode;
  onClick?: () => void;
};

function shortAccount(value: string | null | undefined): string | null {
  if (!value) return null;
  if (/^\d+\.\d+\.\d+$/.test(value)) return value;
  if (value.startsWith("0x") && value.length > 12) {
    return `${value.slice(0, 6)}…${value.slice(-4)}`;
  }
  return value;
}

/** Map a pathname to a human title. Used when a page doesn't supply its own. */
function pathnameTitle(pathname: string): string {
  if (pathname === "/" || pathname.startsWith("/marketplace")) return "Marketplace";
  if (pathname.startsWith("/dashboard")) return "My Hashpop";
  if (pathname.startsWith("/create")) return "Create Listing";
  if (pathname.startsWith("/offers")) return "Offers";
  if (pathname.startsWith("/purchases")) return "Purchases";
  if (pathname.startsWith("/selling")) return "Selling";
  if (pathname.startsWith("/watchlist")) return "Watchlist";
  if (pathname.startsWith("/messages")) return "Messages";
  if (pathname.startsWith("/support")) return "Support";
  if (pathname.startsWith("/profile")) return "Profile";
  if (pathname.startsWith("/listing")) return "";
  if (pathname.startsWith("/purchase-success")) return "Purchase";
  if (pathname.startsWith("/admin") || pathname.startsWith("/area51")) return "Admin";
  return "";
}

/** Compact icon button for the top nav strip (link or action). */
function TopNavBtn({
  label,
  active,
  href,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  href?: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  const className = cn(
    "flex h-9 w-9 items-center justify-center rounded-glass text-neutral-300 transition-colors",
    active ? "bg-white/10 text-white" : "hover:bg-white/5 hover:text-white",
  );
  if (href) {
    return (
      <Link href={href} className={className} aria-label={label} title={label}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className} aria-label={label} title={label}>
      {children}
    </button>
  );
}

/**
 * Desktop chrome: everything lives in a single top bar — logo, nav icons,
 * page slots, alerts, and the account chip. There is no left rail; the page
 * card below takes the full width so the marketplace stays the focus and
 * content only swaps when a listing (or other route) is opened. Messages and
 * profile open as overlays instead of navigating away.
 */
export function DesktopShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isConnected, accountId, address } = useHashpackWallet();
  const { openSignIn } = useSignInModal();
  const { count: cartCount } = useCart();
  const unreadThreads = useUnreadCount();
  const [profileOpen, setProfileOpen] = useState(false);
  const [messagesOpen, setMessagesOpen] = useState(false);

  // Defer wallet-dependent UI until after hydration. Without this the top bar
  // renders with isConnected=false on the server, then the client swaps in
  // extra nav entries and the wallet chip, which breaks hydration
  // (React errors #418 / #422). After mount we use the real wallet state.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const effectiveConnected = mounted && isConnected;

  const titleSlotRef = useTopBarSlotRef("title");
  const centerSlotRef = useTopBarSlotRef("center");
  const actionsSlotRef = useTopBarSlotRef("actions");
  // Track whether each slot is filled by a page so we can hide the chrome's
  // own fallback content. Slot hosts MUST stay empty — createPortal appends
  // to existing children, which would duplicate fallback + portal content.
  const titleFilled = useTopBarSlotFilled("title");
  // When the current page doesn't provide its own search (only the
  // marketplace does), the chrome renders a fallback search that routes the
  // query to the marketplace — so search never disappears on listing pages.
  const centerFilled = useTopBarSlotFilled("center");
  const router = useRouter();
  const [fallbackQuery, setFallbackQuery] = useState("");

  const items = useMemo<NavItem[]>(() => {
    return [
      { label: "Marketplace", href: "/marketplace", icon: <Store className="h-5 w-5" /> },
      { label: "Categories", href: "/categories", icon: <LayoutGrid className="h-5 w-5" /> },
      { label: "Create Listing", href: "/create", icon: <PlusSquare className="h-5 w-5" /> },
      ...(effectiveConnected
        ? [
            { label: "Offers", href: "/offers", icon: <Tag className="h-5 w-5" /> },
            { label: "Purchases", href: "/purchases", icon: <Receipt className="h-5 w-5" /> },
            {
              label: "Sold",
              href: "/purchases?tab=sold",
              icon: <PackageCheck className="h-5 w-5" />,
            },
            { label: "Watchlist", href: "/watchlist", icon: <Heart className="h-5 w-5" /> },
            {
              label: "Messages",
              onClick: () => setMessagesOpen(true),
              icon: (
                <span className="relative inline-flex">
                  <MessageSquare className="h-5 w-5" />
                  <DockBadge count={unreadThreads} size="compact" />
                </span>
              ),
            },
          ]
        : []),
      { label: "Support", href: "/support", icon: <Info className="h-5 w-5" /> },
    ];
  }, [effectiveConnected, unreadThreads]);

  const fallbackTitle = pathnameTitle(pathname);
  const showFooter = pathname === "/marketplace" || pathname.startsWith("/marketplace");

  // Mobile page header (logo, bell, wallet pill) lives here in the shell —
  // OUTSIDE the route-keyed fade wrapper below — so it stays put on page
  // switches while the content still eases in. Shown on the top-level
  // navigation pages; focused screens (listing, order, activity…) keep
  // their own back-button chrome.
  const MOBILE_HEADER_ROUTES = [
    "/marketplace",
    "/cart",
    "/messages",
    "/purchases",
    "/offers",
    "/create",
  ];
  const showMobileHeader = MOBILE_HEADER_ROUTES.includes(pathname);
  // Full-screen surfaces (open message thread) hide all chrome.
  const [immersive, setImmersive] = useState(false);
  useEffect(() => {
    const onImmersive = (e: Event) => setImmersive(!!(e as CustomEvent).detail);
    window.addEventListener("hashpop:immersive", onImmersive);
    return () => window.removeEventListener("hashpop:immersive", onImmersive);
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      {/* Top bar — desktop only. Sticky with a blurred backdrop so page
          content scrolls beneath it seamlessly. */}
      <header className="sticky top-0 z-20 hidden h-14 shrink-0 items-center gap-3 border-b border-white/5 bg-[#0b111b]/90 px-3 backdrop-blur-xl md:flex">
        {/* Logo, then the page's search (center slot), then the nav strip. */}
        <Link
          href="/marketplace"
          className="flex h-10 w-10 shrink-0 items-center justify-center"
          aria-label="Hashpop home"
          title="Hashpop"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/hashpop-cart-3d.PNG" alt="" className="h-7 w-auto object-contain" />
        </Link>
        <div ref={centerSlotRef} className="flex items-center" data-topbar-slot="center" />
        {!centerFilled && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const q = fallbackQuery.trim();
              router.push(q ? `/marketplace?q=${encodeURIComponent(q)}` : "/marketplace");
              setFallbackQuery("");
            }}
          >
            <div className="flex w-64 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] py-1.5 pl-3 pr-2 transition-colors duration-300 focus-within:border-[#00ffa3]/40">
              <SearchIcon size={14} className="shrink-0 text-silver" />
              <input
                type="text"
                value={fallbackQuery}
                onChange={(e) => setFallbackQuery(e.target.value)}
                placeholder="Search listings"
                className="flex-1 bg-transparent text-sm text-white placeholder:text-silver/50 focus:outline-none"
              />
            </div>
          </form>
        )}
        <nav className="flex items-center gap-0.5" aria-label="Primary navigation">
          {items.map((item) => {
            const active =
              !!item.href &&
              (pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href)));
            return (
              <TopNavBtn
                key={item.label}
                label={item.label}
                active={active}
                href={item.href}
                onClick={item.onClick}
              >
                {item.icon}
              </TopNavBtn>
            );
          })}
        </nav>

        {/* Page context label — a hairline divider + muted title anchors it
            to the nav instead of floating loose in the bar. */}
        <div className="flex min-w-0 items-center gap-3">
          <span aria-hidden className="h-5 w-px shrink-0 bg-white/10" />
          <div ref={titleSlotRef} className="flex min-w-0 items-center" />
          {!titleFilled && fallbackTitle && (
            <span className="truncate text-sm font-medium text-silver">{fallbackTitle}</span>
          )}
        </div>

        <div className="flex-1" />

        {/* Right cluster: page actions slot, alerts, account chip. */}
        <div className="flex items-center gap-2">
          <div
            ref={actionsSlotRef}
            className="flex items-center gap-2"
            data-topbar-slot="actions"
          />
          <Link
            href="/cart"
            className="relative flex h-9 w-9 items-center justify-center rounded-glass text-neutral-300 hover:bg-white/5 hover:text-white"
            aria-label={
              formatDockBadgeCount(cartCount) ? `Cart, ${formatDockBadgeCount(cartCount)}` : "Cart"
            }
          >
            <span className="relative inline-flex">
              <ShoppingCart className="h-4 w-4" />
              <DockBadge count={cartCount} size="compact" />
            </span>
          </Link>
          <NotificationBell variant="desktop" />
          {effectiveConnected ? (
            <button
              type="button"
              onClick={() => setProfileOpen(true)}
              className="flex items-center gap-2 rounded-glass border border-white/10 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10"
              aria-label="Open profile"
            >
              <Wallet className="h-3.5 w-3.5 text-chrome" />
              <span className="font-mono text-white/80">
                {shortAccount(accountId ?? address ?? "")}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => openSignIn()}
              className="rounded-glass border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
            >
              Sign in
            </button>
          )}
        </div>
      </header>

      {/* Content area: seamless full-bleed page on both viewports — no
          bordered center card. Mobile gets bottom padding so content clears
          the floating BottomNav; the document itself scrolls. */}
      <main className="flex min-h-[100dvh] flex-1 flex-col pb-24 md:min-h-0 md:pb-0">
        {showMobileHeader && !immersive && (
          <div className="px-3 pt-4">
            <MobileTopBar />
          </div>
        )}
        {/* Content takes the available height so the footer (marketplace
            only) stays pinned to the bottom. Keyed on pathname so each route
            change eases in gently instead of snapping. */}
        <div key={pathname} className="flex-1 animate-[fadeSlideUp_0.5s_ease-out]">
          {children}
        </div>
        {showFooter && <Footer />}
      </main>

      {/* Desktop overlays: account menu sheet + messages. Menu rows
          close the sheet and navigate; messages stay on-page. */}
      <ProfileCardSheet open={profileOpen} onClose={() => setProfileOpen(false)} />
      <MessagesModal open={messagesOpen} onClose={() => setMessagesOpen(false)} />
    </div>
  );
}
