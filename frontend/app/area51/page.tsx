"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ShieldAlert, Trash2 } from "lucide-react";
import { useHashpackWallet } from "../../lib/hashpackWallet";
import { ConnectWalletButton } from "../../components/ConnectWalletButton";
import { getApiUrl } from "../../lib/apiUrl";

type AdminToken = { address: string; t: number; signature: string };

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
  updatedAt: string;
  onChainConfirmed: boolean;
  disputeStatus: string | null;
};

type AdminStats = {
  listings: { total: number; active: number; pending: number; sold: number; locked: number };
  sales: { count: number; volumeHbar: string };
  users: { count: number };
};

const TOKEN_KEY = "hashpop.admin.token";
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

function loadToken(): AdminToken | null {
  try {
    const raw = window.localStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const t = JSON.parse(raw) as AdminToken;
    if (typeof t?.address !== "string" || typeof t?.t !== "number" || typeof t?.signature !== "string") {
      return null;
    }
    if (Date.now() - t.t > SESSION_TTL_MS) return null;
    return t;
  } catch {
    return null;
  }
}

function saveToken(t: AdminToken | null) {
  try {
    if (t) window.localStorage.setItem(TOKEN_KEY, JSON.stringify(t));
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

function adminHeader(token: AdminToken): Record<string, string> {
  const encoded = typeof window !== "undefined"
    ? window.btoa(JSON.stringify(token))
    : Buffer.from(JSON.stringify(token)).toString("base64");
  return { "x-admin-token": encoded };
}

function truncateAddr(addr?: string | null): string {
  if (!addr) return "—";
  if (addr.startsWith("0x") && addr.length === 42) {
    return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
  }
  return addr;
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-glass-lg border border-white/10 bg-[#0e1422] p-4">
      <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-silver">{label}</div>
      <div
        className="mt-2 text-2xl font-extrabold tracking-tight"
        style={{ color: accent ?? "#ffffff" }}
      >
        {value}
      </div>
    </div>
  );
}

export default function Area51Page() {
  const { address, accountId, hashconnect, isConnected } = useHashpackWallet();
  const [token, setToken] = useState<AdminToken | null>(null);
  const [tokenHydrated, setTokenHydrated] = useState(false);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [listings, setListings] = useState<AdminListing[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [deleting, setDeleting] = useState<string | null>(null);

  // Restore session token on mount.
  useEffect(() => {
    setToken(loadToken());
    setTokenHydrated(true);
  }, []);

  // Whenever the connected wallet changes, ask the backend whether the wallet
  // is in the admin allowlist. This is the only unauthenticated admin call —
  // it lets the page decide whether to render the sign-in prompt or the
  // "Nothing here." stub.
  useEffect(() => {
    if (!address) {
      setIsAdmin(null);
      return;
    }
    let cancelled = false;
    fetch(`${getApiUrl()}/api/admin/check?address=${encodeURIComponent(address)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((d: { isAdmin?: boolean }) => {
        if (!cancelled) setIsAdmin(!!d.isAdmin);
      })
      .catch(() => {
        if (!cancelled) setIsAdmin(false);
      });
    return () => {
      cancelled = true;
    };
  }, [address]);

  // Clear the stored token if it doesn't belong to the connected wallet.
  useEffect(() => {
    if (!token || !address) return;
    if (token.address.toLowerCase() !== address.toLowerCase()) {
      saveToken(null);
      setToken(null);
    }
  }, [token, address]);

  const loadData = useCallback(
    async (tok: AdminToken) => {
      setLoading(true);
      setError(null);
      try {
        const headers = adminHeader(tok);
        const params = new URLSearchParams();
        if (filter.trim()) params.set("q", filter.trim());
        if (statusFilter) params.set("status", statusFilter);
        const [sRes, lRes] = await Promise.all([
          fetch(`${getApiUrl()}/api/admin/stats`, { headers }),
          fetch(`${getApiUrl()}/api/admin/listings?${params}`, { headers }),
        ]);
        if (sRes.status === 401 || lRes.status === 401 || sRes.status === 403 || lRes.status === 403) {
          saveToken(null);
          setToken(null);
          setError("Admin session expired. Please sign in again.");
          return;
        }
        if (sRes.ok) setStats(await sRes.json());
        if (lRes.ok) {
          const data = (await lRes.json()) as { listings?: AdminListing[] };
          setListings(data.listings ?? []);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load admin data");
      } finally {
        setLoading(false);
      }
    },
    [filter, statusFilter],
  );

  useEffect(() => {
    if (token) void loadData(token);
  }, [token, loadData]);

  const signIn = useCallback(async () => {
    if (!address || !accountId || !hashconnect) return;
    setSigning(true);
    setError(null);
    try {
      const t = Date.now();
      const message = `hashpop.admin.session:${t}`;
      const signResult = await (
        hashconnect as unknown as {
          signMessages: (accountId: string, messages: string[]) => Promise<unknown>;
        }
      ).signMessages(accountId, [message]);
      const signature = Array.isArray(signResult)
        ? (signResult[0] as string)
        : ((signResult as { signedMessages?: string[] })?.signedMessages?.[0] ??
          (signResult as string));
      if (!signature || typeof signature !== "string") {
        throw new Error("Could not get a signature from your wallet.");
      }
      const tok: AdminToken = { address: address.toLowerCase(), t, signature };
      saveToken(tok);
      setToken(tok);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to sign in.");
    } finally {
      setSigning(false);
    }
  }, [address, accountId, hashconnect]);

  const deleteListing = useCallback(
    async (id: string, title: string | null) => {
      if (!token) return;
      const label = title || id.slice(0, 12) + "…";
      if (!window.confirm(`Permanently remove "${label}" from the marketplace?`)) return;
      setDeleting(id);
      try {
        const res = await fetch(
          `${getApiUrl()}/api/admin/listing/${encodeURIComponent(id)}`,
          {
            method: "DELETE",
            headers: adminHeader(token),
          },
        );
        if (res.status === 401 || res.status === 403) {
          saveToken(null);
          setToken(null);
          setError("Admin session expired.");
          return;
        }
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error || "Delete failed");
        }
        setListings((prev) => prev.filter((l) => l.id !== id));
        if (stats) {
          setStats({
            ...stats,
            listings: { ...stats.listings, total: Math.max(0, stats.listings.total - 1) },
          });
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Delete failed");
      } finally {
        setDeleting(null);
      }
    },
    [token, stats],
  );

  const signOut = useCallback(() => {
    saveToken(null);
    setToken(null);
  }, []);

  const visibleListings = useMemo(() => listings, [listings]);

  // ---- Render branches ----
  // Hide that this is even an admin page from non-admin viewers — render a
  // generic stub instead.
  if (!isConnected) {
    return (
      <main className="min-h-screen">
        <div className="mx-auto max-w-md px-4 py-16 text-center space-y-4">
          <p className="text-silver text-sm">Sign in to continue.</p>
          <ConnectWalletButton />
        </div>
      </main>
    );
  }

  if (isAdmin === null || !tokenHydrated) {
    return (
      <main className="min-h-screen">
        <div className="mx-auto max-w-md px-4 py-16 text-center text-silver text-sm">
          Checking access…
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen">
        <div className="mx-auto max-w-md px-4 py-16 text-center text-silver text-sm">
          Nothing here.
        </div>
      </main>
    );
  }

  if (!token) {
    return (
      <main className="min-h-screen">
        <div className="mx-auto max-w-md px-4 py-16 text-center space-y-4">
          <div className="inline-flex items-center justify-center rounded-full bg-amber-400/10 p-3">
            <ShieldAlert size={28} className="text-amber-300" />
          </div>
          <h1 className="text-xl font-bold text-white">Admin sign-in</h1>
          <p className="text-sm text-silver">
            You&apos;ll be asked to sign a session message in HashPack. The signature is kept on this
            device for 24 hours.
          </p>
          {error && <p className="text-xs text-rose-300">{error}</p>}
          <button
            type="button"
            onClick={signIn}
            disabled={signing}
            className="rounded-full bg-[#00ffa3] px-5 py-2.5 text-sm font-bold text-black disabled:opacity-60"
          >
            {signing ? "Waiting on wallet…" : "Sign in to area 51"}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-rose-300/80">
              Restricted
            </p>
            <h1 className="text-2xl font-extrabold tracking-tight text-white">Area 51</h1>
            <p className="text-xs text-silver">
              Signed in as <span className="font-mono text-chrome">{truncateAddr(token.address)}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => token && void loadData(token)}
              disabled={loading}
              className="rounded-full border border-white/15 bg-white/5 px-3.5 py-2 text-xs text-white hover:bg-white/10 disabled:opacity-60"
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
            <button
              type="button"
              onClick={signOut}
              className="rounded-full border border-rose-500/60 bg-rose-500/10 px-3.5 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-500/20"
            >
              Sign out
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
            {error}
          </div>
        )}

        {stats && (
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard label="Total" value={String(stats.listings.total)} accent="#ffffff" />
            <StatCard label="Active" value={String(stats.listings.active)} accent="#00ffa3" />
            <StatCard label="Pending" value={String(stats.listings.pending)} accent="#fbbf24" />
            <StatCard label="Locked" value={String(stats.listings.locked)} accent="#f97316" />
            <StatCard label="Sold" value={String(stats.listings.sold)} accent="#a78bfa" />
            <StatCard
              label="Volume"
              value={`${stats.sales.volumeHbar} ℏ`}
              accent="#00e5ff"
            />
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
            onClick={() => token && void loadData(token)}
            className="rounded-full border border-white/15 bg-white/5 px-3.5 py-2 text-xs text-white hover:bg-white/10"
          >
            Apply
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
              {visibleListings.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-silver">
                    {loading ? "Loading…" : "No listings match the current filter."}
                  </td>
                </tr>
              ) : (
                visibleListings.map((l) => (
                  <tr key={l.id} className="align-middle">
                    <td className="px-3 py-2">
                      {l.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={l.imageUrl}
                          alt=""
                          className="h-10 w-10 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-lg bg-white/5" />
                      )}
                    </td>
                    <td className="max-w-[220px] truncate px-3 py-2 text-white">
                      <a
                        href={`/listing/${encodeURIComponent(l.id)}`}
                        className="hover:text-chrome"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {l.title || l.id.slice(0, 14) + "…"}
                      </a>
                      {l.category && (
                        <div className="text-[10px] text-silver">{l.category}</div>
                      )}
                      {l.disputeStatus === "OPEN" && (
                        <div className="text-[10px] font-semibold text-amber-300">
                          Dispute open
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-silver">
                      {truncateAddr(l.seller)}
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
    </main>
  );
}
