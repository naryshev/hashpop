"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AccountSidebar } from "../../components/AccountSidebar";
import { useHashpackWallet } from "../../lib/hashpackWallet";
import { getApiUrl } from "../../lib/apiUrl";
import { formatPriceForDisplay } from "../../lib/formatPrice";
import { formatHbarWithUsd } from "../../lib/hbarUsd";
import { useHbarUsd } from "../../hooks/useHbarUsd";
import { formatListingDate } from "../../lib/formatDate";

export default function SellingPage() {
  const { address } = useHashpackWallet();
  const usdRate = useHbarUsd();
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<any[]>([]);
  const [archived, setArchived] = useState<any[]>([]);

  useEffect(() => {
    if (!address) {
      setActive([]);
      setArchived([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`${getApiUrl()}/api/user/${address}/listings`)
      .then((res) => res.ok ? res.json() : Promise.reject())
      .then((data: { active?: any[]; archived?: any[] }) => {
        setActive(data.active ?? []);
        setArchived(data.archived ?? []);
      })
      .catch(() => {
        setActive([]);
        setArchived([]);
      })
      .finally(() => setLoading(false));
  }, [address]);

  return (
    <main className="min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <h1 className="text-xl sm:text-2xl font-bold text-white">Selling</h1>
        <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
          <AccountSidebar />
          {!address ? (
            <p className="text-silver">Connect your wallet to view your listings.</p>
          ) : loading ? (
            <p className="text-silver">Loading…</p>
          ) : (
            <div className="space-y-6">
              <section>
                <h2 className="text-lg font-semibold text-white mb-3">Active</h2>
                {active.length === 0 ? (
                  <p className="text-silver">No active listings.</p>
                ) : (
                  <div className="glass-card overflow-hidden rounded-xl">
                    <ul className="divide-y divide-white/5">
                      {active.map((row) => (
                        <li key={row.id} className="p-3 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <Link href={`/listing/${encodeURIComponent(row.id)}`} className="text-white hover:text-chrome font-medium truncate block">
                              {row.title || row.id}
                            </Link>
                            <p className="text-xs text-silver mt-0.5">{formatListingDate(row.createdAt)}</p>
                          </div>
                          <div className="shrink-0 flex items-center gap-2">
                            <span className="text-chrome">{formatHbarWithUsd(formatPriceForDisplay(row.price || "0"), usdRate)}</span>
                            <Link
                              href={`/listing/${encodeURIComponent(row.id)}`}
                              className="btn-frost-cta px-3 py-1.5 text-xs border-white/20"
                            >
                              Edit
                            </Link>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
              <section>
                <h2 className="text-lg font-semibold text-white mb-3">Archived</h2>
                {archived.length === 0 ? (
                  <p className="text-silver">No archived listings.</p>
                ) : (
                  <div className="glass-card overflow-hidden rounded-xl">
                    <ul className="divide-y divide-white/5">
                      {archived.map((row) => (
                        <li key={row.id} className="p-3 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <Link href={`/listing/${encodeURIComponent(row.id)}`} className="text-white hover:text-chrome font-medium truncate block">
                              {row.title || row.id}
                            </Link>
                            <p className="text-xs text-silver mt-0.5">
                              {formatListingDate(row.updatedAt ?? row.createdAt)} · {row.status}
                            </p>
                          </div>
                          <div className="shrink-0 flex items-center gap-2">
                            <span className="text-chrome">{formatHbarWithUsd(formatPriceForDisplay(row.price || "0"), usdRate)}</span>
                            <Link
                              href={`/listing/${encodeURIComponent(row.id)}`}
                              className="btn-frost px-3 py-1.5 text-xs border-white/20"
                            >
                              View
                            </Link>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
