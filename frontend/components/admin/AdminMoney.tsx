"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getApiUrl } from "../../lib/apiUrl";
import { formatRelativeAge, STATUS_PILL_CLASS } from "../../lib/adminFormat";
import { AdminWallet } from "./AdminBadge";
import { listingHref } from "../../lib/listingUrl";
import {
  MONEY_DEAL_FILTERS,
  MONEY_PAGE,
  MONEY_RELEASED_CAP,
  MONEY_SEARCH_PLACEHOLDER,
  MONEY_STAGE_TONE,
  MONEY_STUCK_DAYS,
  MONEY_TABS,
  filterMoneySearch,
  moneyEmptyCopy,
  moneyKpis,
  moneyRowActions,
  moneyStage,
  moneyTabBadge,
  rowsForMoneyTab,
  type MoneyDeal,
  type MoneyDealFilter,
  type MoneyKpiId,
  type MoneyTabId,
} from "../../lib/adminMoney";
import { material } from "../../lib/materials";
import { useAdminSession } from "./AdminShell";

function listingTitle(deal: MoneyDeal): string {
  return deal.title?.trim() || `${deal.listingId.slice(0, 14)}…`;
}

function QueueSkeleton() {
  return (
    <div className="space-y-2 px-3 py-3" data-money-skeleton="">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="h-8 animate-pulse rounded-[14px] bg-white/[0.04]" />
      ))}
    </div>
  );
}

function QueueEmpty({ tab, query }: { tab: MoneyTabId; query: string }) {
  const copy = moneyEmptyCopy(tab, query);
  return (
    <div data-money-empty={tab}>
      <p className="text-sm text-white">{copy.title}</p>
      <p className="mt-1 text-xs text-silver">{copy.sub}</p>
    </div>
  );
}

function StagePill({ deal }: { deal: MoneyDeal }) {
  const stage = moneyStage(deal);
  const tone = MONEY_STAGE_TONE[stage];
  return (
    <span
      className={`${material.regular} ${STATUS_PILL_CLASS[tone]} rounded-full px-2 py-0.5 text-[11px]`}
    >
      {stage}
    </span>
  );
}

function DealActions({ deal }: { deal: MoneyDeal }) {
  const actions = moneyRowActions();
  return (
    <span className="inline-flex items-center justify-end">
      {actions.view && (
        <Link
          href={listingHref(deal.listingId)}
          target="_blank"
          className="text-xs text-silver hover:text-white"
        >
          View
        </Link>
      )}
    </span>
  );
}

function KpiCard({
  id,
  label,
  value,
  accent,
  selected,
  onSelect,
  loading,
}: {
  id: MoneyKpiId;
  label: string;
  value: string;
  accent: string;
  selected: boolean;
  onSelect: () => void;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      data-money-kpi={id}
      aria-pressed={selected}
      onClick={onSelect}
      className={`${material.regular} rounded-[14px] p-3 text-left transition-colors hover:bg-white/[0.04] ${
        selected ? "ring-1 ring-white/25" : ""
      }`}
    >
      <div className="text-xs text-silver">{label}</div>
      {loading ? (
        <div className="mt-2 h-7 w-16 animate-pulse rounded bg-white/10" />
      ) : (
        <div className="mt-2 text-2xl font-bold tabular-nums" style={{ color: accent }}>
          {value}
        </div>
      )}
    </button>
  );
}

export function AdminMoney() {
  const { headers, handleAuthStatus } = useAdminSession();
  const [tab, setTab] = useState<MoneyTabId>("deals");
  const [filter, setFilter] = useState<MoneyDealFilter>("open");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [openDeals, setOpenDeals] = useState<MoneyDeal[]>([]);
  const [releasedDeals, setReleasedDeals] = useState<MoneyDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const openParams = new URLSearchParams({ stuckDays: String(MONEY_STUCK_DAYS) });
      const releasedParams = new URLSearchParams({
        scope: "released",
        limit: String(MONEY_RELEASED_CAP),
        stuckDays: String(MONEY_STUCK_DAYS),
      });
      const [openRes, releasedRes] = await Promise.all([
        fetch(`${getApiUrl()}/api/admin/deals?${openParams}`, { headers }),
        fetch(`${getApiUrl()}/api/admin/deals?${releasedParams}`, { headers }),
      ]);
      if (handleAuthStatus(openRes.status) || handleAuthStatus(releasedRes.status)) return;
      if (!openRes.ok || !releasedRes.ok) throw new Error("Failed to load deals");
      setOpenDeals(((await openRes.json()) as { deals?: MoneyDeal[] }).deals ?? []);
      setReleasedDeals(((await releasedRes.json()) as { deals?: MoneyDeal[] }).deals ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load deals");
    } finally {
      setLoading(false);
    }
  }, [handleAuthStatus, headers]);

  useEffect(() => {
    void load();
  }, [load]);

  const kpis = useMemo(() => moneyKpis(openDeals), [openDeals]);
  const releasedCount = releasedDeals.length;
  const visible = useMemo(
    () => filterMoneySearch(rowsForMoneyTab(openDeals, releasedDeals, tab, filter), appliedSearch),
    [appliedSearch, filter, openDeals, releasedDeals, tab],
  );
  const showSkeleton = loading && openDeals.length === 0 && releasedDeals.length === 0;

  const selectKpi = (id: MoneyKpiId) => {
    if (id === "disputed") {
      setTab("disputes");
      return;
    }
    setTab("deals");
    setFilter(id === "locked" ? "locked" : id === "stuck" ? "stuck" : "open");
  };

  const kpiSelected = (id: MoneyKpiId) => {
    if (id === "disputed") return tab === "disputes";
    if (tab !== "deals") return false;
    if (id === "locked") return filter === "locked";
    if (id === "stuck") return filter === "stuck";
    return filter === "open";
  };

  return (
    <div className="mx-auto max-w-[1440px] space-y-4">
      <header>
        <h1 className="text-xl font-bold text-white">{MONEY_PAGE.title}</h1>
        <p className="mt-1 text-sm text-silver">{MONEY_PAGE.sub}</p>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          id="open"
          label="Open deals"
          value={String(kpis.open)}
          accent="#ffffff"
          selected={kpiSelected("open")}
          onSelect={() => selectKpi("open")}
          loading={showSkeleton}
        />
        <KpiCard
          id="locked"
          label="Locked"
          value={String(kpis.locked)}
          accent="#00e5ff"
          selected={kpiSelected("locked")}
          onSelect={() => selectKpi("locked")}
          loading={showSkeleton}
        />
        {kpis.disputed > 0 && (
          <KpiCard
            id="disputed"
            label="Disputed"
            value={String(kpis.disputed)}
            accent="#f43f5e"
            selected={kpiSelected("disputed")}
            onSelect={() => selectKpi("disputed")}
          />
        )}
        <KpiCard
          id="stuck"
          label="Stuck"
          value={String(kpis.stuck)}
          accent="#fbbf24"
          selected={kpiSelected("stuck")}
          onSelect={() => selectKpi("stuck")}
          loading={showSkeleton}
        />
      </div>

      <div className="flex flex-wrap gap-1" role="tablist" aria-label="Money">
        {MONEY_TABS.map((item) => {
          const selected = tab === item.id;
          const badge = moneyTabBadge(item.id, kpis, releasedCount);
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
              {badge && (
                <span
                  data-money-badge={item.id}
                  data-tone={badge.tone}
                  className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums ${
                    badge.tone === "danger"
                      ? "bg-danger/15 text-danger"
                      : badge.tone === "silver"
                        ? "bg-white/5 text-silver"
                        : "bg-[#00ffa3]/15 text-[#00ffa3]"
                  }`}
                >
                  {badge.count}
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

      <section className={`${material.regular} overflow-hidden rounded-[14px]`}>
        <div className="flex flex-wrap items-center gap-2 border-b border-hairline px-3 py-2.5">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") setAppliedSearch(e.currentTarget.value);
            }}
            placeholder={MONEY_SEARCH_PLACEHOLDER}
            aria-label="Search deals"
            className={`${material.regular} h-8 min-w-[200px] flex-1 rounded-[14px] px-3 text-sm text-white placeholder:text-silver/50 focus:outline-none`}
          />
          {search.trim() && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setAppliedSearch("");
              }}
              className="text-xs text-silver hover:text-white"
            >
              Clear search
            </button>
          )}
          {tab === "deals" && (
            <div className="flex flex-wrap gap-1" role="group" aria-label="Deal filters">
              {MONEY_DEAL_FILTERS.map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setFilter(chip.id)}
                  aria-pressed={filter === chip.id}
                  className={`rounded-full px-2.5 py-1 text-[11px] ${
                    filter === chip.id
                      ? "bg-[#00ffa3]/15 text-[#00ffa3]"
                      : `${material.regular} text-silver`
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-full text-left text-sm">
            <thead className="sticky top-0 bg-[#0e1422] text-xs text-silver">
              <tr>
                <th className="px-3 py-2 font-medium">Listing</th>
                <th className="px-3 py-2 font-medium">Buyer</th>
                <th className="px-3 py-2 font-medium">Seller</th>
                <th className="px-3 py-2 font-medium">Amount ℏ</th>
                <th className="px-3 py-2 font-medium">Stage</th>
                <th className="px-3 py-2 font-medium">Age</th>
                <th className="px-3 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-3 text-center">
                    {showSkeleton ? (
                      <QueueSkeleton />
                    ) : (
                      <QueueEmpty tab={tab} query={appliedSearch} />
                    )}
                  </td>
                </tr>
              ) : (
                visible.map((deal) => (
                  <tr
                    key={deal.listingId}
                    className="h-11 border-t border-hairline hover:bg-white/[0.04]"
                  >
                    <td className="max-w-[220px] truncate px-3 text-white">
                      {listingTitle(deal)}
                      {deal.stuck && <span className="ml-2 text-[10px] text-danger">Stuck</span>}
                    </td>
                    <td className="px-3">
                      <AdminWallet address={deal.buyer} isAdmin={deal.buyerIsAdmin} />
                    </td>
                    <td className="px-3">
                      <AdminWallet address={deal.seller} isAdmin={deal.sellerIsAdmin} />
                    </td>
                    <td className="px-3 font-mono text-xs tabular-nums text-white">
                      {deal.amountHbar}
                    </td>
                    <td className="px-3">
                      <StagePill deal={deal} />
                    </td>
                    <td className="px-3 text-xs text-silver">
                      {formatRelativeAge(
                        deal.attentionAt || deal.updatedAt || deal.createdAt || "",
                      )}
                    </td>
                    <td className="px-3 text-right">
                      <DealActions deal={deal} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-hairline md:hidden">
          {visible.length === 0 ? (
            <div className="px-3 py-3 text-center">
              {showSkeleton ? <QueueSkeleton /> : <QueueEmpty tab={tab} query={appliedSearch} />}
            </div>
          ) : (
            visible.map((deal) => (
              <div key={deal.listingId} className="px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm text-white">
                    {listingTitle(deal)}
                    {deal.stuck && <span className="ml-2 text-[10px] text-danger">Stuck</span>}
                  </span>
                  <StagePill deal={deal} />
                </div>
                <div className="mt-1 flex items-center justify-between gap-2 text-xs text-silver">
                  <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <AdminWallet address={deal.buyer} isAdmin={deal.buyerIsAdmin} />
                    <span aria-hidden>·</span>
                    <AdminWallet address={deal.seller} isAdmin={deal.sellerIsAdmin} />
                  </span>
                  <span className="shrink-0 tabular-nums text-white">{deal.amountHbar} ℏ</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-silver">
                  <span>
                    {formatRelativeAge(deal.attentionAt || deal.updatedAt || deal.createdAt || "")}
                  </span>
                  <DealActions deal={deal} />
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
