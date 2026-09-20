"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getApiUrl } from "../../lib/apiUrl";
import { listingHref } from "../../lib/listingUrl";
import { ACTIVITY_LABELS, formatRelativeAge, truncateAdminAddr } from "../../lib/adminFormat";
import { useAdminSession } from "./AdminShell";

type AdminStats = {
  listings: {
    total: number;
    active: number;
    pending: number;
    sold: number;
    locked: number;
    cancelled: number;
  };
  sales: { count: number; volumeHbar: string };
  users: { count: number };
  deals: { locked: number; openDisputes: number; sold: number; withBuyer: number };
};

type ActivityEvent = {
  type: string;
  at: string;
  listingId?: string | null;
  listingTitle?: string | null;
  actor?: string | null;
  counterparty?: string | null;
  amountHbar?: string | null;
  status?: string | null;
};

function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: string;
}) {
  return (
    <div className="glass-card p-4">
      <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-silver">{label}</div>
      <div
        className="mt-2 text-2xl font-extrabold tracking-tight"
        style={{ color: accent ?? "#ffffff" }}
      >
        {value}
      </div>
      {hint ? <div className="mt-1 text-[11px] text-silver">{hint}</div> : null}
    </div>
  );
}

export function AdminOverview() {
  const { headers, handleAuthStatus } = useAdminSession();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sRes, aRes] = await Promise.all([
        fetch(`${getApiUrl()}/api/admin/stats`, { headers }),
        fetch(`${getApiUrl()}/api/admin/activity?limit=80`, { headers }),
      ]);
      if (handleAuthStatus(sRes.status) || handleAuthStatus(aRes.status)) return;
      if (!sRes.ok || !aRes.ok) throw new Error("Failed to load overview");
      setStats((await sRes.json()) as AdminStats);
      const data = (await aRes.json()) as { events?: ActivityEvent[] };
      setEvents(data.events ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load overview");
    } finally {
      setLoading(false);
    }
  }, [headers, handleAuthStatus]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-white">Overview</h2>
          <p className="text-xs text-silver">
            Live platform health from existing marketplace data.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="rounded-full border border-white/15 bg-white/5 px-3.5 py-2 text-xs text-white hover:bg-white/10 disabled:opacity-60"
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
          {error}
        </div>
      )}

      {stats && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Users"
            value={String(stats.users.count)}
            hint="Registered wallets"
            accent="#ffffff"
          />
          <StatCard
            label="Listings"
            value={String(stats.listings.total)}
            hint={`${stats.listings.active} live · ${stats.listings.pending} pending · ${stats.listings.cancelled} cancelled`}
            accent="#00ffa3"
          />
          <StatCard
            label="Deals"
            value={String(stats.sales.count)}
            hint={`${stats.deals.locked} locked · ${stats.deals.openDisputes} open disputes · ${stats.deals.withBuyer} in progress`}
            accent="#f97316"
          />
          <StatCard
            label="Volume"
            value={`${stats.sales.volumeHbar} ℏ`}
            hint={`${stats.listings.sold} sold`}
            accent="#00e5ff"
          />
        </div>
      )}

      <section className="glass-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h3 className="text-sm font-bold text-white">Platform activity</h3>
          <span className="text-[10px] uppercase tracking-wider text-silver">
            Sales · listings · offers · disputes
          </span>
        </div>
        {events.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-silver">
            {loading ? "Loading…" : "No recent platform events."}
          </p>
        ) : (
          <ul className="divide-y divide-white/5">
            {events.map((event, i) => {
              const href = event.listingId ? listingHref(event.listingId) : null;
              const title = event.listingTitle || event.listingId?.slice(0, 14) || "Listing";
              return (
                <li key={`${event.type}-${event.at}-${event.listingId ?? i}`} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#00ffa3]">
                        {ACTIVITY_LABELS[event.type] ?? event.type}
                      </p>
                      <p className="mt-1 truncate text-sm text-white">
                        {href ? (
                          <Link href={href} className="hover:text-chrome" target="_blank">
                            {title}
                          </Link>
                        ) : (
                          title
                        )}
                        {event.amountHbar ? (
                          <span className="ml-2 font-mono text-xs text-chrome">
                            {event.amountHbar} ℏ
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] text-silver">
                        {truncateAdminAddr(event.actor)}
                        {event.counterparty ? ` → ${truncateAdminAddr(event.counterparty)}` : ""}
                        {event.status ? ` · ${event.status}` : ""}
                      </p>
                    </div>
                    <time className="shrink-0 text-[11px] text-silver" dateTime={event.at}>
                      {formatRelativeAge(event.at)}
                    </time>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
