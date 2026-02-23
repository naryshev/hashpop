"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ACCOUNT_LINKS = [
  { href: "/dashboard", label: "Summary" },
  { href: "/offers", label: "Bids & offers" },
  { href: "/watchlist", label: "Watchlist" },
  { href: "/purchases", label: "Purchases" },
  { href: "/messages", label: "Messages" },
  { href: "/selling", label: "Selling" },
];

export function AccountSidebar() {
  const pathname = usePathname();

  return (
    <aside className="glass-card rounded-xl p-3">
      <h2 className="px-2 pb-2 text-sm font-semibold text-white">My Hashpop</h2>
      <nav className="space-y-1">
        {ACCOUNT_LINKS.map(({ href, label }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                isActive
                  ? "bg-white/10 text-white"
                  : "text-silver hover:bg-white/5 hover:text-white"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
