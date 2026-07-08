"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  ArrowUpRight,
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
import { getApiUrl } from "../lib/apiUrl";
import { formatPriceForDisplay } from "../lib/formatPrice";
import { ProfileContent } from "./ProfileContent";
import DashboardPage from "../app/dashboard/page";

type View = "menu" | "profile" | "hashpop" | "purchases";

type PurchaseRow = {
  id: string;
  amount: string;
  role: "buyer" | "seller";
  createdAt: string;
  listing?: { title?: string | null; status?: string; imageUrl?: string | null } | null;
  auction?: { title?: string | null; imageUrl?: string | null } | null;
};

/**
 * Slide-up profile card (bottom sheet) opened from the wallet chip in the
 * mobile marketplace header. Profile / My Hashpop / Purchases render as
 * sub-views *inside* the sheet (with a back button) rather than navigating
 * away, so it stays a self-contained popup.
 */
export function ProfileCardSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { address, accountId, disconnect } = useHashpackWallet();
  const profile = useProfile(address ?? accountId ?? null);
  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState(false);
  const [view, setView] = useState<View>("menu");

  const [purchases, setPurchases] = useState<PurchaseRow[] | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) {
      setShown(false);
      return;
    }
    setView("menu");
    const r = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(r);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (view === "menu") onClose();
      else setView("menu");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, view]);

  const apiAddr = (address ?? accountId ?? "").toString();

  const loadPurchases = useCallback(async () => {
    if (!apiAddr) return;
    try {
      const res = await fetch(`${getApiUrl()}/api/user/${encodeURIComponent(apiAddr)}/purchases`);
      if (res.ok) {
        const data = (await res.json()) as { purchases?: PurchaseRow[] };
        setPurchases(data.purchases ?? []);
      } else {
        setPurchases([]);
      }
    } catch {
      setPurchases([]);
    }
  }, [apiAddr]);

  // Lazy-load data when entering a sub-view.
  useEffect(() => {
    if (!open) return;
    if (view === "purchases" && purchases === null) void loadPurchases();
  }, [open, view, purchases, loadPurchases]);

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

  const titles: Record<View, string> = {
    menu: "",
    profile: "Profile",
    hashpop: "My Hashpop",
    purchases: "Purchases",
  };

  const FullPageLink = ({ href, label }: { href: string; label: string }) => (
    <Link
      href={href}
      onClick={onClose}
      className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-chrome hover:text-white"
    >
      {label}
      <ArrowUpRight size={13} />
    </Link>
  );

  return createPortal(
    <div
      className="fixed inset-0 z-[130] flex items-end justify-center md:items-center md:p-4"
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
        className={`relative flex w-full flex-col rounded-t-3xl border border-white/10 bg-[#12161f] shadow-[0_-12px_40px_rgba(0,0,0,0.5)] transition-all duration-300 ease-out md:rounded-3xl ${
          view === "hashpop"
            ? "max-w-6xl md:h-[85vh]"
            : view === "profile"
              ? "max-w-2xl"
              : "max-w-md"
        } ${shown ? "translate-y-0 opacity-100" : "translate-y-full opacity-0 md:translate-y-4"}`}
        style={{ maxHeight: "85dvh" }}
      >
        {/* Header */}
        <div className="relative shrink-0 px-5 pt-3">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/15" />
          {view !== "menu" && (
            <button
              type="button"
              onClick={() => setView("menu")}
              aria-label="Back"
              className="absolute left-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-silver hover:bg-white/10 hover:text-white"
            >
              <ChevronLeft size={20} />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-4 top-3 flex h-8 w-8 items-center justify-center rounded-full text-silver hover:bg-white/10 hover:text-white"
          >
            <X size={18} />
          </button>
          {view !== "menu" && (
            <h2 className="pb-1 text-center text-sm font-bold text-white">{titles[view]}</h2>
          )}
        </div>

        {/* Body */}
        <div
          className="min-h-0 flex-1 overflow-y-auto px-5 pt-2"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom), 24px)" }}
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
                    className="h-14 w-14 shrink-0 rounded-full border border-white/10 object-cover"
                  />
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-silver/60">
                    <User size={26} />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-base font-bold text-white">
                    <span className="truncate">{name ?? acct}</span>
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
              </button>

              <div className="my-4 border-t border-white/10" />

              <div className="space-y-0.5">
                <button
                  type="button"
                  onClick={() => setView("profile")}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-white transition-colors hover:bg-white/5"
                >
                  <UserCircle size={18} className="text-silver" /> View profile
                </button>
                <button
                  type="button"
                  onClick={() => setView("hashpop")}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-white transition-colors hover:bg-white/5"
                >
                  <LayoutDashboard size={18} className="text-silver" /> My Hashpop
                </button>
                <button
                  type="button"
                  onClick={() => setView("purchases")}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-white transition-colors hover:bg-white/5"
                >
                  <Receipt size={18} className="text-silver" /> Purchases
                </button>
                <Link
                  href="/offers"
                  onClick={onClose}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-white transition-colors hover:bg-white/5"
                >
                  <Tag size={18} className="text-silver" /> Offers
                </Link>
                <Link
                  href="/purchases?tab=sold"
                  onClick={onClose}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-white transition-colors hover:bg-white/5"
                >
                  <PackageCheck size={18} className="text-silver" /> Sold items
                </Link>
                <Link
                  href="/help"
                  onClick={onClose}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-white transition-colors hover:bg-white/5"
                >
                  <Info size={18} className="text-silver" /> Help &amp; support
                </Link>
              </div>

              <div className="my-3 border-t border-white/10" />

              <button
                type="button"
                onClick={() => {
                  onClose();
                  void disconnect();
                }}
                className="mb-2 flex w-full items-center gap-3 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-3 text-left text-sm font-semibold text-rose-300 transition-colors hover:bg-rose-500/20"
              >
                <LogOut size={18} />
                Sign out
              </button>
            </>
          )}

          {/* Full profile rendered in-modal. */}
          {view === "profile" && apiAddr && (
            <div className="-mx-5 pb-2">
              <ProfileContent address={apiAddr} embedded />
            </div>
          )}

          {/* Full dashboard rendered in-modal. */}
          {view === "hashpop" && (
            <div className="-mx-5 pb-2">
              <DashboardPage />
            </div>
          )}

          {view === "purchases" && (
            <div className="space-y-2 pb-2">
              {purchases === null ? (
                <p className="py-4 text-center text-sm text-silver">Loading…</p>
              ) : purchases.length === 0 ? (
                <p className="py-4 text-center text-sm text-silver">No purchases yet.</p>
              ) : (
                <>
                  {purchases.slice(0, 12).map((row) => {
                    const title =
                      row.listing?.title || row.auction?.title || "Listing";
                    const thumb = row.listing?.imageUrl || row.auction?.imageUrl || null;
                    return (
                      <div
                        key={row.id}
                        className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-2.5"
                      >
                        {thumb ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={thumb}
                            alt=""
                            className="h-10 w-10 shrink-0 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="h-10 w-10 shrink-0 rounded-lg bg-white/5" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-white">{title}</div>
                          <div className="text-[11px] text-silver/70">
                            {row.role === "buyer" ? "Bought" : "Sold"} ·{" "}
                            {formatPriceForDisplay(row.amount || "0")} ℏ
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <FullPageLink href="/purchases" label="Open all purchases" />
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
