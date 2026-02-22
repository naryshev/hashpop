"use client";

import { useCallback, useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { formatPriceForDisplay } from "../../lib/formatPrice";
import { formatHbarWithUsd } from "../../lib/hbarUsd";
import { useHbarUsd } from "../../hooks/useHbarUsd";
import { formatListingDate } from "../../lib/formatDate";
import { AddressDisplay } from "../../components/AddressDisplay";
import { useHashpackWallet } from "../../lib/hashpackWallet";

import { getApiUrl } from "../../lib/apiUrl";

type InboxConversation = {
  otherAddress: string;
  listingId: string | null;
  topicId?: string;
  lastMessage: { fromAddress: string; toAddress: string; body: string; createdAt: string };
  preview: string;
};

type Message = {
  id: string;
  fromAddress: string;
  toAddress: string;
  body: string;
  listingId: string | null;
  createdAt: string;
};

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

type Listing = {
  id: string;
  seller: string;
  price: string;
  status: string;
  title?: string | null;
  imageUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

function DashboardPageContent() {
  const { address } = useHashpackWallet();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [activeListings, setActiveListings] = useState<any[]>([]);
  const [archivedListings, setArchivedListings] = useState<any[]>([]);
  const [wishlistItems, setWishlistItems] = useState<{ itemId: string; itemType: string; title?: string; price?: string; reservePrice?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [conversations, setConversations] = useState<InboxConversation[]>([]);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [selectedThread, setSelectedThread] = useState<{ other: string; listingId: string | null } | null>(null);
  const [threadMessages, setThreadMessages] = useState<Message[]>([]);
  const [threadTopicId, setThreadTopicId] = useState<string | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [sending, setSending] = useState(false);
  const usdRate = useHbarUsd();

  useEffect(() => setMounted(true), []);

  const openThreadFromUrl = useCallback(() => {
    const open = searchParams.get("openThread");
    const listingId = searchParams.get("listingId");
    const showInbox = searchParams.get("inbox") === "1";
    if (address && showInbox) setInboxOpen(true);
    if (address && open) setSelectedThread({ other: decodeURIComponent(open), listingId: listingId ? decodeURIComponent(listingId) : null });
  }, [address, searchParams]);

  useEffect(() => {
    if (!address) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([
      fetch(`${getApiUrl()}/api/user/${address}`).then((res) => res.json()).then(setStats).catch(() => setStats(null)),
      fetch(`${getApiUrl()}/api/user/${address}/listings`)
        .then((res) => res.json())
        .then((data: { active?: any[]; archived?: any[] }) => {
          setActiveListings(data.active ?? []);
          setArchivedListings(data.archived ?? []);
        })
        .catch(() => {
          setActiveListings([]);
          setArchivedListings([]);
        }),
      fetch(`${getApiUrl()}/api/wishlist?address=${encodeURIComponent(address)}`)
        .then((res) => res.ok ? res.json() : Promise.reject())
        .then((data: { items?: { itemId: string; itemType: string }[] }) => {
          const items = data.items ?? [];
          Promise.all(
            items
            .filter((w) => w.itemType === "listing")
            .map((w) =>
              fetch(`${getApiUrl()}/api/listing/${encodeURIComponent(w.itemId)}`)
                .then((r) => r.ok ? r.json() : null)
                .then((d) => ({ itemId: w.itemId, itemType: "listing" as const, ...(d?.listing ?? {}) }))
            )
          ).then(setWishlistItems);
        })
        .catch(() => setWishlistItems([])),
    ]).finally(() => setLoading(false));
    openThreadFromUrl();
  }, [address, openThreadFromUrl]);

  useEffect(() => {
    if (!address || !inboxOpen) return;
    setInboxLoading(true);
    fetch(`${getApiUrl()}/api/messages/inbox?address=${encodeURIComponent(address)}`)
      .then((res) => res.json())
      .then((data: { conversations?: InboxConversation[] }) => setConversations(data.conversations ?? []))
      .catch(() => setConversations([]))
      .finally(() => setInboxLoading(false));
  }, [address, inboxOpen]);

  useEffect(() => {
    if (!address || !selectedThread) {
      setThreadMessages([]);
      return;
    }
    setThreadLoading(true);
    const q = new URLSearchParams({ address, other: selectedThread.other });
    if (selectedThread.listingId) q.set("listingId", selectedThread.listingId);
    fetch(`${getApiUrl()}/api/messages/thread?${q}`)
      .then((res) => res.json())
      .then((data: { messages?: Message[]; topicId?: string }) => {
        setThreadMessages(data.messages ?? []);
        setThreadTopicId(data.topicId ?? null);
      })
      .catch(() => {
        setThreadMessages([]);
        setThreadTopicId(null);
      })
      .finally(() => setThreadLoading(false));
  }, [address, selectedThread]);

  const fetchInbox = useCallback(() => {
    if (!address || !inboxOpen) return;
    fetch(`${getApiUrl()}/api/messages/inbox?address=${encodeURIComponent(address)}`)
      .then((res) => res.json())
      .then((data: { conversations?: InboxConversation[] }) => setConversations(data.conversations ?? []))
      .catch(() => setConversations([]));
  }, [address, inboxOpen]);

  const sendReply = useCallback(async () => {
    if (!address || !selectedThread || !replyBody.trim() || sending) return;
    setSending(true);
    try {
      const sendRes = await fetch(`${getApiUrl()}/api/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromAddress: address,
          toAddress: selectedThread.other,
          body: replyBody.trim(),
          listingId: selectedThread.listingId,
        }),
      });
      if (!sendRes.ok) {
        // Ignore soft failures; UI thread refresh handles eventual consistency.
      }
      setReplyBody("");
      const q = new URLSearchParams({ address, other: selectedThread.other });
      if (selectedThread.listingId) q.set("listingId", selectedThread.listingId);
      const res = await fetch(`${getApiUrl()}/api/messages/thread?${q}`);
      const data = await res.json();
      setThreadMessages(data.messages ?? []);
      setThreadTopicId(data.topicId ?? null);
      fetchInbox();
    } finally {
      setSending(false);
    }
  }, [address, selectedThread, replyBody, sending, fetchInbox]);

  return (
    <main className="min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-bold text-white">Dashboard</h1>
          <Link href="/" className="text-sm text-chrome hover:text-white font-medium">Home</Link>
        </div>

      <div suppressHydrationWarning>
      {!mounted ? (
        <p className="text-silver">Loading…</p>
      ) : !address ? (
        <p className="text-silver">Please connect your wallet to see your dashboard.</p>
      ) : (
        <>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="glass-card p-4 rounded-xl">
          <p className="text-sm text-silver">Total Sales</p>
          <p className="text-2xl font-semibold text-white mt-1">{stats?.totalSales ?? 0}</p>
        </div>
        <div className="glass-card p-4 rounded-xl">
          <p className="text-sm text-silver">Active Listings</p>
          <p className="text-2xl font-semibold text-white mt-1">{stats?.activeListings ?? 0}</p>
        </div>
        <div className="glass-card p-4 rounded-xl">
          <p className="text-sm text-silver">Reputation</p>
          <p className="text-2xl font-semibold text-chrome mt-1">{stats?.reputation ?? "N/A"}</p>
        </div>
      </div>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-white">Inbox</h2>
          <button
            type="button"
            onClick={() => { setInboxOpen((o) => !o); if (!inboxOpen) setSelectedThread(null); }}
            className="btn-frost text-sm py-2 px-3"
          >
            {inboxOpen ? "Hide" : "Show messages"}
          </button>
        </div>
        {inboxOpen && (
          <div className="glass-card overflow-hidden flex flex-col md:flex-row min-h-[320px] rounded-xl">
            <div className={`border-b md:border-b-0 md:border-r border-white/10 ${selectedThread ? "md:w-80 shrink-0" : "w-full"}`}>
              {inboxLoading ? (
                <p className="p-4 text-silver text-sm">Loading…</p>
              ) : conversations.length === 0 ? (
                <p className="p-4 text-silver text-sm">No messages yet.</p>
              ) : (
                <ul className="divide-y divide-white/5">
                  {conversations.map((c) => {
                    const isSelected = selectedThread?.other === c.otherAddress && selectedThread?.listingId === (c.listingId ?? null);
                    return (
                      <li key={`${c.otherAddress}-${c.listingId ?? ""}`}>
                        <button
                          type="button"
                          onClick={() => setSelectedThread({ other: c.otherAddress, listingId: c.listingId })}
                          className={`w-full text-left p-3 hover:bg-white/5 transition-colors ${isSelected ? "bg-white/10" : ""}`}
                        >
                          <p className="text-white font-medium text-sm flex items-center gap-2">
                            <AddressDisplay address={c.otherAddress} className="text-chrome font-mono text-xs" />
                          </p>
                          {c.listingId && (
                            <p className="text-silver text-xs mt-0.5">
                              Listing: {c.listingId.startsWith("0x") ? c.listingId.slice(0, 10) + "…" : c.listingId}
                            </p>
                          )}
                          <p className="text-silver text-xs mt-1 truncate">{c.preview}</p>
                          <p className="text-silver text-xs mt-0.5">
                            {c.lastMessage.createdAt ? new Date(c.lastMessage.createdAt).toLocaleDateString() : ""}
                          </p>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            {selectedThread && (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="p-3 border-b border-white/10 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-white font-medium text-sm block">
                      <AddressDisplay address={selectedThread.other} className="text-chrome font-mono text-xs" />
                    </span>
                    {threadTopicId && (
                      <span className="text-[11px] text-silver/80">HCS topic seam: {threadTopicId}</span>
                    )}
                  </div>
                  {selectedThread.listingId && (
                    <Link
                      href={`/listing/${encodeURIComponent(selectedThread.listingId)}`}
                      className="text-chrome text-xs hover:text-white"
                    >
                      View listing
                    </Link>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
                  {threadLoading ? (
                    <p className="text-silver text-sm">Loading thread…</p>
                  ) : threadMessages.length === 0 ? (
                    <p className="text-silver text-sm">No messages yet. Send a message below.</p>
                  ) : (
                    threadMessages.map((m) => {
                      const isMe = m.fromAddress.toLowerCase() === address?.toLowerCase();
                      return (
                        <div
                          key={m.id}
                          className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                              isMe ? "bg-chrome/25 text-white" : "bg-white/10 text-silver"
                            }`}
                          >
                            <p className="text-xs opacity-80 mb-0.5">
                              <AddressDisplay address={m.fromAddress} className="font-mono" />
                            </p>
                            <p className="whitespace-pre-wrap">{m.body}</p>
                            <p className="text-xs opacity-70 mt-1">
                              {new Date(m.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                <div className="p-3 border-t border-white/10">
                  <textarea
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    placeholder="Type a message…"
                    className="input-frost w-full text-sm min-h-[72px] resize-y mb-2"
                    rows={2}
                  />
                  <button
                    type="button"
                    onClick={sendReply}
                    disabled={!replyBody.trim() || sending}
                    className="btn-frost-cta w-full text-sm py-2 disabled:opacity-50"
                  >
                    {sending ? "Sending…" : "Send"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white mb-3">Wishlist</h2>
        {loading ? (
          <p className="text-silver">Loading…</p>
        ) : wishlistItems.length === 0 ? (
          <p className="text-silver">No wishlist items. Add listings from the marketplace with the ♡ or + Add to wishlist button.</p>
        ) : (
          <div className="glass-card overflow-hidden rounded-xl">
            <ul className="divide-y divide-white/5">
              {wishlistItems.map((w) => (
                <li key={w.itemId} className="flex items-center justify-between p-3 hover:bg-white/5">
                  <Link href={`/listing/${encodeURIComponent(w.itemId)}`} className="text-white hover:text-chrome font-medium flex-1 min-w-0 truncate">
                    {w.title || formatListingId(w.itemId) || w.itemId.slice(0, 10) + "…"}
                  </Link>
                  <span className="text-chrome text-sm shrink-0 ml-2">
 {formatHbarWithUsd(formatPriceForDisplay(w.price || w.reservePrice || "0"), usdRate)}
                  </span>
                  <Link href={`/listing/${encodeURIComponent(w.itemId)}`} className="text-chrome hover:text-white text-sm shrink-0 ml-2">View</Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white mb-3">Current Listings</h2>
        {loading ? (
          <p className="text-silver">Loading…</p>
        ) : activeListings.length === 0 ? (
          <p className="text-silver">No active listings. <Link href="/create" className="text-chrome hover:text-white underline">Create one</Link>.</p>
        ) : (
          <div className="glass-card overflow-hidden rounded-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="p-3 text-silver text-sm font-medium">Listing</th>
                    <th className="p-3 text-silver text-sm font-medium">Type</th>
                    <th className="p-3 text-silver text-sm font-medium">Price</th>
                    <th className="p-3 text-silver text-sm font-medium">Date</th>
                    <th className="p-3 text-silver text-sm font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {activeListings.map((row) => (
                    <tr key={`${row.itemType || "listing"}-${row.id}`} className="border-b border-white/5 hover:bg-white/5">
                      <td className="p-3">
                        <Link href={`/listing/${encodeURIComponent(row.id)}`} className="text-white hover:text-chrome font-medium">
                          {row.title || formatListingId(row.id) || row.id.slice(0, 10) + "…"}
                        </Link>
                      </td>
                      <td className="p-3 text-silver text-sm">Buy now</td>
                      <td className="p-3 text-chrome">{formatHbarWithUsd(formatPriceForDisplay(row.price || row.reservePrice || "0"), usdRate)}</td>
                      <td className="p-3 text-silver text-sm">{formatListingDate(row.createdAt)}</td>
                      <td className="p-3">
                        <Link href={`/listing/${encodeURIComponent(row.id)}`} className="text-chrome hover:text-white text-sm">View</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white mb-3">Archived Listings</h2>
        {loading ? (
          <p className="text-silver">Loading…</p>
        ) : archivedListings.length === 0 ? (
          <p className="text-silver">No archived listings.</p>
        ) : (
          <div className="glass-card overflow-hidden rounded-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="p-3 text-silver text-sm font-medium">Listing</th>
                    <th className="p-3 text-silver text-sm font-medium">Type</th>
                    <th className="p-3 text-silver text-sm font-medium">Price</th>
                    <th className="p-3 text-silver text-sm font-medium">Status</th>
                    <th className="p-3 text-silver text-sm font-medium">Date</th>
                    <th className="p-3 text-silver text-sm font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {archivedListings.map((row) => (
                    <tr key={`${row.itemType || "listing"}-${row.id}`} className="border-b border-white/5 hover:bg-white/5">
                      <td className="p-3">
                        <Link href={`/listing/${encodeURIComponent(row.id)}`} className="text-white hover:text-chrome font-medium">
                          {row.title || formatListingId(row.id) || row.id.slice(0, 10) + "…"}
                        </Link>
                      </td>
                      <td className="p-3 text-silver text-sm">Buy now</td>
                      <td className="p-3 text-chrome">{formatHbarWithUsd(formatPriceForDisplay(row.price || row.reservePrice || "0"), usdRate)}</td>
                      <td className="p-3 text-silver text-sm">{row.status}</td>
                      <td className="p-3 text-silver text-sm">{formatListingDate(row.updatedAt ?? row.createdAt)}</td>
                      <td className="p-3">
                        <Link href={`/listing/${encodeURIComponent(row.id)}`} className="text-chrome hover:text-white text-sm">View</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-silver">Loading…</div>}>
      <DashboardPageContent />
    </Suspense>
  );
}
