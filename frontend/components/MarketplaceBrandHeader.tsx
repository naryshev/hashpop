"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { User } from "lucide-react";
import { useHashpackWallet } from "../lib/hashpackWallet";
import { useSignInModal } from "../lib/signInModal";
import { profileAvatarUrl, useProfile } from "../lib/profiles";
import { material } from "../lib/materials";
import { cn } from "../lib/utils";
import { HashpopWordmark } from "./HashpopWordmark";
import { NotificationBell } from "./NotificationBell";
import { ProfileCardSheet } from "./ProfileCardSheet";

function ProfileAvatarButton() {
  const { accountId, address, isConnected } = useHashpackWallet();
  const { openSignIn } = useSignInModal();
  const [profileOpen, setProfileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const signedIn = mounted && isConnected;
  const profile = useProfile(signedIn ? (address ?? accountId) : null);
  const avatar = signedIn ? profileAvatarUrl(profile) : null;

  return (
    <>
      <button
        type="button"
        data-testid="marketplace-profile"
        aria-label={signedIn ? "Open profile" : "Sign in"}
        onClick={() => (signedIn ? setProfileOpen(true) : openSignIn())}
        className={cn(
          material.chrome,
          "flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full text-white/90",
        )}
      >
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt="" className="h-full w-full object-cover" />
        ) : (
          <User size={20} aria-hidden />
        )}
      </button>
      <ProfileCardSheet open={profileOpen} onClose={() => setProfileOpen(false)} />
    </>
  );
}

/**
 * Marketplace brand row shared by Marketplace, Cart, and Messages.
 * 3-column grid: equal side columns keep the wordmark optically centered,
 * with the bell and glass profile in the right cluster. The subline is the
 * brand label ("marketplace"), not the page name.
 */
export function MarketplaceBrandHeader() {
  return (
    <div
      data-testid="marketplace-brand-header"
      className="grid h-14 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center"
    >
      <div aria-hidden />
      <Link href="/marketplace" aria-label="Hashpop home" className="flex flex-col items-center">
        <HashpopWordmark />
        <span
          data-testid="marketplace-wordmark"
          className="mt-0.5 text-[12px] font-medium lowercase leading-none tracking-[0.12em] text-white/60"
        >
          marketplace
        </span>
      </Link>
      <div className="flex items-center justify-end gap-2">
        <NotificationBell variant="marketplace" />
        <ProfileAvatarButton />
      </div>
    </div>
  );
}
