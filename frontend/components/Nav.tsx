"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletButton } from "./WalletButton";
import { Logo } from "./Logo";

const navLinks = [
  { href: "/marketplace", label: "Browse" },
  { href: "/create", label: "Sell" },
  { href: "/dashboard", label: "Dashboard" },
];

export function Nav() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => setMounted(true), []);

  const closeMenu = () => {
    setMenuOpen(false);
    requestAnimationFrame(() => menuButtonRef.current?.focus());
  };

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/80 backdrop-blur-[20px]">
        <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Logo />
          {/* Desktop: full nav + wallet (wallet only after mount to avoid hydration mismatch) */}
          <div className="hidden md:flex items-center gap-1 sm:gap-2">
            {navLinks.map(({ href, label }) => {
              const isActive = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`rounded-glass px-3 py-2 text-sm font-medium transition-all duration-200 ${
                    isActive ? "bg-white/10 text-white border-white/15 shadow-inner" : "text-silver hover:bg-white/5 hover:text-white border-transparent"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
            {mounted && <WalletButton />}
          </div>
          {/* Mobile: hamburger only (no cart icon) */}
          <div className="flex md:hidden items-center gap-2">
            <button
              ref={menuButtonRef}
              type="button"
              onClick={() => setMenuOpen(true)}
              className="p-2 rounded-lg text-silver hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Open menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </nav>
      </header>

      {/* Mobile slide-out menu */}
      <div
        className={`fixed inset-0 z-50 md:hidden transition-opacity duration-200 ${menuOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        aria-hidden={!menuOpen}
      >
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={closeMenu}
          aria-hidden
        />
        <div
          className={`absolute top-0 left-0 w-[min(280px,85vw)] h-full bg-[var(--bg)] border-r border-white/10 shadow-xl flex flex-col transition-transform duration-300 ease-out ${menuOpen ? "translate-x-0" : "-translate-x-full"}`}
        >
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <Logo />
            <button
              type="button"
              onClick={closeMenu}
              className="p-2 rounded-lg text-silver hover:text-white hover:bg-white/10"
              aria-label="Close menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-1">
            {navLinks.map(({ href, label }) => {
              const isActive = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={closeMenu}
                  className={`block rounded-glass px-4 py-3 text-sm font-medium transition-colors ${
                    isActive ? "bg-white/10 text-white" : "text-silver hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </div>
          <div className="p-4 border-t border-white/10">
            {mounted && <WalletButton onConnectPress={closeMenu} />}
          </div>
        </div>
      </div>
    </>
  );
}
