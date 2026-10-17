"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BadgeCheck, ChevronLeft, Plus, Settings } from "lucide-react";
import { placeGearMenu, type GearMenuPlacement } from "../lib/gearMenu";
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
 *
 * The menu is portaled to document.body. A short profile (account id, no bio)
 * used to clip it: the menu lived in the sticky header, and the earnings card's
 * backdrop-filter painted through the bottom edge.
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
  const pathname = usePathname();
  const { address, accountId, disconnect } = useHashpackWallet();
  const [gearOpen, setGearOpen] = useState(false);
  const gearRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const pathnameRef = useRef(pathname);
  const wasOpenRef = useRef(false);
  const profileKey = address ?? accountId;
  const editHref = profileKey ? `/profile/${encodeURIComponent(profileKey)}?edit=1` : null;

  const closeGear = useCallback(() => setGearOpen(false), []);

  useEffect(() => {
    if (pathnameRef.current !== pathname) {
      pathnameRef.current = pathname;
      setGearOpen(false);
    }
  }, [pathname]);

  useEffect(() => {
    if (wasOpenRef.current && !gearOpen) buttonRef.current?.focus();
    wasOpenRef.current = gearOpen;
  }, [gearOpen]);

  useEffect(() => {
    if (!gearOpen) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (gearRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setGearOpen(false);
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
              ref={buttonRef}
              type="button"
              data-testid="profile-gear"
              aria-label="Settings"
              aria-expanded={gearOpen}
              aria-haspopup="menu"
              aria-controls="profile-gear-menu"
              className={iconBtn}
              onClick={() => setGearOpen((open) => !open)}
            >
              <Settings size={20} />
            </button>
            {gearOpen && (
              <GearMenu anchorRef={buttonRef} menuRef={menuRef} onClose={closeGear}>
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
              </GearMenu>
            )}
          </div>
        </div>
      </div>
      {notice && <p className="px-4 pb-1 text-center text-[12px] text-white/60">{notice}</p>}
    </header>
  );
}

function GearMenu({
  anchorRef,
  menuRef,
  onClose,
  children,
}: {
  anchorRef: RefObject<HTMLButtonElement>;
  menuRef: RefObject<HTMLDivElement>;
  onClose: () => void;
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  const [placement, setPlacement] = useState<GearMenuPlacement | null>(null);

  useEffect(() => setMounted(true), []);

  useLayoutEffect(() => {
    if (!mounted) return;
    const menu = menuRef.current;
    const anchor = anchorRef.current;
    if (!menu || !anchor) return;

    const measure = () => {
      const rect = anchor.getBoundingClientRect();
      const next = placeGearMenu(
        { top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left },
        { width: menu.offsetWidth || 208, height: menu.scrollHeight },
        { width: window.innerWidth, height: window.innerHeight },
      );
      setPlacement((current) =>
        current &&
        current.top === next.top &&
        current.left === next.left &&
        current.maxHeight === next.maxHeight
          ? current
          : next,
      );
    };

    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [anchorRef, menuRef, mounted]);

  useEffect(() => {
    const menu = menuRef.current;
    if (!mounted || !menu) return;
    const items = () => Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitem"]'));
    items()[0]?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" && event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      const list = items();
      if (list.length === 0) return;
      event.preventDefault();
      const index = list.indexOf(document.activeElement as HTMLElement);
      const backward = event.key === "ArrowUp" || (event.key === "Tab" && event.shiftKey);
      const next = backward
        ? index <= 0
          ? list[list.length - 1]
          : list[index - 1]
        : index === -1 || index === list.length - 1
          ? list[0]
          : list[index + 1];
      next?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuRef, mounted, onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      ref={menuRef}
      id="profile-gear-menu"
      role="menu"
      data-testid="profile-gear-menu"
      style={{
        top: placement?.top ?? 0,
        left: placement?.left ?? 0,
        maxHeight: placement?.maxHeight ?? undefined,
        visibility: placement ? "visible" : "hidden",
      }}
      className={cn(
        material.regular,
        "fixed z-[80] w-52 overflow-y-auto rounded-[14px] p-1",
        placement?.maxHeight != null && "overscroll-contain",
      )}
    >
      {children}
    </div>,
    document.body,
  );
}
