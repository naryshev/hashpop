"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { useHashpackWallet } from "../lib/hashpackWallet";
import { useSignInModal } from "../lib/signInModal";
import { useUnseenActivity } from "../hooks/useUnseenActivity";
import { ProfileCardSheet } from "./ProfileCardSheet";

/**
 * Mobile page header (demo-video style): Hashpop logo + wordmark on the left,
 * notification bell and the green wallet pill (opens the profile sheet) on
 * the right. Used across mobile pages (marketplace, purchases, offers, cart,
 * create, map) so navigation chrome is consistent everywhere.
 */
export function MobileTopBar({ className = "" }: { className?: string }) {
  const { accountId, address } = useHashpackWallet();
  const { openSignIn } = useSignInModal();
  const hasUnseen = useUnseenActivity();
  const [profileOpen, setProfileOpen] = useState(false);

  const walletLabel =
    accountId ?? (address ? `${address.slice(0, 6)}…${address.slice(-4)}` : null);

  return (
    <>
      <div className={`flex items-center justify-between gap-3 sm:hidden ${className}`}>
        <Link href="/marketplace" className="flex items-center gap-2" aria-label="Hashpop home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/hashpop-cart-3d.PNG" alt="" className="h-7 w-auto object-contain" />
          <span className="text-lg font-extrabold tracking-tight text-[#00ffa3]">Hashpop</span>
        </Link>
        <div className="flex items-center gap-1.5">
          <Link
            href="/activity"
            aria-label="Notifications"
            className="relative rounded-full p-2 text-silver hover:text-white"
          >
            <Bell size={18} />
            {hasUnseen && (
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#00ffa3]" />
            )}
          </Link>
          {walletLabel ? (
            <button
              type="button"
              onClick={() => setProfileOpen(true)}
              aria-label="Open profile"
              className="flex items-center gap-1.5 rounded-full border border-[#00ffa3]/40 bg-[#00ffa3]/[0.06] px-3 py-1.5"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[#00ffa3] shadow-[0_0_4px_rgba(0,255,163,0.8)]" />
              <span className="font-mono text-xs font-semibold text-[#00ffa3]">{walletLabel}</span>
            </button>
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
      <ProfileCardSheet open={profileOpen} onClose={() => setProfileOpen(false)} />
    </>
  );
}
