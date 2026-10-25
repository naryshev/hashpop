"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useHashpackWallet } from "../lib/hashpackWallet";
import { useSignInModal } from "../lib/signInModal";
import { NotificationBell } from "./NotificationBell";
import { profileHref } from "./MarketplaceBrandHeader";

/**
 * Mobile page header (demo-video style): Hashpop logo + wordmark on the left,
 * notification bell and the green wallet pill on the right. The pill goes
 * straight to the signed-in profile. Used on mobile pages that are not the
 * marketplace brand header (purchases, map). Cart, Messages, Offers, and
 * Create use MarketplaceBrandHeader.
 */
export function MobileTopBar({ className = "" }: { className?: string }) {
  const { accountId, address, isConnected } = useHashpackWallet();
  const { openSignIn } = useSignInModal();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const signedIn = mounted && isConnected;
  const href = signedIn ? profileHref(address, accountId) : null;
  const walletLabel = accountId ?? (address ? `${address.slice(0, 6)}…${address.slice(-4)}` : null);

  return (
    <div className={`flex items-center justify-between gap-3 sm:hidden ${className}`}>
      <Link href="/marketplace" className="flex items-center gap-2" aria-label="Hashpop">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/hashpop-cart-3d.PNG" alt="Hashpop" className="h-7 w-auto object-contain" />
        <span className="font-display text-lg font-extrabold tracking-tight text-[#00ffa3]">
          Hashpop
        </span>
      </Link>
      <div className="flex items-center gap-1.5">
        <NotificationBell variant="mobile" />
        {href && walletLabel ? (
          <Link
            href={href}
            aria-label="Open profile"
            className="flex items-center gap-1.5 rounded-full border border-[#00ffa3]/40 bg-[#00ffa3]/[0.06] px-3 py-1.5"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[#00ffa3] shadow-[0_0_4px_rgba(0,255,163,0.8)]" />
            <span className="font-mono text-xs font-semibold text-[#00ffa3]">{walletLabel}</span>
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => openSignIn()}
            aria-label="Sign in"
            className="rounded-full border border-[#00ffa3]/40 bg-[#00ffa3]/[0.06] px-3.5 py-1.5 text-xs font-semibold text-[#00ffa3]"
          >
            Sign in
          </button>
        )}
      </div>
    </div>
  );
}
