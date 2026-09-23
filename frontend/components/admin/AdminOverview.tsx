"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getApiUrl } from "../../lib/apiUrl";
import { material } from "../../lib/materials";
import { useAdminSession } from "./AdminShell";
import { AdminActivity, type ActivityEvent } from "./AdminActivity";
import { AdminListings, type AdminListing, type ListingChip } from "./AdminListings";
import { AdminDeals, type AdminDeal } from "./AdminDeals";
import { AdminAllowlist, type AdminIdentity } from "./AdminAllowlist";

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

type KpiFilter = ListingChip | "disputes" | null;

function KpiCard({
  label,
  value,
  accent,
  onClick,
  loading,
}: {
  label: string;
  value: string;
  accent: string;
  onClick?: () => void;
  loading?: boolean;
}) {
  const inner = (
    <>
      <div className="text-xs text-silver">{label}</div>
      {loading ? (
        <div className="mt-2 h-7 w-16 animate-pulse rounded bg-white/10" />
      ) : (
        <div className="mt-2 text-2xl font-bold tabular-nums" style={{ color: accent }}>
          {value}
        </div>
      )}
    </>
  );
  const frame = `${material.regular} rounded-[14px] p-3 text-left`;
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${frame} transition-colors hover:bg-white/[0.04]`}
      >
        {inner}
      </button>
    );
  }
  return <div className={frame}>{inner}</div>;
}

export function AdminOverview() {
  const { headers, handleAuthStatus } = useAdminSession();
  const listingsRef = useRef<HTMLElement | null>(null);
  const dealsRef = useRef<HTMLElement | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [listings, setListings] = useState<AdminListing[]>([]);
  const [deals, setDeals] = useState<AdminDeal[]>([]);
  const [admins, setAdmins] = useState<AdminIdentity[]>([]);
  const [search, setSearch] = useState("");
  const [statusChip, setStatusChip] = useState<ListingChip>("");
  const [stuckOnly, setStuckOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("q", search.trim());
      if (statusChip) params.set("status", statusChip);
      const dealParams = new URLSearchParams();
      if (stuckOnly) dealParams.set("stuck", "1");
      dealParams.set("stuckDays", "7");
      const [sRes, aRes, lRes, dRes, adminRes] = await Promise.all([
        fetch(`${getApiUrl()}/api/admin/stats`, { headers }),
        fetch(`${getApiUrl()}/api/admin/activity?limit=20`, { headers }),
        fetch(`${getApiUrl()}/api/admin/listings?${params}`, { headers }),
        fetch(`${getApiUrl()}/api/admin/deals?${dealParams}`, { headers }),
        fetch(`${getApiUrl()}/api/admin/admins`, { headers }),
      ]);
      if (
        handleAuthStatus(sRes.status) ||
        handleAuthStatus(aRes.status) ||
        handleAuthStatus(lRes.status) ||
        handleAuthStatus(dRes.status) ||
        handleAuthStatus(adminRes.status)
      ) {
        return;
      }
      if (!sRes.ok || !aRes.ok || !lRes.ok || !dRes.ok || !adminRes.ok) {
        throw new Error("Failed to load overview");
      }
      setStats((await sRes.json()) as AdminStats);
      setEvents(((await aRes.json()) as { events?: ActivityEvent[] }).events ?? []);
      setListings(((await lRes.json()) as { listings?: AdminListing[] }).listings ?? []);
      setDeals(((await dRes.json()) as { deals?: AdminDeal[] }).deals ?? []);
      setAdmins(((await adminRes.json()) as { admins?: AdminIdentity[] }).admins ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load overview");
    } finally {
      setLoading(false);
    }
  }, [headers, handleAuthStatus, search, statusChip, stuckOnly]);

  useEffect(() => {
    void load();
    // Search is applied explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headers, handleAuthStatus, statusChip, stuckOnly]);

  const applyKpi = (filter: KpiFilter) => {
    if (filter === "disputes") {
      setStuckOnly(false);
      dealsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (filter != null) setStatusChip(filter);
    listingsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const deleteListing = useCallback(
    async (id: string, title: string | null) => {
      const label = title || id.slice(0, 12) + "…";
      if (!window.confirm(`Permanently remove "${label}" from the marketplace?`)) return;
      setDeleting(id);
      try {
        const res = await fetch(`${getApiUrl()}/api/admin/listing/${encodeURIComponent(id)}`, {
          method: "DELETE",
          headers,
        });
        if (handleAuthStatus(res.status)) return;
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error || "Delete failed");
        }
        setListings((prev) => prev.filter((l) => l.id !== id));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Delete failed");
      } finally {
        setDeleting(null);
      }
    },
    [headers, handleAuthStatus],
  );

  const openDisputes = stats?.deals.openDisputes ?? 0;

  return (
    <div className="mx-auto max-w-[1440px] space-y-4">
      {error && (
        <div className="rounded-[14px] border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          label="Users"
          value={String(stats?.users.count ?? "—")}
          accent="#ffffff"
          loading={loading && !stats}
        />
        <KpiCard
          label="Active"
          value={String(stats?.listings.active ?? "—")}
          accent="#00ffa3"
          loading={loading && !stats}
          onClick={() => applyKpi("ACTIVE")}
        />
        <KpiCard
          label="Pending"
          value={String(stats?.listings.pending ?? "—")}
          accent="#fbbf24"
          loading={loading && !stats}
          onClick={() => applyKpi("PENDING")}
        />
        <KpiCard
          label="Locked"
          value={String(stats?.listings.locked ?? "—")}
          accent="#00e5ff"
          loading={loading && !stats}
          onClick={() => applyKpi("LOCKED")}
        />
        <KpiCard
          label="Sold"
          value={String(stats?.listings.sold ?? "—")}
          accent="#a78bfa"
          loading={loading && !stats}
          onClick={() => applyKpi("SOLD")}
        />
        <KpiCard
          label="Volume ℏ"
          value={stats ? stats.sales.volumeHbar : "—"}
          accent="#ffffff"
          loading={loading && !stats}
        />
        {openDisputes > 0 && (
          <KpiCard
            label="Disputes"
            value={String(openDisputes)}
            accent="#f43f5e"
            onClick={() => applyKpi("disputes")}
          />
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="flex flex-col gap-4 xl:col-start-3 xl:row-span-2">
          <AdminAllowlist admins={admins} loading={loading && admins.length === 0} />
          <AdminActivity events={events} loading={loading && events.length === 0} />
        </div>
        <AdminListings
          ref={listingsRef}
          listings={listings}
          search={search}
          onSearch={setSearch}
          statusChip={statusChip}
          onStatusChip={setStatusChip}
          loading={loading}
          deleting={deleting}
          onApply={() => void load()}
          onDelete={deleteListing}
          className="xl:col-span-2"
        />
        <AdminDeals
          ref={dealsRef}
          deals={deals}
          stuckOnly={stuckOnly}
          onStuckOnly={setStuckOnly}
          loading={loading}
          className="xl:col-span-2"
        />
      </div>
    </div>
  );
}
