"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { MessageSquare, ChevronDown, ChevronUp } from "lucide-react";
import { formatPriceForDisplay } from "../../lib/formatPrice";
import { formatHbarWithUsd } from "../../lib/hbarUsd";
import { useHbarUsd } from "../../hooks/useHbarUsd";
import { formatListingDate } from "../../lib/formatDate";
import { useHashpackWallet } from "../../lib/hashpackWallet";
import { getApiUrl } from "../../lib/apiUrl";
import { ConnectWalletButton } from "../../components/ConnectWalletButton";

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
              href={`/listing/${encodeURIComponent(targetId)}`}
              className="text-white font-semibold hover:text-chrome truncate block"
            >
              {listingTitle}
            </Link>
          ) : (
            <p className="text-white font-semibold truncate">{listingTitle}</p>
          )}
          <p className="text-silver/70 text-xs mt-0.5 font-mono">
            Buyer: {shortAddr(sale.buyer)}
          </p>
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
          {expanded ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
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

export default function DashboardPage() {
  const { address, accountId, disconnect } = useHashpackWallet();
  const [mounted, setMounted] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [activeListings, setActiveListings] = useState<any[]>([]);
  const [soldItems, setSoldItems] = useState<SaleItem[]>([]);
  const [wishlistItems, setWishlistItems] = useState<
    { itemId: string; itemType: string; title?: string; price?: string; reservePrice?: string }[]
  >([]);
  const [purchaseCount, setPurchaseCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const usdRate = useHbarUsd();

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    let cancelled = false;
    setStats(null);
    setActiveListings([]);
    setSoldItems([]);
    setWishlistItems([]);
    setPurchaseCount(0);
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
        .then((data: { purchases?: SaleItem[] }) => {
          if (!cancelled) {
            const all = data.purchases ?? [];
            setPurchaseCount(all.filter((s) => s.role === "buyer").length);
            setSoldItems(all.filter((s) => s.role === "seller"));
          }
        })
        .catch(() => {
          if (!cancelled) {
            setPurchaseCount(0);
            setSoldItems([]);
          }
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
        <div className="flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-bold text-white">{accountId || "My Hashpop"}</h1>
          {address && (
            <Link
              href={`/profile/${encodeURIComponent(address)}`}
              className="text-sm text-chrome hover:text-white font-medium"
            >
              ★ {Number(stats?.ratingAverage ?? 0).toFixed(1)}
            </Link>
          )}
        </div>

        <div className="space-y-8" suppressHydrationWarning>
          {!mounted ? (
            <p className="text-silver">Loading…</p>
          ) : !address ? (
            <div className="flex flex-col items-start gap-3">
              <p className="text-silver">Connect your wallet to see your dashboard.</p>
              <ConnectWalletButton className="btn-frost-cta disabled:opacity-50" />
            </div>
          ) : (
            <>
              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="glass-card p-3 sm:p-4 rounded-xl">
                  <p className="text-xs sm:text-sm text-silver">Sales</p>
                  <p className="text-xl sm:text-2xl font-semibold text-white mt-1">{stats?.totalSales ?? 0}</p>
                </div>
                <div className="glass-card p-3 sm:p-4 rounded-xl">
                  <p className="text-xs sm:text-sm text-silver">Listings</p>
                  <p className="text-xl sm:text-2xl font-semibold text-white mt-1">
                    {stats?.activeListings ?? 0}
                  </p>
                </div>
                <div className="glass-card p-3 sm:p-4 rounded-xl">
                  <p className="text-xs sm:text-sm text-silver">Purchases</p>
                  <p className="text-xl sm:text-2xl font-semibold text-white mt-1">{purchaseCount}</p>
                  <Link
                    href="/purchases"
                    className="text-[10px] sm:text-xs text-chrome hover:text-white mt-1 inline-block"
                  >
                    View history
                  </Link>
                </div>
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
                      const thumb = row.imageUrl || (Array.isArray(row.mediaUrls) && row.mediaUrls[0]) || null;
                      const statusColor =
                        row.status === "LOCKED"
                          ? "text-amber-400 border-amber-500/40 bg-amber-500/10"
                          : row.status === "SOLD"
                          ? "text-rose-400 border-rose-500/40 bg-rose-500/10"
                          : "text-[#00ffa3] border-[#00ffa3]/30 bg-[#00ffa3]/5";
                      return (
                        <Link
                          key={`${row.itemType || "listing"}-${row.id}`}
                          href={`/listing/${encodeURIComponent(row.id)}`}
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
                            <p className="text-silver/50 text-xs">{formatListingDate(row.createdAt)}</p>
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
                            href={`/listing/${encodeURIComponent(w.itemId)}`}
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
                            href={`/listing/${encodeURIComponent(w.itemId)}`}
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

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    void disconnect();
                  }}
                  className="inline-flex items-center rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-silver transition hover:border-white/30 hover:text-white"
                >
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
