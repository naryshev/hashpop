"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Store,
  LayoutDashboard,
  PlusSquare,
  Heart,
  MessageSquare,
  Info,
  LogIn,
  LogOut,
  Tag,
  Receipt,
  Bell,
  Wallet,
  LayoutGrid,
  UserCircle,
} from "lucide-react";
import { useHashpackWallet } from "../lib/hashpackWallet";
import { useSignInModal } from "../lib/signInModal";
import { useTopBarSlotFilled, useTopBarSlotRef } from "../lib/topBar";
import { cn } from "../lib/utils";
import { Footer } from "./Footer";

type RailItem = {
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

function RailButton({
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
    "group relative flex h-10 w-10 items-center justify-center rounded-glass text-neutral-300 transition-colors",
    active ? "bg-white/10 text-white" : "hover:bg-white/5 hover:text-white",
  );
  const tooltip = (
    <span
      className="pointer-events-none absolute left-12 top-1/2 z-50 -translate-y-1/2 whitespace-nowrap rounded-glass border border-white/10 bg-[#15181f] px-2 py-1 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100"
      role="tooltip"
    >
      {label}
    </span>
  );
  if (href) {
    return (
      <Link href={href} className={className} aria-label={label}>
        {children}
        {tooltip}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className} aria-label={label}>
      {children}
      {tooltip}
    </button>
  );
}

/**
 * Desktop chrome: borderless icon rail on the left + borderless top bar on
 * top, both floating on the dark canvas. Page content lives in a single
 * rounded, bordered card in the centre — the only visible border in the
 * chrome. Title / centre (search) / actions slots are mounted here and pages
 * portal into them via <TopBarSlot>.
 */
export function DesktopShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isConnected, accountId, address, disconnect } = useHashpackWallet();
  const { openSignIn } = useSignInModal();

  // Defer wallet-dependent UI until after hydration. Without this the rail
  // and top bar render with isConnected=false on the server, then the client
  // swaps in extra nav entries and the wallet chip, which breaks hydration
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

  const profileHref = address || accountId ? `/profile/${encodeURIComponent(address || accountId || "")}` : null;
  const items = useMemo<RailItem[]>(() => {
    return [
      { label: "Marketplace", href: "/marketplace", icon: <Store className="h-5 w-5" /> },
      { label: "Categories", href: "/categories", icon: <LayoutGrid className="h-5 w-5" /> },
      ...(effectiveConnected
        ? [
            {
              label: "My Hashpop",
              href: "/dashboard",
              icon: <LayoutDashboard className="h-5 w-5" />,
            },
          ]
        : []),
      { label: "Create Listing", href: "/create", icon: <PlusSquare className="h-5 w-5" /> },
      ...(effectiveConnected
        ? [
            { label: "Offers", href: "/offers", icon: <Tag className="h-5 w-5" /> },
            { label: "Purchases", href: "/purchases", icon: <Receipt className="h-5 w-5" /> },
            { label: "Watchlist", href: "/watchlist", icon: <Heart className="h-5 w-5" /> },
            { label: "Messages", href: "/messages", icon: <MessageSquare className="h-5 w-5" /> },
          ]
        : []),
      ...(effectiveConnected && profileHref
        ? [{ label: "Profile", href: profileHref, icon: <UserCircle className="h-5 w-5" /> }]
        : []),
    ];
  }, [effectiveConnected, profileHref]);

  const fallbackTitle = pathnameTitle(pathname);
  // On the landing page we keep only the cart logo (top of rail) + the
  // top-right cluster (alerts + sign-in / account). Everything else fades
  // in once the user navigates into the app — e.g. clicks "Browse Listings".
  const chromeRevealed = pathname !== "/";
  const chromeFade = `transition-opacity duration-700 ease-out ${
    chromeRevealed ? "opacity-100" : "pointer-events-none opacity-0"
  }`;
  // The legal/USD disclaimer footer is marketplace-only; every other route is
  // an app-like full-height screen with no footer.
  const showFooter = pathname === "/marketplace" || pathname.startsWith("/marketplace");

  return (
    <div className="flex min-h-screen md:h-screen md:min-h-0 md:overflow-hidden">
      {/* Left icon rail — desktop only, no border, floats on the canvas. */}
      <aside
        className="sticky top-0 z-30 hidden h-screen w-14 shrink-0 flex-col items-center justify-between bg-transparent py-3 md:flex"
        aria-label="Primary navigation"
      >
        <div className="flex flex-col items-center gap-1">
          {/* Cart logo: visible on every route — including the landing page. */}
          <Link
            href="/marketplace"
            className="mb-2 flex h-10 w-10 items-center justify-center"
            aria-label="Hashpop home"
            title="Hashpop"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/hashpop-cart-3d.PNG" alt="" className="h-7 w-auto object-contain" />
          </Link>
          {/* Rail nav fades in once the user leaves the landing page. */}
          <div className={`flex flex-col items-center gap-1 ${chromeFade}`}>
            {items.map((item) => {
              const active =
                !!item.href &&
                (pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href)));
              return (
                <RailButton
                  key={item.label}
                  label={item.label}
                  active={active}
                  href={item.href}
                  onClick={item.onClick}
                >
                  {item.icon}
                </RailButton>
              );
            })}
          </div>
        </div>
        {/* Help + sign-in / sign-out rail buttons fade in with the rest. */}
        <div className={`flex flex-col items-center gap-1 ${chromeFade}`}>
          <RailButton label="Help" href="/support">
            <Info className="h-5 w-5" />
          </RailButton>
          {effectiveConnected ? (
            <RailButton label="Sign out" onClick={() => void disconnect()}>
              <LogOut className="h-5 w-5" />
            </RailButton>
          ) : (
            <RailButton label="Sign in" onClick={() => openSignIn()}>
              <LogIn className="h-5 w-5" />
            </RailButton>
          )}
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col md:h-full md:min-h-0">
        {/* Top bar — desktop only. Borderless; floats on canvas. */}
        <header className="sticky top-0 z-20 hidden h-14 shrink-0 items-center gap-4 bg-transparent px-2 md:flex">
          {/* Title region. The slot host stays empty so portal children
              don't coexist with the fallback. The fallback is a sibling
              shown only when no page has registered a title slot. */}
          <div
            className={`flex min-w-0 items-center gap-3 text-base font-semibold tracking-tight text-white ${chromeFade}`}
          >
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
            <div
              ref={actionsSlotRef}
              className="flex items-center gap-2"
              data-topbar-slot="actions"
            />
            <Link
              href="/activity"
              className="flex h-9 w-9 items-center justify-center rounded-glass text-neutral-300 hover:bg-white/5 hover:text-white"
              aria-label="Activity"
            >
              <Bell className="h-4 w-4" />
            </Link>
            {effectiveConnected ? (
              <Link
                href="/dashboard"
                className="flex items-center gap-2 rounded-glass border border-white/10 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10"
                aria-label="Open My Hashpop"
              >
                <Wallet className="h-3.5 w-3.5 text-chrome" />
                <span className="font-mono text-white/80">
                  {shortAccount(accountId ?? address ?? "")}
                </span>
              </Link>
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
        <main className="flex min-h-[100dvh] flex-col pb-24 md:min-h-0 md:flex-1 md:py-3 md:pb-3 md:pl-1 md:pr-3 md:pt-1">
          <div className="scrollbar-none flex flex-1 flex-col md:h-full md:min-h-0 md:overflow-y-auto md:rounded-glass-lg md:border md:border-white/10 md:bg-[#0e1422]/60">
            {/* Content takes the available height so the footer (marketplace
                only) stays pinned to the bottom. Every other route is
                app-like — no footer, no extra scroll. */}
            <div className="flex-1">{children}</div>
            {showFooter && <Footer />}
          </div>
        </main>
      </div>
    </div>
  );
}
