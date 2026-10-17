"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BadgeCheck, ChevronLeft, Plus, Settings } from "lucide-react";
import { useHashpackWallet } from "../lib/hashpackWallet";
import { material } from "../lib/materials";
import type { ProfileTitleKind } from "../lib/profileTitle";
import { cn } from "../lib/utils";

const iconBtn =
  "flex h-11 w-11 items-center justify-center rounded-full text-white/90 hover:bg-white/[0.08]";

const menuItem =
  "flex min-h-11 w-full items-center rounded-[10px] px-3 text-left text-sm text-white hover:bg-white/10";

/**
 * Own-profile bar: back, centered title, new-listing, and the account gear.
 * The gear keeps every destination the old profile sheet offered that the
 * profile tabs do not already cover, plus sign out.
 */
export function ProfileOwnerHeader({
  title,
  titleKind = "name",
  verified = false,
  onBack,
  onEdit,
  notice,
}: {
  title: string;
  /** .h names use Clash. Account ids and truncated addresses use the mono face. */
  titleKind?: ProfileTitleKind;
  verified?: boolean;
  onBack: () => void;
  onEdit?: () => void;
  notice?: string | null;
}) {
  const { address, accountId, disconnect } = useHashpackWallet();
  const [gearOpen, setGearOpen] = useState(false);
  const gearRef = useRef<HTMLDivElement>(null);
  const profileKey = address ?? accountId;
  const editHref = profileKey ? `/profile/${encodeURIComponent(profileKey)}?edit=1` : null;

  useEffect(() => {
    if (!gearOpen) return;
    const onPointer = (event: PointerEvent) => {
      if (!gearRef.current?.contains(event.target as Node)) setGearOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [gearOpen]);

  return (
    <header data-testid="profile-owner-header" className="sticky top-0 z-30 bg-bg md:top-14">
      <div className="grid h-14 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center px-1">
        <div className="flex justify-start">
          <button type="button" onClick={onBack} aria-label="Back" className={iconBtn}>
            <ChevronLeft size={22} />
          </button>
        </div>
        <h1
          data-testid="profile-handle"
          className={cn(
            "flex max-w-[60vw] items-center gap-1 text-[17px] font-semibold text-white",
            titleKind === "address" ? "font-mono tracking-normal" : "font-display tracking-tight",
          )}
        >
          <span className="truncate">{title}</span>
          {verified && (
            <BadgeCheck size={16} className="shrink-0 text-chrome" aria-label="KYC verified" />
          )}
        </h1>
        <div className="flex items-center justify-end">
          <Link href="/create" aria-label="New listing" className={iconBtn}>
            <Plus size={22} />
          </Link>
          <div className="relative" ref={gearRef}>
            <button
              type="button"
              data-testid="profile-gear"
              aria-label="Settings"
              aria-expanded={gearOpen}
              aria-haspopup="menu"
              className={iconBtn}
              onClick={() => setGearOpen((open) => !open)}
            >
              <Settings size={20} />
            </button>
            {gearOpen && (
              <div
                role="menu"
                data-testid="profile-gear-menu"
                className={cn(
                  material.regular,
                  "absolute right-0 top-11 z-40 w-52 rounded-[14px] p-1",
                )}
              >
                {onEdit ? (
                  <button
                    type="button"
                    role="menuitem"
                    className={menuItem}
                    onClick={() => {
                      setGearOpen(false);
                      onEdit();
                    }}
                  >
                    Edit profile
                  </button>
                ) : (
                  editHref && (
                    <Link
                      href={editHref}
                      role="menuitem"
                      className={menuItem}
                      onClick={() => setGearOpen(false)}
                    >
                      Edit profile
                    </Link>
                  )
                )}
                <Link
                  href="/dashboard"
                  role="menuitem"
                  className={menuItem}
                  onClick={() => setGearOpen(false)}
                >
                  My Hashpop
                </Link>
                <Link
                  href="/offers"
                  role="menuitem"
                  className={menuItem}
                  onClick={() => setGearOpen(false)}
                >
                  Offers
                </Link>
                <Link
                  href="/help"
                  role="menuitem"
                  className={menuItem}
                  onClick={() => setGearOpen(false)}
                >
                  Help &amp; support
                </Link>
                <div className={cn("my-1 border-t", material.hairline)} />
                <button
                  type="button"
                  role="menuitem"
                  className="flex min-h-11 w-full items-center rounded-[10px] px-3 text-left text-sm font-semibold text-rose-300 hover:bg-rose-500/15"
                  onClick={() => {
                    setGearOpen(false);
                    void disconnect();
                  }}
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      {notice && <p className="px-4 pb-1 text-center text-[12px] text-white/60">{notice}</p>}
    </header>
  );
}
