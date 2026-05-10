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
  LifeBuoy,
  LogIn,
  LogOut,
  Tag,
  Receipt,
  Bell,
  Wallet,
} from "lucide-react";
import { useHashpackWallet } from "../lib/hashpackWallet";
import { useSignInModal } from "../lib/signInModal";
import { useTopBarSlotRef } from "../lib/topBar";
import { cn } from "../lib/utils";

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
  if (pathname.startsWith("/listing")) return "Listing";
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

  const items = useMemo<RailItem[]>(() => {
    return [
      { label: "Marketplace", href: "/marketplace", icon: <Store className="h-5 w-5" /> },
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
          ]
        : []),
      { label: "Watchlist", href: "/watchlist", icon: <Heart className="h-5 w-5" /> },
      { label: "Messages", href: "/messages", icon: <MessageSquare className="h-5 w-5" /> },
      { label: "Support", href: "/support", icon: <LifeBuoy className="h-5 w-5" /> },
    ];
  }, [effectiveConnected]);

  const fallbackTitle = pathnameTitle(pathname);

  return (
    <div className="flex min-h-screen">
      {/* Left icon rail — desktop only, no border, floats on the canvas. */}
      <aside
        className="sticky top-0 z-30 hidden h-screen w-16 shrink-0 flex-col items-center justify-between bg-transparent py-3 md:flex"
        aria-label="Primary navigation"
      >
        <div className="flex flex-col items-center gap-1">
          <Link
            href="/marketplace"
            className="mb-2 flex h-10 w-10 items-center justify-center"
            aria-label="Hashpop home"
            title="Hashpop"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/hashpop-cart-3d.PNG" alt="" className="h-7 w-auto object-contain" />
          </Link>
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
        <div className="flex flex-col items-center gap-1">
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
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar — desktop only. Borderless; floats on canvas. */}
        <header className="sticky top-0 z-20 hidden h-14 items-center gap-4 bg-transparent px-2 md:flex">
          {/* Title slot (page-provided or pathname fallback). Mirrors the
              space the wordmark used to occupy in the top-left. */}
          <div className="flex min-w-0 items-center gap-3">
            <div
              ref={titleSlotRef}
              className="flex min-w-0 items-center text-base font-semibold tracking-tight text-white"
            >
              {fallbackTitle}
            </div>
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
              href="/messages"
              className="flex h-9 w-9 items-center justify-center rounded-glass text-neutral-300 hover:bg-white/5 hover:text-white"
              aria-label="Messages"
            >
              <Bell className="h-4 w-4" />
            </Link>
            {effectiveConnected ? (
              <div className="flex items-center gap-2 rounded-glass border border-white/10 bg-white/5 px-3 py-1.5 text-xs">
                <Wallet className="h-3.5 w-3.5 text-chrome" />
                <span className="font-mono text-white/80">
                  {shortAccount(accountId ?? address ?? "")}
                </span>
              </div>
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

        {/* Inner content card. The only bordered element in the chrome.
            Mobile gets full-bleed content with top padding for BottomNav. */}
        <main className="flex-1 pt-14 md:p-3 md:pt-1">
          <div className="md:min-h-[calc(100vh-3.5rem-1.5rem)] md:overflow-hidden md:rounded-glass-lg md:border md:border-white/10 md:bg-[#0e1422]/60 md:backdrop-blur-glass">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
