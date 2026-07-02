"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Store,
  PlusSquare,
  Heart,
  MessageSquare,
  Info,
  Tag,
  Receipt,
  Bell,
  Wallet,
  LayoutGrid,
} from "lucide-react";
import { useHashpackWallet } from "../lib/hashpackWallet";
import { useSignInModal } from "../lib/signInModal";
import { useTopBarSlotFilled, useTopBarSlotRef } from "../lib/topBar";
import { cn } from "../lib/utils";
import { Footer } from "./Footer";
import { ProfileCardSheet } from "./ProfileCardSheet";
import { MessagesModal } from "./MessagesModal";

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
  if (pathname.startsWith("/admin")) return "Admin";
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

  const items = useMemo<NavItem[]>(() => {
    return [
      { label: "Marketplace", href: "/marketplace", icon: <Store className="h-5 w-5" /> },
      { label: "Categories", href: "/categories", icon: <LayoutGrid className="h-5 w-5" /> },
      { label: "Create Listing", href: "/create", icon: <PlusSquare className="h-5 w-5" /> },
      ...(effectiveConnected
        ? [
            { label: "Offers", href: "/offers", icon: <Tag className="h-5 w-5" /> },
            { label: "Purchases", href: "/purchases", icon: <Receipt className="h-5 w-5" /> },
            { label: "Watchlist", href: "/watchlist", icon: <Heart className="h-5 w-5" /> },
            {
              label: "Messages",
              onClick: () => setMessagesOpen(true),
              icon: <MessageSquare className="h-5 w-5" />,
            },
          ]
        : []),
      { label: "Support", href: "/support", icon: <Info className="h-5 w-5" /> },
    ];
  }, [effectiveConnected]);

  const fallbackTitle = pathnameTitle(pathname);
  const showFooter = pathname === "/marketplace" || pathname.startsWith("/marketplace");

  return (
    <div className="flex min-h-screen flex-col md:h-screen md:min-h-0 md:overflow-hidden">
      {/* Top bar — desktop only. Borderless; floats on canvas. */}
      <header className="sticky top-0 z-20 hidden h-14 shrink-0 items-center gap-3 bg-transparent px-3 md:flex">
        {/* Logo + horizontal nav strip (replaces the old left rail). */}
        <Link
          href="/marketplace"
          className="flex h-10 w-10 shrink-0 items-center justify-center"
          aria-label="Hashpop home"
          title="Hashpop"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/hashpop-cart-3d.PNG" alt="" className="h-7 w-auto object-contain" />
        </Link>
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

        {/* Title region. The slot host stays empty so portal children don't
            coexist with the fallback. */}
        <div className="ml-2 flex min-w-0 items-center gap-3 text-base font-semibold tracking-tight text-white">
          <div ref={titleSlotRef} className="flex min-w-0 items-center" />
          {!titleFilled && fallbackTitle && <span>{fallbackTitle}</span>}
        </div>

        {/* Center slot — typically a search input + filter dropdown. */}
        <div
          ref={centerSlotRef}
          className="flex flex-1 items-center justify-center"
          data-topbar-slot="center"
        />

        {/* Right cluster: page actions slot, alerts, account chip. */}
        <div className="flex items-center gap-2">
          <div ref={actionsSlotRef} className="flex items-center gap-2" data-topbar-slot="actions" />
          <Link
            href="/activity"
            className="flex h-9 w-9 items-center justify-center rounded-glass text-neutral-300 hover:bg-white/5 hover:text-white"
            aria-label="Activity"
          >
            <Bell className="h-4 w-4" />
          </Link>
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

      {/* Content area: rounded canvas on desktop, full-bleed on mobile.
          Mobile gets bottom padding so content clears the floating BottomNav.
          Desktop has no bottom nav, so just standard internal padding. */}
      <main className="flex min-h-[100dvh] flex-col pb-24 md:min-h-0 md:flex-1 md:px-3 md:pb-3 md:pt-1">
        <div className="scrollbar-none flex flex-1 flex-col md:h-full md:min-h-0 md:overflow-y-auto md:rounded-glass-lg md:border md:border-white/10 md:bg-[#0e1422]/60">
          {/* Content takes the available height so the footer (marketplace
              only) stays pinned to the bottom. Every other route is
              app-like — no footer, no extra scroll. */}
          <div className="flex-1">{children}</div>
          {showFooter && <Footer />}
        </div>
      </main>

      {/* Desktop overlays: profile card + messages, so these flows never
          navigate away from the current page. */}
      <ProfileCardSheet open={profileOpen} onClose={() => setProfileOpen(false)} />
      <MessagesModal open={messagesOpen} onClose={() => setMessagesOpen(false)} />
    </div>
  );
}
