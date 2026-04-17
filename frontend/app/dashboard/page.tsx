"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Heart,
  Package,
  Tag,
  PlusCircle,
  LifeBuoy,
  LogOut,
  ChevronRight,
  Home,
  Bell,
  MessageSquare,
  Star,
} from "lucide-react";
import { useHashpackWallet } from "../../lib/hashpackWallet";
import { getApiUrl } from "../../lib/apiUrl";
import { ConnectWalletButton } from "../../components/ConnectWalletButton";
import { useUnreadCount } from "../../hooks/useUnreadCount";

type Stats = {
  ratingAverage?: number;
  ratingCount?: number;
  profileImageUrl?: string | null;
};

function NavRow({
  href,
  icon: Icon,
  label,
  desc,
  badge,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  desc?: string;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 px-4 py-3.5 hover:bg-white/5 transition-colors active:bg-white/10"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-white/80">
        <Icon className="h-5 w-5" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium text-white leading-snug">{label}</span>
        {desc && <span className="block text-xs text-silver/70 mt-0.5">{desc}</span>}
      </span>
      {badge != null && badge > 0 && (
        <span className="mr-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#00ffa3] px-1 text-[10px] font-bold text-black">
          {badge > 9 ? "9+" : badge}
        </span>
      )}
      <ChevronRight className="h-4 w-4 shrink-0 text-white/30" />
    </Link>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass-card overflow-hidden rounded-2xl">
      <h2 className="px-4 pt-4 pb-2 text-base font-bold text-white">{title}</h2>
      <div className="divide-y divide-white/5">{children}</div>
    </div>
  );
}

export default function DashboardPage() {
  const { address, accountId, disconnect } = useHashpackWallet();
  const [mounted, setMounted] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const unreadCount = useUnreadCount();

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!address) {
      setStats(null);
      return;
    }
    fetch(`${getApiUrl()}/api/user/${address}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setStats(d))
      .catch(() => setStats(null));
  }, [address]);

  const displayId = accountId || (address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "");
  const avatarLetter = displayId ? (displayId[0]?.toUpperCase() ?? "?") : "?";

  return (
    <main className="min-h-screen slide-in-right">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {!mounted ? (
          <p className="text-silver text-sm">Loading…</p>
        ) : !address ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-silver">Connect your wallet to see your dashboard.</p>
            <ConnectWalletButton className="btn-frost-cta text-white disabled:opacity-50" />
          </div>
        ) : (
          <>
            {/* Profile header */}
            <div className="flex items-center gap-4">
              <div className="relative shrink-0">
                {stats?.profileImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={stats.profileImageUrl}
                    alt="Profile"
                    className="h-14 w-14 rounded-full object-cover ring-2 ring-[#00ffa3]/30"
                  />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#00ffa3] text-2xl font-black text-black select-none">
                    {avatarLetter}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-base font-bold text-white truncate">{displayId}</p>
                {stats?.ratingCount ? (
                  <Link
                    href={`/profile/${encodeURIComponent(address)}`}
                    className="inline-flex items-center gap-1 text-sm text-[#00ffa3]"
                  >
                    <Star className="h-3.5 w-3.5 fill-current" />
                    {Number(stats.ratingAverage ?? 0).toFixed(1)}
                    <span className="text-silver/60 text-xs">({stats.ratingCount})</span>
                  </Link>
                ) : (
                  <Link
                    href={`/profile/${encodeURIComponent(address)}`}
                    className="text-xs text-silver/60 hover:text-white"
                  >
                    View profile
                  </Link>
                )}
              </div>
            </div>

            {/* Quick-action row */}
            <div className="grid grid-cols-3 gap-3">
              {(
                [
                  { href: "/marketplace", icon: Home, label: "Home" },
                  { href: "/messages", icon: Bell, label: "Alerts", badge: unreadCount },
                  { href: "/messages", icon: MessageSquare, label: "Messages" },
                ] as { href: string; icon: React.ElementType; label: string; badge?: number }[]
              ).map(({ href, icon: Icon, label, badge }) => (
                <Link
                  key={label}
                  href={href}
                  className="relative flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/5 py-4 hover:bg-white/10 transition-colors active:bg-white/15"
                >
                  <span className="relative">
                    <Icon className="h-6 w-6 text-white/80" />
                    {badge != null && badge > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#00ffa3] px-1 text-[9px] font-bold text-black">
                        {badge > 9 ? "9+" : badge}
                      </span>
                    )}
                  </span>
                  <span className="text-[11px] font-medium text-silver">{label}</span>
                </Link>
              ))}
            </div>

            {/* Shopping */}
            <SectionCard title="Shopping">
              <NavRow href="/watchlist" icon={Heart} label="Watchlist" desc="Keep tabs on watched items" />
              <NavRow href="/purchases" icon={Package} label="Purchases" desc="Your order history" />
              <NavRow href="/offers" icon={Tag} label="Bids & Offers" desc="Active auctions and seller offers" />
            </SectionCard>

            {/* Selling */}
            <SectionCard title="Selling">
              <NavRow href="/create" icon={PlusCircle} label="List an Item" />
              <NavRow href="/selling" icon={Tag} label="Selling Overview" desc="Manage your listings and sales" />
            </SectionCard>

            {/* Account */}
            <div className="glass-card overflow-hidden rounded-2xl">
              <h2 className="px-4 pt-4 pb-2 text-base font-bold text-white">Account</h2>
              <div className="divide-y divide-white/5">
                <NavRow href="/support" icon={LifeBuoy} label="Support" />
                <button
                  type="button"
                  onClick={() => void disconnect()}
                  className="flex w-full items-center gap-4 px-4 py-3.5 hover:bg-white/5 transition-colors active:bg-white/10"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-white/80">
                    <LogOut className="h-5 w-5" />
                  </span>
                  <span className="text-sm font-medium text-white">Sign out</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
