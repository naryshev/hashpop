"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletButton } from "./WalletButton";
import { Logo } from "./Logo";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/marketplace", label: "Browse" },
  { href: "/create", label: "Sell" },
  { href: "/dashboard", label: "Dashboard" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-black/80 backdrop-blur-[20px]">
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Logo />
        <div className="flex items-center gap-1 sm:gap-2">
          {navLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`rounded-glass px-3 py-2 text-sm font-medium transition-all duration-200 ${
                pathname === href
                  ? "bg-white/10 text-white border-white/15 shadow-inner"
                  : "text-silver hover:bg-white/5 hover:text-white border-transparent"
              }`}
            >
              {label}
            </Link>
          ))}
          <WalletButton />
        </div>
      </nav>
    </header>
  );
}
