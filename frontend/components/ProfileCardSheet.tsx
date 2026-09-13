"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  ChevronLeft,
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
import { ProfileContent } from "./ProfileContent";
import DashboardPage from "../app/dashboard/page";
import { Sheet } from "./ui/Sheet";
import { material } from "../lib/materials";
import { cn } from "../lib/utils";

type View = "menu" | "profile" | "hashpop";

const menuRow =
  "flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] font-medium text-white transition-colors hover:bg-white/5";

/**
 * Slide-up profile card (bottom sheet) opened from the wallet chip in the
 * mobile marketplace header. Profile / My Hashpop / Purchases render as
 * sub-views *inside* the sheet (with a back button) rather than navigating
 * away, so it stays a self-contained popup.
 */
export function ProfileCardSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { address, accountId, disconnect } = useHashpackWallet();
  const profile = useProfile(address ?? accountId ?? null);
  const [view, setView] = useState<View>("menu");

  useEffect(() => {
    if (open) setView("menu");
  }, [open]);

  const apiAddr = (address ?? accountId ?? "").toString();

  const name = profileDisplayName(profile);
  const avatar = profileAvatarUrl(profile);
  const acct = accountId ?? address ?? "";
  const hasRating = profile && profile.ratingCount > 0 && profile.ratingAverage != null;

  const titles: Record<View, string> = {
    menu: "",
    profile: "Profile",
    hashpop: "My Hashpop",
  };

  const handleDismiss = () => {
    if (view === "menu") onClose();
    else setView("menu");
  };

  return (
    <Sheet
      open={open}
      onClose={handleDismiss}
      detent="large"
      ariaLabel="Your profile"
      title={view === "menu" ? undefined : titles[view]}
      className={
        view === "hashpop"
          ? "md:h-[85vh] md:max-w-6xl"
          : view === "profile"
            ? "md:max-w-2xl"
            : undefined
      }
      leading={
        view !== "menu" ? (
          <button
            type="button"
            onClick={() => setView("menu")}
            aria-label="Back"
            className="flex h-8 w-8 items-center justify-center rounded-full text-silver hover:bg-white/10 hover:text-white"
          >
            <ChevronLeft size={20} />
          </button>
        ) : undefined
      }
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
      {view === "menu" && (
        <>
          <button
            type="button"
            onClick={() => setView("profile")}
            className="flex w-full items-center gap-3 text-left"
          >
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
          </button>

          <div className={cn("my-4 border-t", material.hairline)} />

          <div className="space-y-0.5">
            <button type="button" onClick={() => setView("profile")} className={menuRow}>
              <UserCircle size={20} className="text-silver" /> View profile
            </button>
            <button type="button" onClick={() => setView("hashpop")} className={menuRow}>
              <LayoutDashboard size={20} className="text-silver" /> My Hashpop
            </button>
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
        </>
      )}

      {view === "profile" && apiAddr && (
        <div className="-mx-5 pb-2">
          <ProfileContent address={apiAddr} embedded />
        </div>
      )}

      {view === "hashpop" && (
        <div className="-mx-5 pb-2">
          <DashboardPage />
        </div>
      )}
    </Sheet>
  );
}
