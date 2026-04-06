"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { AddressDisplay } from "./AddressDisplay";
import { useHashpackWallet } from "../lib/hashpackWallet";
import { ConnectWalletButton } from "./ConnectWalletButton";

import { getApiUrl } from "../lib/apiUrl";

function formatHbarFromTinybar(value: bigint | null): string {
  if (value === null) return "—";
  const num = Number(value) / 100_000_000;
  if (num >= 1e6) return num.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (num >= 1)
    return num.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 3 });
  return num.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 4 });
}

export function AccountMenu() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [reputation, setReputation] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { address, isConnected, disconnect, isReady, isConnecting, error, balanceTinybar } =
    useHashpackWallet();
  const hbarFormatted = formatHbarFromTinybar(balanceTinybar);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open || !address) return;
    fetch(`${getApiUrl()}/api/user/${encodeURIComponent(address)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setReputation(data?.reputation ?? null))
      .catch(() => setReputation(null));
  }, [open, address]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const showPlaceholder = !mounted;
  const showSignIn = mounted && !isConnected;
  const showDropdown = mounted && isConnected && !!address;

  if (showPlaceholder) {
    return (
      <div className="flex items-center gap-1 text-sm text-silver" suppressHydrationWarning>
        Hi <span className="opacity-0">Sign In</span>
      </div>
    );
  }

  if (showSignIn) {
    return (
      <div className="flex items-center gap-1 text-sm text-silver">
        Hi{" "}
        <ConnectWalletButton className="underline text-white hover:text-chrome disabled:opacity-50 bg-transparent border-0 p-0 min-w-0 shadow-none">
          {!isReady ? "Loading…" : isConnecting ? "Connecting…" : "Sign In"}
        </ConnectWalletButton>
        {error && (
          <span
            className="hidden lg:inline text-[11px] text-amber-400/90 max-w-[280px] truncate"
            title={error}
          >
            ({error})
          </span>
        )}
      </div>
    );
  }

  if (!showDropdown) {
    return (
      <div className="flex items-center gap-1 text-sm text-silver" aria-hidden>
        <span className="opacity-0">Hi</span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative inline-block"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onTouchEnd={(e) => {
          e.preventDefault();
          setOpen((o) => !o);
        }}
        className="flex flex-col items-start gap-0.5 md:flex-row md:items-center md:gap-1.5 text-sm text-silver hover:text-white py-2.5 px-3 -my-2 -mx-1 rounded-lg hover:bg-white/5 min-w-0 cursor-pointer touch-manipulation"
        style={{ WebkitTapHighlightColor: "transparent" }}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <span className="flex items-center gap-1.5 min-w-0">
          Hi <AddressDisplay address={address} className="font-medium text-white" />
          <svg
            className="w-4 h-4 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </span>
        <span className="text-silver text-xs tabular-nums md:hidden mt-0.5">{hbarFormatted} ℏ</span>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-0 pt-1 z-50">
          <div className="min-w-[220px] rounded-lg border border-white/10 bg-[var(--bg)] shadow-xl py-4 px-4">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-white/10 border border-white/10 flex items-center justify-center shrink-0">
                <svg
                  className="w-6 h-6 text-silver"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-white font-semibold truncate" title={address}>
                  <AddressDisplay address={address} />
                </p>
                <p className="text-silver text-sm mt-0.5">
                  <Link
                    href={`/profile/${encodeURIComponent(address)}`}
                    className="underline hover:text-chrome inline-block"
                    onClick={() => setOpen(false)}
                  >
                    View profile
                  </Link>
                  {typeof reputation === "number" && <span className="ml-1">({reputation}⭐)</span>}
                </p>
                <p className="text-silver text-sm tabular-nums mt-1">{hbarFormatted} ℏ</p>
              </div>
            </div>
            <div className="border-t border-white/10 pt-3 space-y-1">
              <Link
                href="/dashboard"
                className="block text-sm text-silver hover:text-white"
                onClick={() => setOpen(false)}
              >
                Account settings
              </Link>
              <button
                type="button"
                onClick={() => {
                  void disconnect();
                  setOpen(false);
                }}
                className="block text-sm text-silver hover:text-white w-full text-left"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
