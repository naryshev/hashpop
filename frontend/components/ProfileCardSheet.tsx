"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { BadgeCheck, LayoutDashboard, LogOut, Receipt, User, UserCircle, X } from "lucide-react";
import { useHashpackWallet } from "../lib/hashpackWallet";
import { profileAvatarUrl, profileDisplayName, useProfile } from "../lib/profiles";

/**
 * Slide-up profile card (bottom sheet) opened from the wallet chip in the
 * mobile marketplace header — mirrors the Uber Eats address sheet pattern.
 * Shows the connected account's avatar/name + quick links.
 */
export function ProfileCardSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { address, accountId, disconnect } = useHashpackWallet();
  const profile = useProfile(address ?? accountId ?? null);
  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState(false);

  useEffect(() => setMounted(true), []);

  // Drive the slide-up transition: mount first, then flip to shown next frame.
  useEffect(() => {
    if (!open) {
      setShown(false);
      return;
    }
    const r = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(r);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!mounted || !open) return null;

  const name = profileDisplayName(profile);
  const avatar = profileAvatarUrl(profile);
  const acct = accountId ?? address ?? "";
  const profileHref = address
    ? `/profile/${encodeURIComponent(address)}`
    : accountId
      ? `/profile/${encodeURIComponent(accountId)}`
      : "/dashboard";
  const hasRating = profile && profile.ratingCount > 0 && profile.ratingAverage != null;

  const NavRow = ({
    href,
    icon,
    label,
    onClick,
  }: {
    href?: string;
    icon: React.ReactNode;
    label: string;
    onClick?: () => void;
  }) => {
    const cls =
      "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-white transition-colors hover:bg-white/5";
    const inner = (
      <>
        <span className="text-silver">{icon}</span>
        {label}
      </>
    );
    if (href) {
      return (
        <Link href={href} onClick={onClose} className={cls}>
          {inner}
        </Link>
      );
    }
    return (
      <button type="button" onClick={onClick} className={cls}>
        {inner}
      </button>
    );
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[130] flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Your profile"
    >
      <div
        className={`absolute inset-0 bg-black/60 transition-opacity duration-300 ${
          shown ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />
      <div
        className={`relative w-full max-w-md rounded-t-3xl border border-white/10 bg-[#12161f] p-5 pb-8 shadow-[0_-12px_40px_rgba(0,0,0,0.5)] transition-transform duration-300 ease-out ${
          shown ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 24px)" }}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/15" />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-silver hover:bg-white/10 hover:text-white"
        >
          <X size={18} />
        </button>

        {/* Identity */}
        <Link href={profileHref} onClick={onClose} className="flex items-center gap-3">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatar}
              alt=""
              className="h-14 w-14 shrink-0 rounded-full border border-white/10 object-cover"
            />
          ) : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-silver/60">
              <User size={26} />
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-base font-bold text-white">
              <span className="truncate">{name ?? "Hashpop trader"}</span>
              {profile?.kycVerified && (
                <BadgeCheck size={15} className="shrink-0 text-[#00ffa3]" aria-label="Verified" />
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
        </Link>

        <div className="my-4 border-t border-white/10" />

        {/* Quick links */}
        <div className="space-y-0.5">
          <NavRow href={profileHref} icon={<UserCircle size={18} />} label="View profile" />
          <NavRow href="/dashboard" icon={<LayoutDashboard size={18} />} label="My Hashpop" />
          <NavRow href="/purchases" icon={<Receipt size={18} />} label="Purchases" />
        </div>

        <div className="my-3 border-t border-white/10" />

        <button
          type="button"
          onClick={() => {
            onClose();
            void disconnect();
          }}
          className="flex w-full items-center gap-3 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-3 text-left text-sm font-semibold text-rose-300 transition-colors hover:bg-rose-500/20"
        >
          <LogOut size={18} />
          Sign out
        </button>
      </div>
    </div>,
    document.body,
  );
}
