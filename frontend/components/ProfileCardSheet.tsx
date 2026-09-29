"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion, type PanInfo } from "framer-motion";
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
  ChevronLeft,
  X,
} from "lucide-react";
import { useHashpackWallet } from "../lib/hashpackWallet";
import { profileAvatarUrl, profileDisplayName, useProfile } from "../lib/profiles";
import { notificationsPanelMotion } from "./NotificationsPanel";
import { Sheet } from "./ui/Sheet";
import { material } from "../lib/materials";
import { cn } from "../lib/utils";

const menuRow =
  "flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] font-medium text-white transition-colors hover:bg-white/5";

const DRAG_CLOSE_OFFSET = 80;
const DRAG_CLOSE_VELOCITY = 500;

const iconButton =
  "flex items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-chrome";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusableElements(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.getAttribute("aria-hidden") !== "true" && el.tabIndex >= 0,
  );
}

/** Horizontal swipe-to-dismiss. Same distance and flick thresholds as Sheet. */
export function shouldDismissRightSwipe(offsetX: number, velocityX: number): boolean {
  return offsetX > DRAG_CLOSE_OFFSET || velocityX > DRAG_CLOSE_VELOCITY;
}

type ProfileViewport = "mobile" | "desktop" | "pending";

/** Mobile profile uses the notifications drawer; md+ keeps the centered sheet. */
function useProfileViewport(): ProfileViewport {
  const [mode, setMode] = useState<ProfileViewport>("pending");
  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      setMode("mobile");
      return;
    }
    const query = window.matchMedia("(max-width: 767px)");
    const apply = () => setMode(query.matches ? "mobile" : "desktop");
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);
  return mode;
}

/**
 * Account menu opened from the wallet chip.
 * Mobile is a full-screen panel that enters from the right, matching the
 * notifications drawer. Desktop stays a centered sheet.
 */
export function ProfileCardSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { address, accountId, disconnect } = useHashpackWallet();
  const profile = useProfile(address ?? accountId ?? null);
  const viewport = useProfileViewport();

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

  const body = (
    <>
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
    </>
  );

  if (viewport === "mobile") {
    return (
      <ProfileMobilePanel open={open} onClose={onClose}>
        {body}
      </ProfileMobilePanel>
    );
  }

  if (viewport !== "desktop") return null;

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
      {body}
    </Sheet>
  );
}

/**
 * Full-screen account panel. Motion, scrim, and chrome follow the mobile
 * notifications drawer: enter from the right, leave to the right.
 */
function ProfileMobilePanel({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open ? <ProfileMobileDialog onClose={onClose}>{children}</ProfileMobileDialog> : null}
    </AnimatePresence>,
    document.body,
  );
}

function ProfileMobileDialog({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion() === true;
  const panelMotion = notificationsPanelMotion(reduceMotion);

  useEffect(() => {
    const previously = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus({ preventScroll: true });
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = focusableElements(dialogRef.current);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;
      const root = dialogRef.current;
      if (!active || !root.contains(active) || active === root) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
      if (previously?.isConnected) previously.focus();
    };
  }, [onClose]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (shouldDismissRightSwipe(info.offset.x, info.velocity.x)) onClose();
  };

  return (
    <div className="fixed inset-0 z-[130]">
      <motion.div
        data-profile-backdrop=""
        aria-hidden
        className={cn("absolute inset-0", material.scrim)}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
      />
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        data-profile-variant="mobile"
        data-profile-panel=""
        data-profile-motion={reduceMotion ? "fade" : "slide-right"}
        className="absolute inset-0 flex min-h-0 flex-col bg-[#0b111b] text-white outline-none"
        initial={panelMotion.initial}
        animate={panelMotion.animate}
        exit={panelMotion.exit}
        transition={panelMotion.transition}
        drag={reduceMotion ? false : "x"}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0, right: 0.45 }}
        dragDirectionLock
        onDragEnd={onDragEnd}
      >
        <header className="relative z-20 shrink-0 bg-white/[0.04] px-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-material">
          <div className="grid h-11 grid-cols-[2.75rem_1fr_2.75rem] items-center">
            <button
              type="button"
              aria-label="Back"
              onClick={onClose}
              className={cn(iconButton, "h-11 w-11 border border-hairline bg-white/10")}
            >
              <ChevronLeft size={20} />
            </button>
            <h2 id={titleId} className="truncate text-center text-[17px] font-semibold text-white">
              Your profile
            </h2>
            <span />
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-safe pt-4">
          {children}
        </div>
      </motion.div>
    </div>
  );
}
