"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getApiUrl } from "../../lib/apiUrl";
import { listingHref } from "../../lib/listingUrl";
import { truncateAdminAddr } from "../../lib/adminFormat";
import { useAdminSession } from "./AdminShell";

type AdminDeal = {
  listingId: string;
  title: string | null;
  imageUrl: string | null;
  seller: string;
  buyer: string | null;
  amountHbar: string;
  status: string;
  disputeStatus: string | null;
  ageDays: number;
  stuck: boolean;
};

export function AdminDeals() {
  const { headers, handleAuthStatus } = useAdminSession();
  const [deals, setDeals] = useState<AdminDeal[]>([]);
  const [stuckOnly, setStuckOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (stuckOnly) params.set("stuck", "1");
      params.set("stuckDays", "7");
      const res = await fetch(`${getApiUrl()}/api/admin/deals?${params}`, { headers });
      if (handleAuthStatus(res.status)) return;
      if (!res.ok) throw new Error("Failed to load deals");
      const data = (await res.json()) as { deals?: AdminDeal[] };
      setDeals(data.deals ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load deals");
    } finally {
      setLoading(false);
    }
  }, [headers, handleAuthStatus, stuckOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-white">Deal health</h2>
          <p className="text-xs text-silver">
            Locked listings, open disputes, and in-progress deals. Stuck = 7+ days.
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs text-silver">
          <input
            type="checkbox"
            checked={stuckOnly}
            onChange={(e) => setStuckOnly(e.target.checked)}
            className="accent-[#00ffa3]"
          />
          Stuck only (&gt;7 days)
        </label>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-glass-lg border border-white/10 bg-[#0e1422]">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-white/[0.03] text-[10px] font-bold uppercase tracking-[0.14em] text-silver">
            <tr>
              <th className="px-3 py-2.5"></th>
              <th className="px-3 py-2.5">Listing</th>
              <th className="px-3 py-2.5">Parties</th>
              <th className="px-3 py-2.5">Amount</th>
              <th className="px-3 py-2.5">Status</th>
              <th className="px-3 py-2.5">Age</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {deals.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-silver">
                  {loading ? "Loading…" : "No deals need attention."}
                </td>
              </tr>
            ) : (
              deals.map((d) => (
                <tr key={d.listingId} className="align-middle">
                  <td className="px-3 py-2">
                    {d.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={d.imageUrl} alt="" className="h-10 w-10 rounded-lg object-cover" />
                    ) : (
                      <div className="h-10 w-10 rounded-lg bg-white/5" />
                    )}
                  </td>
                  <td className="max-w-[240px] truncate px-3 py-2 text-white">
                    <Link
                      href={listingHref(d.listingId)}
                      className="hover:text-chrome"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {d.title || d.listingId.slice(0, 14) + "…"}
                    </Link>
                    {d.stuck && (
                      <div className="text-[10px] font-semibold text-rose-300">Stuck</div>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px] text-silver">
                    <div>S {truncateAdminAddr(d.seller)}</div>
                    <div>B {truncateAdminAddr(d.buyer)}</div>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-chrome">{d.amountHbar} ℏ</td>
                  <td className="px-3 py-2 text-xs text-white">
                    {d.status}
                    {d.disputeStatus === "OPEN" && (
                      <div className="text-[10px] font-semibold text-amber-300">Dispute open</div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-silver">{d.ageDays}d</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
