"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { getApiUrl } from "../../lib/apiUrl";
import { listingHref } from "../../lib/listingUrl";
import { truncateAdminAddr } from "../../lib/adminFormat";
import { useAdminSession } from "./AdminShell";

type AdminListing = {
  id: string;
  seller: string;
  buyer: string | null;
  price: string;
  status: string;
  title: string | null;
  category: string | null;
  imageUrl: string | null;
  createdAt: string;
  onChainConfirmed: boolean;
  disputeStatus: string | null;
};

export function AdminListings() {
  const { headers, handleAuthStatus } = useAdminSession();
  const [listings, setListings] = useState<AdminListing[]>([]);
  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filter.trim()) params.set("q", filter.trim());
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`${getApiUrl()}/api/admin/listings?${params}`, { headers });
      if (handleAuthStatus(res.status)) return;
      if (!res.ok) throw new Error("Failed to load listings");
      const data = (await res.json()) as { listings?: AdminListing[] };
      setListings(data.listings ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load listings");
    } finally {
      setLoading(false);
    }
  }, [filter, statusFilter, headers, handleAuthStatus]);

  useEffect(() => {
    void load();
    // Search text is applied explicitly so typing does not refetch every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, headers, handleAuthStatus]);

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

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-extrabold text-white">Listing health</h2>
        <p className="text-xs text-silver">Search, filter, and take down listings.</p>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search by id, title, seller, buyer…"
          className="input-frost w-72 text-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input-frost text-sm"
        >
          <option value="">Any status</option>
          <option value="LISTED">Listed</option>
          <option value="LOCKED">Locked</option>
          <option value="SOLD">Sold</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-full border border-white/15 bg-white/5 px-3.5 py-2 text-xs text-white hover:bg-white/10"
        >
          {loading ? "Refreshing…" : "Apply"}
        </button>
      </div>

      <div className="overflow-x-auto rounded-glass-lg border border-white/10 bg-[#0e1422]">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-white/[0.03] text-[10px] font-bold uppercase tracking-[0.14em] text-silver">
            <tr>
              <th className="px-3 py-2.5"></th>
              <th className="px-3 py-2.5">Title</th>
              <th className="px-3 py-2.5">Seller</th>
              <th className="px-3 py-2.5">Price</th>
              <th className="px-3 py-2.5">Status</th>
              <th className="px-3 py-2.5">On-chain</th>
              <th className="px-3 py-2.5">Created</th>
              <th className="px-3 py-2.5 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {listings.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-silver">
                  {loading ? "Loading…" : "No listings match the current filter."}
                </td>
              </tr>
            ) : (
              listings.map((l) => (
                <tr key={l.id} className="align-middle">
                  <td className="px-3 py-2">
                    {l.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={l.imageUrl} alt="" className="h-10 w-10 rounded-lg object-cover" />
                    ) : (
                      <div className="h-10 w-10 rounded-lg bg-white/5" />
                    )}
                  </td>
                  <td className="max-w-[220px] truncate px-3 py-2 text-white">
                    <Link
                      href={listingHref(l.id)}
                      className="hover:text-chrome"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {l.title || l.id.slice(0, 14) + "…"}
                    </Link>
                    {l.category && <div className="text-[10px] text-silver">{l.category}</div>}
                    {l.disputeStatus === "OPEN" && (
                      <div className="text-[10px] font-semibold text-amber-300">Dispute open</div>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-silver">
                    {truncateAdminAddr(l.seller)}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-chrome">{l.price} ℏ</td>
                  <td className="px-3 py-2 text-xs text-white">{l.status}</td>
                  <td className="px-3 py-2 text-xs">
                    {l.onChainConfirmed ? (
                      <span className="text-emerald-300">✓ confirmed</span>
                    ) : (
                      <span className="text-amber-300">pending</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-[11px] text-silver">
                    {new Date(l.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => void deleteListing(l.id, l.title)}
                      disabled={deleting === l.id}
                      className="inline-flex items-center gap-1 rounded-lg border border-rose-500/40 bg-rose-500/10 px-2.5 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 disabled:opacity-60"
                    >
                      <Trash2 size={12} />
                      {deleting === l.id ? "Removing…" : "Remove"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
