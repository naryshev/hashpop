"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Store, LayoutDashboard, PlusSquare, Heart, MessageSquare, LifeBuoy, LogIn, UserCircle } from "lucide-react";
import { Sidebar, SidebarBody, SidebarLink } from "./ui/sidebar";
import { cn } from "../lib/utils";
import { useHashpackWallet } from "../lib/hashpackWallet";

type NavLink = {
  label: string;
  href: string;
  icon: JSX.Element;
};

export function AppSidebar() {
  const pathname = usePathname();
  const { isConnected, accountId } = useHashpackWallet();
  const [open, setOpen] = useState(false);
  const appVersion = process.env.NEXT_PUBLIC_APP_VERSION?.trim() || "v1.0.0";

  const links = useMemo<NavLink[]>(
    () => [
      { label: "Home", href: "/", icon: <Home className="h-5 w-5 flex-shrink-0" /> },
      { label: "Marketplace", href: "/marketplace", icon: <Store className="h-5 w-5 flex-shrink-0" /> },
      isConnected
        ? { label: "My Hashpop", href: "/dashboard", icon: <LayoutDashboard className="h-5 w-5 flex-shrink-0" /> }
        : { label: "Sign In", href: "/signin", icon: <LogIn className="h-5 w-5 flex-shrink-0" /> },
      { label: "Create Listing", href: "/create", icon: <PlusSquare className="h-5 w-5 flex-shrink-0" /> },
      { label: "Watchlist", href: "/watchlist", icon: <Heart className="h-5 w-5 flex-shrink-0" /> },
      { label: "Messages", href: "/messages", icon: <MessageSquare className="h-5 w-5 flex-shrink-0" /> },
      { label: "Support", href: "/support", icon: <LifeBuoy className="h-5 w-5 flex-shrink-0" /> },
    ],
    [isConnected]
  );

  return (
    <Sidebar open={open} setOpen={setOpen}>
      <SidebarBody className="justify-between gap-8">
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden">
          <Link href="/marketplace" className="mb-6 inline-flex items-center gap-2 py-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/hashpop-cart-3d.PNG" alt="Hashpop" className="h-7 w-auto object-contain" />
            <span className="bg-[linear-gradient(100deg,#ff2f3d_0%,#ff8f00_32%,#13a0ff_62%,#6ddf85_100%)] bg-clip-text text-lg font-extrabold text-transparent">
              Hashpop
            </span>
          </Link>
          <div className="flex flex-col gap-1">
            {links.map((link) => {
              const active = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href));
              return (
                <SidebarLink
                  key={link.label}
                  link={link}
                  className={cn(
                    "rounded-lg px-2 text-neutral-700 dark:text-neutral-200",
                    active ? "bg-neutral-200/70 dark:bg-white/10" : "hover:bg-neutral-200/50 dark:hover:bg-white/5"
                  )}
                />
              );
            })}
          </div>
        </div>
        {isConnected && accountId ? (
          <div className="flex items-center gap-2 px-2 pb-2">
            <UserCircle className="h-5 w-5 flex-shrink-0 text-neutral-500 dark:text-neutral-400" />
            {open && (
              <p className="text-xs text-neutral-600 dark:text-neutral-300 truncate">{accountId}</p>
            )}
          </div>
        ) : null}
        <div className="border-t border-black/10 dark:border-white/10 pt-3">
          <p className="text-xs text-neutral-600 dark:text-neutral-300 px-2">
            {open ? `App ${appVersion}` : appVersion}
          </p>
        </div>
      </SidebarBody>
    </Sidebar>
  );
}
