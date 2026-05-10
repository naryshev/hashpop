"use client";

import { useMemo } from "react";
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
      className="pointer-events-none absolute left-12 top-1/2 -translate-y-1/2 z-50 whitespace-nowrap rounded-glass border border-white/10 bg-[#15181f] px-2 py-1 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100"
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
 * Desktop chrome (icon rail + top bar). Hidden on mobile via `md:flex`.
 * Renders `children` inside a rounded card that mimics Railway's project
 * canvas. The same children should NOT be rendered elsewhere — this is the
 * single layout host. On mobile, the chrome collapses and content goes
 * full-bleed with the existing top BottomNav.
 */
export function DesktopShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isConnected, accountId, address, disconnect } = useHashpackWallet();
  const { openSignIn } = useSignInModal();
  const appVersion = process.env.NEXT_PUBLIC_APP_VERSION?.trim() || "v1.0.0";

  const items = useMemo<RailItem[]>(() => {
    return [
      { label: "Marketplace", href: "/marketplace", icon: <Store className="h-5 w-5" /> },
      ...(isConnected
        ? [
            {
              label: "My Hashpop",
              href: "/dashboard",
              icon: <LayoutDashboard className="h-5 w-5" />,
            },
          ]
        : []),
      { label: "Create Listing", href: "/create", icon: <PlusSquare className="h-5 w-5" /> },
      ...(isConnected
        ? [
            { label: "Offers", href: "/offers", icon: <Tag className="h-5 w-5" /> },
            { label: "Purchases", href: "/purchases", icon: <Receipt className="h-5 w-5" /> },
          ]
        : []),
      { label: "Watchlist", href: "/watchlist", icon: <Heart className="h-5 w-5" /> },
      { label: "Messages", href: "/messages", icon: <MessageSquare className="h-5 w-5" /> },
      { label: "Support", href: "/support", icon: <LifeBuoy className="h-5 w-5" /> },
    ];
  }, [isConnected]);

  return (
    <div className="flex min-h-screen">
      {/* Left icon rail — desktop only */}
      <aside
        className="sticky top-0 z-30 hidden h-screen w-16 shrink-0 flex-col items-center justify-between border-r border-white/10 bg-[#0a101c]/95 py-4 md:flex"
        aria-label="Primary navigation"
      >
        <div className="flex flex-col items-center gap-1">
          <Link
            href="/marketplace"
            className="mb-3 flex h-10 w-10 items-center justify-center"
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
          {isConnected ? (
            <RailButton label="Sign out" onClick={() => void disconnect()}>
              <LogOut className="h-5 w-5" />
            </RailButton>
          ) : (
            <RailButton label="Sign in" onClick={() => openSignIn()}>
              <LogIn className="h-5 w-5" />
            </RailButton>
          )}
          <p className="text-[10px] font-medium text-neutral-500" title={`App ${appVersion}`}>
            {appVersion}
          </p>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar — desktop only */}
        <header className="sticky top-0 z-20 hidden h-14 items-center justify-between border-b border-white/10 bg-[#0a101c]/90 px-4 backdrop-blur-md md:flex">
          <Link
            href="/marketplace"
            className="flex items-center gap-2 rounded-glass px-2 py-1 hover:bg-white/5"
          >
            <span className="bg-[linear-gradient(100deg,#ff2f3d_0%,#ff8f00_32%,#13a0ff_62%,#6ddf85_100%)] bg-clip-text text-base font-extrabold tracking-tight text-transparent">
              hashpop
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/messages"
              className="flex h-9 w-9 items-center justify-center rounded-glass text-neutral-300 hover:bg-white/5 hover:text-white"
              aria-label="Messages"
            >
              <Bell className="h-4 w-4" />
            </Link>
            {isConnected ? (
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

        {/* Content area: rounded canvas on desktop, full-bleed on mobile.
            Mobile gets top padding to clear the fixed BottomNav (which
            renders as a top bar on small screens). */}
        <main className="flex-1 pt-14 md:p-4 md:pt-4">
          <div className="md:min-h-[calc(100vh-3.5rem-2rem)] md:rounded-glass-lg md:border md:border-white/10 md:bg-[#0e1422]/60 md:backdrop-blur-glass">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
