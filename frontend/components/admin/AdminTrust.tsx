"use client";

import { useCallback, useEffect, useState } from "react";
import { getApiUrl } from "../../lib/apiUrl";
import { material } from "../../lib/materials";
import {
  TRUST_EMPTY,
  TRUST_PAGE,
  TRUST_TABS,
  trustCountBadge,
  type TrustListingFilter,
  type TrustTabId,
} from "../../lib/adminTrust";
import { useAdminSession } from "./AdminShell";
import { TrustListingsTable, type TrustListing } from "./TrustListingsTable";

type QueueCounts = { listings: number; users: number; disputes: number };

const EMPTY_COUNTS: QueueCounts = { listings: 0, users: 0, disputes: 0 };

export function TrustQueueEmpty({ title, sub }: { title: string; sub: string }) {
  return (
    <section className={`${material.regular} rounded-[14px] px-4 py-10 text-center`}>
      <p className="text-sm font-medium text-white">{title}</p>
      <p className="mt-1 text-xs text-silver">{sub}</p>
    </section>
  );
}

export function AdminTrust() {
  const { headers, handleAuthStatus } = useAdminSession();
  const [tab, setTab] = useState<TrustTabId>("listings");
  const [filter, setFilter] = useState<TrustListingFilter>("needs_review");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [listings, setListings] = useState<TrustListing[]>([]);
  const [counts, setCounts] = useState<QueueCounts>(EMPTY_COUNTS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ filter });
      if (appliedSearch.trim()) params.set("q", appliedSearch.trim());
      const res = await fetch(`${getApiUrl()}/api/admin/trust/listings?${params}`, { headers });
      if (handleAuthStatus(res.status)) return;
      if (!res.ok) throw new Error("Failed to load the queue");
      const body = (await res.json()) as { listings?: TrustListing[]; counts?: QueueCounts };
      setListings(body.listings ?? []);
      setCounts(body.counts ?? EMPTY_COUNTS);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load the queue");
    } finally {
      setLoading(false);
    }
  }, [appliedSearch, filter, handleAuthStatus, headers]);

  useEffect(() => {
    void load();
  }, [load]);

  const mutate = useCallback(
    async (listing: TrustListing, path: string, init: RequestInit) => {
      setBusyId(listing.id);
      setError(null);
      try {
        const res = await fetch(
          `${getApiUrl()}/api/admin/listing/${encodeURIComponent(listing.id)}${path}`,
          { ...init, headers: { ...headers, ...(init.headers ?? {}) } },
        );
        if (handleAuthStatus(res.status)) return;
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error || "Action failed");
        }
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Action failed");
      } finally {
        setBusyId(null);
      }
    },
    [handleAuthStatus, headers, load],
  );

  const countsFor = (id: TrustTabId): number | null => {
    if (id === "listings") return trustCountBadge(counts.listings);
    if (id === "users") return trustCountBadge(counts.users);
    return trustCountBadge(counts.disputes);
  };

  return (
    <div className="mx-auto max-w-[1440px] space-y-4">
      <header>
        <h1 className="text-xl font-bold text-white">{TRUST_PAGE.title}</h1>
        <p className="mt-1 text-sm text-silver">{TRUST_PAGE.sub}</p>
      </header>

      <div className="flex flex-wrap gap-1" role="tablist" aria-label="Queues">
        {TRUST_TABS.map((item) => {
          const selected = tab === item.id;
          const badge = countsFor(item.id);
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setTab(item.id)}
              className={`inline-flex items-center rounded-[12px] px-3 py-1.5 text-sm font-medium ${
                selected ? `${material.chrome} text-chrome` : "text-silver hover:bg-white/[0.04]"
              }`}
            >
              {item.label}
              {badge != null && (
                <span className="ml-2 rounded-full bg-[#00ffa3]/15 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-[#00ffa3]">
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="rounded-[14px] border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </div>
      )}

      {tab === "listings" ? (
        <TrustListingsTable
          listings={listings}
          loading={loading}
          search={search}
          onSearch={setSearch}
          onApplySearch={(next) => setAppliedSearch(next ?? search)}
          filter={filter}
          onFilter={setFilter}
          busyId={busyId}
          onHide={(listing, reason) =>
            void mutate(listing, "/moderation", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "hide", reason }),
            })
          }
          onRemove={(listing) => void mutate(listing, "", { method: "DELETE" })}
          onFlag={(listing) =>
            void mutate(listing, "/moderation", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "flag" }),
            })
          }
          onClear={(listing) =>
            void mutate(listing, "/moderation", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "clear" }),
            })
          }
        />
      ) : (
        <TrustQueueEmpty title={TRUST_EMPTY[tab].title} sub={TRUST_EMPTY[tab].sub} />
      )}
    </div>
  );
}
