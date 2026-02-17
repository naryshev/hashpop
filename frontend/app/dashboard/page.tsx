"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";

export default function DashboardPage() {
  const { address } = useAccount();
  const [stats, setStats] = useState<any>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

  useEffect(() => {
    if (!address) return;
    fetch(`${apiUrl}/api/user/${address}`)
      .then((res) => res.json())
      .then(setStats)
      .catch(() => setStats(null));
  }, [address, apiUrl]);

  if (!address) {
    return (
      <main className="p-6 max-w-6xl mx-auto">
        <p className="text-silver">Please connect your wallet to see your dashboard.</p>
      </main>
    );
  }

  return (
    <main className="p-6 space-y-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-semibold text-white">Dashboard</h1>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="glass-card p-4">
          <p className="text-sm text-silver">Total Sales</p>
          <p className="text-2xl font-semibold text-white mt-1">{stats?.totalSales || 0}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-sm text-silver">Active Listings</p>
          <p className="text-2xl font-semibold text-white mt-1">{stats?.activeListings || 0}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-sm text-silver">Reputation</p>
          <p className="text-2xl font-semibold text-chrome mt-1">{stats?.reputation || "N/A"}</p>
        </div>
      </div>
    </main>
  );
}
