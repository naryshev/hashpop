"use client";

import Link from "next/link";
import {
  BadgeCheck,
  Info,
  LayoutDashboard,
  LogOut,
  PackageCheck,
  Receipt,
  Tag,
  User,
  UserCircle,
  X,
} from "lucide-react";
import { useHashpackWallet } from "../lib/hashpackWallet";
import { profileAvatarUrl, profileDisplayName, useProfile } from "../lib/profiles";
import { Sheet } from "./ui/Sheet";
import { material } from "../lib/materials";
import { cn } from "../lib/utils";

const menuRow =
  "flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] font-medium text-white transition-colors hover:bg-white/5";

/**
 * Slide-up account menu (bottom sheet) opened from the wallet chip.
 * Identity header + list rows + Sign out — iOS Settings style. Rows close
 * the sheet and navigate; Profile / Dashboard are never nested inside.
 */
export function ProfileCardSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { address, accountId, disconnect } = useHashpackWallet();
  const profile = useProfile(address ?? accountId ?? null);

  const profileKey = (address ?? accountId ?? "").toString();
  const profileHref = profileKey ? `/profile/${encodeURIComponent(profileKey)}` : undefined;

  const name = profileDisplayName(profile);
  const avatar = profileAvatarUrl(profile);
  const acct = accountId ?? address ?? "";
  const hasRating = profile && profile.ratingCount > 0 && profile.ratingAverage != null;

  const identity = (
    <>
      {avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatar}
          alt=""
          className="h-14 w-14 shrink-0 rounded-full border border-hairline object-cover"
        />
      ) : (
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-hairline bg-white/5 text-silver/60">
          <User size={26} />
        </div>
      )}
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-base font-bold text-white">
          <span className="truncate">{name ?? acct}</span>
          {profile?.kycVerified && (
            <BadgeCheck size={15} className="shrink-0 text-chrome" aria-label="Verified" />
          )}
        </div>
        <div className="truncate font-mono text-xs text-silver">{acct}</div>
        {hasRating && (
          <div className="mt-0.5 text-xs text-amber-300/90">
            ★ {profile!.ratingAverage!.toFixed(1)}
            <span className="ml-0.5 text-silver/60">({profile!.ratingCount})</span>
          </div>
        )}
      </div>
    </>
  );

  return (
    <Sheet
      open={open}
      onClose={onClose}
      detent="medium"
      ariaLabel="Your profile"
      trailing={
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-8 w-8 items-center justify-center rounded-full text-silver hover:bg-white/10 hover:text-white"
        >
          <X size={18} />
        </button>
      }
    >
      {profileHref ? (
        <Link
          href={profileHref}
          onClick={onClose}
          className="flex w-full items-center gap-3 text-left"
        >
          {identity}
        </Link>
      ) : (
        <div className="flex w-full items-center gap-3 text-left">{identity}</div>
      )}

      <div className={cn("my-4 border-t", material.hairline)} />

      <div className="space-y-0.5">
        {profileHref ? (
          <Link href={profileHref} onClick={onClose} className={menuRow}>
            <UserCircle size={20} className="text-silver" /> View profile
          </Link>
        ) : (
          <span className={cn(menuRow, "pointer-events-none opacity-50")}>
            <UserCircle size={20} className="text-silver" /> View profile
          </span>
        )}
        <Link href="/dashboard" onClick={onClose} className={menuRow}>
          <LayoutDashboard size={20} className="text-silver" /> My Hashpop
        </Link>
        <Link href="/purchases" onClick={onClose} className={menuRow}>
          <Receipt size={20} className="text-silver" /> Purchases
        </Link>
        <Link href="/offers" onClick={onClose} className={menuRow}>
          <Tag size={20} className="text-silver" /> Offers
        </Link>
        <Link href="/purchases?tab=sold" onClick={onClose} className={menuRow}>
          <PackageCheck size={20} className="text-silver" /> Sold items
        </Link>
        <Link href="/help" onClick={onClose} className={menuRow}>
          <Info size={20} className="text-silver" /> Help &amp; support
        </Link>
      </div>

      <div className={cn("my-3 border-t", material.hairline)} />

      <button
        type="button"
        onClick={() => {
          onClose();
          void disconnect();
        }}
        className="mb-2 flex min-h-11 w-full items-center gap-3 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 text-left text-[15px] font-semibold text-rose-300 transition-colors hover:bg-rose-500/20"
      >
        <LogOut size={20} />
        Sign out
      </button>
    </Sheet>
  );
}
