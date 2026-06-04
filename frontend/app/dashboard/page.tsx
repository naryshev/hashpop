"use client";
import { listingHref } from "../../lib/listingUrl";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MessageSquare, ChevronDown, ChevronUp, User } from "lucide-react";
import { formatPriceForDisplay } from "../../lib/formatPrice";
import { formatHbarWithUsd } from "../../lib/hbarUsd";
import { useHbarUsd } from "../../hooks/useHbarUsd";
import { formatListingDate } from "../../lib/formatDate";
import { useHashpackWallet } from "../../lib/hashpackWallet";
import { useProfile } from "../../lib/profiles";
import { getApiUrl } from "../../lib/apiUrl";
import {
  consensusToDate,
  fetchAccountTransactions,
  AccountTransaction,
} from "../../lib/mirrorTx";
import { OnboardingChecklist } from "../../components/OnboardingChecklist";

function formatListingId(id: string): string {
  if (!id || !id.startsWith("0x") || id.length !== 66) return id;
  try {
    const hex = id.slice(2).replace(/0+$/, "");
    if (hex.length % 2) return id;
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
    const str = new TextDecoder().decode(bytes);
    return /^[\x20-\x7e]+$/.test(str) ? str : `${id.slice(0, 10)}…`;
  } catch {
    return `${id.slice(0, 10)}…`;
  }
}

function shortAddr(addr: string): string {
  if (!addr) return "";
  if (/^\d+\.\d+\.\d+$/.test(addr)) return addr;
  if (addr.startsWith("0x") && addr.length > 12) return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
  return addr;
}

type SaleItem = {
  id: string;
  listingId: string | null;
  buyer: string;
  seller: string;
  amount: string;
  txHash: string | null;
  createdAt: string;
  role: "buyer" | "seller";
  listing: { id: string; title: string | null; status: string; imageUrl: string | null } | null;
};

type ChatMsg = {
  id: string;
  fromAddress: string;
  toAddress: string;
  body: string;
  createdAt: string;
};

function SoldItemCard({
  sale,
  myAddress,
  usdRate,
}: {
  sale: SaleItem;
  myAddress: string;
  usdRate: number | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [msgsLoading, setMsgsLoading] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  const targetId = sale.listingId ?? sale.listing?.id ?? "";
  const listingTitle =
    sale.listing?.title || (targetId ? formatListingId(targetId) : "Untitled sale");

  const fetchMsgs = useCallback(async () => {
    if (!sale.buyer || !targetId) return;
    setMsgsLoading(true);
    try {
      const q = new URLSearchParams({ address: myAddress, other: sale.buyer, listingId: targetId });
      const res = await fetch(`${getApiUrl()}/api/messages/thread?${q}`);
      const data = (await res.json()) as { messages?: ChatMsg[] };
      setMsgs(data.messages ?? []);
    } catch {
      setMsgs([]);
    } finally {
      setMsgsLoading(false);
    }
  }, [sale.buyer, targetId, myAddress]);

  useEffect(() => {
    if (expanded) void fetchMsgs();
  }, [expanded, fetchMsgs]);

  const sendReply = async () => {
    if (!reply.trim() || sending || !sale.buyer || !targetId) return;
    setSending(true);
    try {
      await fetch(`${getApiUrl()}/api/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromAddress: myAddress,
          toAddress: sale.buyer,
          body: reply.trim(),
          listingId: targetId,
        }),
      });
      setReply("");
      await fetchMsgs();
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="glass-card rounded-xl overflow-hidden">
      {/* Summary row */}
      <div className="p-4 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {targetId ? (
            <Link
              href={listingHref(targetId)}
              className="text-white font-semibold hover:text-chrome truncate block"
            >
              {listingTitle}
            </Link>
          ) : (
            <p className="text-white font-semibold truncate">{listingTitle}</p>
          )}
          <p className="text-silver/70 text-xs mt-0.5 font-mono">Buyer: {shortAddr(sale.buyer)}</p>
          <p className="text-chrome font-semibold text-sm mt-1">
            {formatHbarWithUsd(sale.amount, usdRate)}
          </p>
          <p className="text-silver/50 text-xs mt-0.5">{formatListingDate(sale.createdAt)}</p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/20 text-silver hover:text-white hover:border-white/30 text-xs font-medium transition-colors shrink-0"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          <span>Messages</span>
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
      </div>

      {/* Expandable chat */}
      {expanded && (
        <div className="border-t border-white/10 p-4 space-y-3">
          {msgsLoading ? (
            <p className="text-silver text-sm">Loading…</p>
          ) : msgs.length === 0 ? (
            <p className="text-silver/60 text-sm">
              No messages yet. Use the box below to coordinate shipping or meetup with the buyer.
            </p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {msgs.map((m) => {
                const isMe = m.fromAddress.toLowerCase() === myAddress.toLowerCase();
                return (
                  <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-xs lg:max-w-sm rounded-lg px-3 py-2 text-sm ${
                        isMe
                          ? "bg-white/15 text-white"
                          : "bg-white/5 text-silver border border-white/10"
                      }`}
                    >
                      <p className="break-words">{m.body}</p>
                      <p className="text-[10px] text-white/40 mt-1">
                        {new Date(m.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void sendReply();
                }
              }}
              placeholder="Message buyer about shipping / meetup…"
              className="flex-1 bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#00ffa3]/50 transition-colors"
            />
            <button
              type="button"
              onClick={() => void sendReply()}
              disabled={sending || !reply.trim()}
              className="px-4 py-2 bg-white/10 border border-white/20 text-white text-sm font-medium rounded-lg hover:bg-white/20 transition-colors disabled:opacity-40"
            >
              {sending ? "…" : "Send"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function tinybarToHbarNum(tb: bigint | number | null | undefined): number {
  if (tb == null) return 0;
  const big = typeof tb === "bigint" ? tb : BigInt(Math.trunc(Number(tb)));
  // 1 HBAR = 1e8 tinybar — display as a JS number; precision is fine for KPI.
  const whole = Number(big / 100000000n);
  const frac = Number(big % 100000000n) / 1e8;
  return whole + frac;
}

function KPICard({
  label,
  value,
  unit,
  sub,
  accent,
}: {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  accent: string;
}) {
  return (
    <div className="rounded-glass-lg border border-white/10 bg-[#0e1422] p-[18px]">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-silver">
        {label}
      </div>
      <div
        className="mt-2.5 text-[32px] font-extrabold tracking-[-0.02em] leading-none"
        style={{ color: accent }}
      >
        {value}
        {unit ? <span className="ml-1 text-lg">{unit}</span> : null}
      </div>
      {sub ? <div className="mt-1.5 text-[11px] text-silver">{sub}</div> : null}
    </div>
  );
}

function activityLabel(tx: AccountTransaction, accountId: string): string {
  const me = accountId;
  const transfers = tx.transfers ?? [];
  const myDelta = transfers
    .filter((t) => t.account === me)
    .reduce((a, b) => a + Number(b.amount), 0);
  const name = (tx.name ?? "").replace(/_/g, " ").toLowerCase();
  if (name === "contractcall") {
    return `Contract call · ${tx.entity_id ?? "—"}`;
  }
  if (name === "cryptotransfer") {
    if (myDelta > 0) return `Received ${(myDelta / 1e8).toLocaleString()} ℏ`;
    if (myDelta < 0) return `Sent ${(Math.abs(myDelta) / 1e8).toLocaleString()} ℏ`;
    return "Crypto transfer";
  }
  return name.replace(/\b\w/g, (c) => c.toUpperCase()) || "Activity";
}

function activityTone(tx: AccountTransaction, accountId: string): string {
  const delta = (tx.transfers ?? [])
    .filter((t) => t.account === accountId)
    .reduce((a, b) => a + Number(b.amount), 0);
  if (delta > 0) return "#00ffa3";
  if (delta < 0) return "#fbbf24";
  return "#a78bfa";
}

function timeAgo(d: Date | null): string {
  if (!d) return "";
  const s = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export default function DashboardPage() {
  const { address, accountId, disconnect, balanceTinybar } = useHashpackWallet();
  const [mounted, setMounted] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [activeListings, setActiveListings] = useState<any[]>([]);
  const [soldItems, setSoldItems] = useState<SaleItem[]>([]);
  const [wishlistItems, setWishlistItems] = useState<
    { itemId: string; itemType: string; title?: string; price?: string; reservePrice?: string }[]
  >([]);
  const [purchaseCount, setPurchaseCount] = useState(0);
  const [offerCounts, setOfferCounts] = useState<{ received: number; sent: number }>({
    received: 0,
    sent: 0,
  });
  const [loading, setLoading] = useState(true);
  const [recent, setRecent] = useState<AccountTransaction[]>([]);
  const [escrowTinybar, setEscrowTinybar] = useState<number>(0);
  const usdRate = useHbarUsd();
  const myProfile = useProfile(address ?? null);
  const avatarUrl = myProfile?.avatarUrl?.trim() || null;
  const displayName = myProfile?.displayName?.trim() || null;

  useEffect(() => setMounted(true), []);

  // Recent activity ticker (top 5).
  useEffect(() => {
    if (!accountId) {
      setRecent([]);
      return;
    }
    const ac = new AbortController();
    fetchAccountTransactions(accountId, { max: 5, pageSize: 10, signal: ac.signal })
      .then((txs) => {
        if (!ac.signal.aborted) setRecent(txs);
      })
      .catch(() => {
        if (!ac.signal.aborted) setRecent([]);
      });
    return () => ac.abort();
  }, [accountId]);

  useEffect(() => {
    let cancelled = false;
    setStats(null);
    setActiveListings([]);
    setSoldItems([]);
    setWishlistItems([]);
    setPurchaseCount(0);
    setOfferCounts({ received: 0, sent: 0 });
    if (!address) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([
      fetch(`${getApiUrl()}/api/user/${address}`)
        .then((res) => res.json())
        .then((d) => {
          if (!cancelled) setStats(d);
        })
        .catch(() => {
          if (!cancelled) setStats(null);
        }),
      fetch(`${getApiUrl()}/api/user/${address}/listings`)
        .then((res) => res.json())
        .then((data: { active?: any[] }) => {
          if (cancelled) return;
          setActiveListings(data.active ?? []);
        })
        .catch(() => {
          if (cancelled) return;
          setActiveListings([]);
        }),
      fetch(`${getApiUrl()}/api/wishlist?address=${encodeURIComponent(address)}`)
        .then((res) => (res.ok ? res.json() : Promise.reject()))
        .then((data: { items?: { itemId: string; itemType: string }[] }) => {
          const items = data.items ?? [];
          Promise.all(
            items
              .filter((w) => w.itemType === "listing")
              .map((w) =>
                fetch(`${getApiUrl()}/api/listing/${encodeURIComponent(w.itemId)}`)
                  .then((r) => (r.ok ? r.json() : null))
                  .then((d) => ({
                    itemId: w.itemId,
                    itemType: "listing" as const,
                    ...(d?.listing ?? {}),
                  })),
              ),
          ).then((rows) => {
            if (!cancelled) setWishlistItems(rows);
          });
        })
        .catch(() => {
          if (!cancelled) setWishlistItems([]);
        }),
      fetch(`${getApiUrl()}/api/user/${address}/purchases`)
        .then((res) => (res.ok ? res.json() : Promise.reject(res)))
        .then(async (data: { purchases?: SaleItem[] & { listingId?: string }[] }) => {
          if (cancelled) return;
          const all = data.purchases ?? [];
          setPurchaseCount(all.filter((s) => s.role === "buyer").length);
          setSoldItems(all.filter((s) => s.role === "seller"));
          // Sum on-chain escrow amounts for any non-COMPLETE escrow this user
          // is party to. These are the funds "in flight" — the KPI hero card.
          const ids = Array.from(
            new Set(
              all
                .map((r) => (r as unknown as { listingId?: string | null }).listingId)
                .filter((x): x is string => !!x),
            ),
          );
          let total = 0;
          await Promise.allSettled(
            ids.map((lid) =>
              fetch(`${getApiUrl()}/api/escrow/${encodeURIComponent(lid)}`)
                .then((r) => (r.ok ? r.json() : null))
                .then((e: { state?: string; amount?: string } | null) => {
                  if (!e || e.state === "COMPLETE" || !e.amount) return;
                  // amount is stored as tinybar (current) or wei (legacy) — we
                  // accumulate in tinybar; wei amounts are ~1e10× larger so we
                  // detect and rescale.
                  try {
                    const n = BigInt(e.amount);
                    const tb = n >= 10n ** 15n ? Number(n / 10n ** 10n) : Number(n);
                    total += tb;
                  } catch {
                    /* skip */
                  }
                }),
            ),
          );
          if (!cancelled) setEscrowTinybar(total);
        })
        .catch(() => {
          if (!cancelled) {
            setPurchaseCount(0);
            setSoldItems([]);
            setEscrowTinybar(0);
          }
        }),
      fetch(`${getApiUrl()}/api/user/${address}/offers`)
        .then((res) => (res.ok ? res.json() : Promise.reject(res)))
        .then((data: { received?: { status: string }[]; sent?: { status: string }[] }) => {
          if (cancelled) return;
          const isActive = (o: { status: string }) => o.status === "ACTIVE";
          setOfferCounts({
            received: (data.received ?? []).filter(isActive).length,
            sent: (data.sent ?? []).filter(isActive).length,
          });
        })
        .catch(() => {
          if (!cancelled) setOfferCounts({ received: 0, sent: 0 });
        }),
    ]).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [address]);

  return (
    <main className="min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-8">
        <div className="space-y-8" suppressHydrationWarning>
          {!mounted ? (
            <p className="text-silver">Loading…</p>
          ) : !address ? (
            <p className="text-silver">Please connect your wallet to see your dashboard.</p>
          ) : (
            <>
              {/* Greeting + actions — one aligned row */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={avatarUrl}
                      alt=""
                      className="h-12 w-12 shrink-0 rounded-full border border-white/10 object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-silver/60">
                      <User size={22} />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-silver">
                      Welcome back
                    </div>
                    <h1 className="mt-0.5 truncate text-[24px] font-extrabold tracking-[-0.01em] text-white sm:text-[28px]">
                      {displayName ?? (accountId ? `@${accountId}` : "My Hashpop")}
                    </h1>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/profile/${encodeURIComponent(address)}`}
                    className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold text-chrome hover:bg-white/5"
                  >
                    ★ {Number(stats?.ratingAverage ?? 0).toFixed(1)}
                  </Link>
                  <Link
                    href="/create"
                    className="rounded-full bg-[linear-gradient(110deg,#00b37a_0%,#00ffa3_50%,#00e5ff_100%)] px-3.5 py-2 text-xs font-bold text-black shadow-glow"
                  >
                    + List item
                  </Link>
                  <Link
                    href={`/profile/${encodeURIComponent(address)}?edit=1`}
                    className="rounded-full border border-white/10 px-3.5 py-2 text-xs text-white hover:bg-white/5"
                  >
                    Edit profile
                  </Link>
                  <Link
                    href="/purchases"
                    className="rounded-full border border-white/10 px-3.5 py-2 text-xs text-white hover:bg-white/5"
                  >
                    Purchases
                  </Link>
                  <button
                    type="button"
                    onClick={() => void disconnect()}
                    className="rounded-full border border-rose-500/60 bg-rose-500/10 px-3.5 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-500/20"
                  >
                    Sign out
                  </button>
                </div>
              </div>

              {/* Onboarding checklist — only for brand-new users. */}
              <OnboardingChecklist
                address={address}
                hasListings={activeListings.length > 0}
                hasTrades={(stats?.totalSales ?? 0) + purchaseCount > 0}
              />

              {/* KPI cards */}
              <div className="grid gap-3.5 md:grid-cols-4">
                <KPICard
                  label="Wallet balance"
                  value={Math.round(tinybarToHbarNum(balanceTinybar)).toLocaleString()}
                  unit="ℏ"
                  sub={
                    balanceTinybar != null && usdRate
                      ? `≈ $${Math.round(tinybarToHbarNum(balanceTinybar) * usdRate).toLocaleString()} USD`
                      : "Connect wallet to view"
                  }
                  accent="#00ffa3"
                />
                <KPICard
                  label="In escrow"
                  value={Math.round(escrowTinybar / 1e8).toLocaleString()}
                  unit="ℏ"
                  sub={`${purchaseCount + soldItems.length} active orders`}
                  accent="#fbbf24"
                />
                <KPICard
                  label="Trades"
                  value={String((stats?.totalSales ?? 0) + purchaseCount)}
                  sub={`${stats?.totalSales ?? 0} sold · ${purchaseCount} bought`}
                  accent="#00e5ff"
                />
                <KPICard
                  label="Avg rating"
                  value={Number(stats?.ratingAverage ?? 0).toFixed(1)}
                  unit="★"
                  sub={`${stats?.ratingCount ?? 0} ratings`}
                  accent="#a78bfa"
                />
              </div>

              {/* Recent on-chain activity */}
              <div className="rounded-glass-lg border border-white/10 bg-[#0e1422] p-[18px]">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-silver">
                    Recent activity
                  </div>
                  <Link href="/activity" className="text-[11px] text-chrome hover:text-white">
                    View all
                  </Link>
                </div>
                {recent.length === 0 ? (
                  <p className="text-sm text-silver">No on-chain activity yet.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {recent.map((tx) => (
                      <li
                        key={tx.transaction_id}
                        className="flex items-center gap-2.5 text-[12px]"
                      >
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{
                            background: activityTone(tx, accountId ?? ""),
                          }}
                        />
                        <span className="flex-1 truncate text-white">
                          {activityLabel(tx, accountId ?? "")}
                        </span>
                        <span className="font-mono text-[11px] text-silver">
                          {timeAgo(consensusToDate(tx.consensus_timestamp))}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Active Listings */}
              <section>
                <h2 className="text-lg font-semibold text-white mb-3">Current Listings</h2>
                {loading ? (
                  <p className="text-silver">Loading…</p>
                ) : activeListings.length === 0 ? (
                  <p className="text-silver">
                    No active listings.{" "}
                    <Link href="/create" className="text-chrome hover:text-white underline">
                      Create one
                    </Link>
                    .
                  </p>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {activeListings.map((row) => {
                      const thumb =
                        row.imageUrl || (Array.isArray(row.mediaUrls) && row.mediaUrls[0]) || null;
                      const statusColor =
                        row.status === "LOCKED"
                          ? "text-amber-400 border-amber-500/40 bg-amber-500/10"
                          : row.status === "SOLD"
                            ? "text-rose-400 border-rose-500/40 bg-rose-500/10"
                            : "text-[#00ffa3] border-[#00ffa3]/30 bg-[#00ffa3]/5";
                      return (
                        <Link
                          key={`${row.itemType || "listing"}-${row.id}`}
                          href={listingHref(row.id)}
                          className="glass-card group flex flex-col overflow-hidden hover:border-white/20 transition-colors"
                        >
                          {/* Thumbnail */}
                          <div className="relative aspect-[4/3] w-full bg-white/5 overflow-hidden">
                            {thumb ? (
                              <img
                                src={thumb}
                                alt={row.title || ""}
                                className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <span className="text-white/20 text-4xl select-none">□</span>
                              </div>
                            )}
                            {/* Status badge */}
                            <span
                              className={`absolute top-2 right-2 text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 border ${statusColor}`}
                            >
                              {row.status === "ACTIVE"
                                ? "Active"
                                : row.status === "LOCKED"
                                  ? "In Escrow"
                                  : row.status || "Active"}
                            </span>
                          </div>

                          {/* Info */}
                          <div className="flex flex-col flex-1 p-4 gap-1">
                            <p className="text-white font-semibold text-sm leading-snug line-clamp-2 group-hover:text-chrome transition-colors">
                              {row.title || formatListingId(row.id) || row.id.slice(0, 10) + "…"}
                            </p>
                            <p className="text-chrome font-semibold text-sm mt-auto pt-2">
                              {formatHbarWithUsd(
                                formatPriceForDisplay(row.price || row.reservePrice || "0"),
                                usdRate,
                              )}
                            </p>
                            <p className="text-silver/50 text-xs">
                              {formatListingDate(row.createdAt)}
                            </p>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Sold Items */}
              <section>
                <h2 className="text-lg font-semibold text-white mb-3">Sold Items</h2>
                {loading ? (
                  <p className="text-silver">Loading…</p>
                ) : soldItems.length === 0 ? (
                  <p className="text-silver">No sold items yet.</p>
                ) : (
                  <div className="space-y-3">
                    {soldItems.map((sale) => (
                      <SoldItemCard
                        key={sale.id}
                        sale={sale}
                        myAddress={address}
                        usdRate={usdRate}
                      />
                    ))}
                  </div>
                )}
              </section>

              {/* Watchlist */}
              <section>
                <h2 className="text-lg font-semibold text-white mb-3">Watchlist</h2>
                {loading ? (
                  <p className="text-silver">Loading…</p>
                ) : wishlistItems.length === 0 ? (
                  <p className="text-silver">
                    No watchlist items. Add listings from the marketplace with the ♡ or + Add to
                    wishlist button.
                  </p>
                ) : (
                  <div className="glass-card overflow-hidden rounded-xl">
                    <ul className="divide-y divide-white/5">
                      {wishlistItems.map((w) => (
                        <li
                          key={w.itemId}
                          className="flex items-center justify-between p-3 hover:bg-white/5"
                        >
                          <Link
                            href={listingHref(w.itemId)}
                            className="text-white hover:text-chrome font-medium flex-1 min-w-0 truncate"
                          >
                            {w.title || formatListingId(w.itemId) || w.itemId.slice(0, 10) + "…"}
                          </Link>
                          <span className="text-chrome text-sm shrink-0 ml-2">
                            {formatHbarWithUsd(
                              formatPriceForDisplay(w.price || w.reservePrice || "0"),
                              usdRate,
                            )}
                          </span>
                          <Link
                            href={listingHref(w.itemId)}
                            className="text-chrome hover:text-white text-sm shrink-0 ml-2"
                          >
                            View
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>

            </>
          )}
        </div>
      </div>
    </main>
  );
}
