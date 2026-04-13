"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useHashpackWallet } from "../../lib/hashpackWallet";
import { getApiUrl } from "../../lib/apiUrl";
import { useEncryptionKey } from "../../lib/useEncryptionKey";
import { encryptMessage, decryptMessage } from "../../lib/chatEncryption";
import { formatPriceForDisplay } from "../../lib/formatPrice";
import { ConnectWalletButton } from "../../components/ConnectWalletButton";

// ─── Types ───────────────────────────────────────────────────────────────────

type ListingMeta = {
  title: string | null;
  imageUrl: string | null;
  price: string;
};

type InboxConversation = {
  otherAddress: string;
  listingId: string | null;
  lastMessage: {
    fromAddress: string;
    toAddress: string;
    body: string;
    createdAt: string;
    encrypted?: boolean;
    type?: string;
    offerAmount?: string | null;
  };
  preview: string;
  unreadCount: number;
  listing: ListingMeta | null;
};

type Message = {
  id: string;
  fromAddress: string;
  toAddress: string;
  body: string;
  listingId: string | null;
  encrypted?: boolean;
  nonce?: string | null;
  createdAt: string;
  type?: string;
  offerAmount?: string | null;
  offerStatus?: string | null;
};

type ThreadListing = {
  id: string;
  title: string | null;
  imageUrl: string | null;
  price: string;
  seller: string;
  status: string;
} | null;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function shortAddr(addr: string): string {
  if (!addr) return "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function LockIcon() {
  return (
    <svg className="inline w-3 h-3 opacity-50 mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function Avatar({ imageUrl, title }: { imageUrl?: string | null; title?: string | null }) {
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={imageUrl} alt={title || ""} className="w-full h-full object-cover" />
    );
  }
  return (
    <div className="w-full h-full flex items-center justify-center bg-white/10">
      <svg className="w-5 h-5 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2zM16 3H8l-2 4h12l-2-4z" />
      </svg>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

function MessagesPageContent() {
  const { address } = useHashpackWallet();
  const searchParams = useSearchParams();

  const [conversations, setConversations] = useState<InboxConversation[]>([]);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [selectedThread, setSelectedThread] = useState<{ other: string; listingId: string } | null>(null);
  const [threadMessages, setThreadMessages] = useState<Message[]>([]);
  const [threadListing, setThreadListing] = useState<ThreadListing>(null);
  const [decryptedBodies, setDecryptedBodies] = useState<Record<string, string>>({});
  const [threadLoading, setThreadLoading] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [sending, setSending] = useState(false);
  const [showOfferInput, setShowOfferInput] = useState(false);
  const [offerAmount, setOfferAmount] = useState("");
  const [respondingId, setRespondingId] = useState<string | null>(null);

  // Mobile: show thread or inbox
  const [mobileView, setMobileView] = useState<"inbox" | "thread">("inbox");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const publicKeyCache = useRef<Record<string, string | null>>({});
  const { keypair, ensureKeypair } = useEncryptionKey();

  // ── Public key fetch ────────────────────────────────────────────────────────
  const fetchPublicKey = useCallback(async (addr: string): Promise<string | null> => {
    const key = addr.toLowerCase();
    if (key in publicKeyCache.current) return publicKeyCache.current[key];
    try {
      const res = await fetch(`${getApiUrl()}/api/user/${encodeURIComponent(key)}/public-key`);
      const data = await res.json();
      publicKeyCache.current[key] = data.publicKey ?? null;
      return data.publicKey ?? null;
    } catch {
      return null;
    }
  }, []);

  // ── Inbox fetch ─────────────────────────────────────────────────────────────
  const fetchInbox = useCallback(() => {
    if (!address) return;
    setInboxLoading(true);
    fetch(`${getApiUrl()}/api/messages/inbox?address=${encodeURIComponent(address)}`)
      .then((r) => r.json())
      .then((data: { conversations?: InboxConversation[] }) => setConversations(data.conversations ?? []))
      .catch(() => setConversations([]))
      .finally(() => setInboxLoading(false));
  }, [address]);

  useEffect(() => { fetchInbox(); }, [fetchInbox]);

  // Poll inbox every 15s
  useEffect(() => {
    if (!address) return;
    const id = setInterval(fetchInbox, 15_000);
    return () => clearInterval(id);
  }, [address, fetchInbox]);

  // ── Open thread from URL params ─────────────────────────────────────────────
  useEffect(() => {
    if (!address) return;
    const open = searchParams.get("openThread");
    const listingId = searchParams.get("listingId");
    const showOffer = searchParams.get("showOffer");
    if (open) {
      const thread = { other: decodeURIComponent(open), listingId: listingId ? decodeURIComponent(listingId) : "" };
      setSelectedThread(thread);
      setMobileView("thread");
      if (showOffer === "1") setShowOfferInput(true);
    }
  }, [address, searchParams]);

  // ── Thread fetch ────────────────────────────────────────────────────────────
  const fetchThread = useCallback(() => {
    if (!address || !selectedThread) return;
    const q = new URLSearchParams({ address, other: selectedThread.other });
    if (selectedThread.listingId) q.set("listingId", selectedThread.listingId);
    fetch(`${getApiUrl()}/api/messages/thread?${q}`)
      .then((r) => r.json())
      .then((data: { messages?: Message[]; listing?: ThreadListing }) => {
        setThreadMessages(data.messages ?? []);
        setThreadListing(data.listing ?? null);
        setDecryptedBodies({});
      })
      .catch(() => setThreadMessages([]));
  }, [address, selectedThread]);

  useEffect(() => {
    if (!selectedThread) { setThreadMessages([]); setDecryptedBodies({}); setThreadListing(null); return; }
    setThreadLoading(true);
    const q = new URLSearchParams({ address: address!, other: selectedThread.other });
    if (selectedThread.listingId) q.set("listingId", selectedThread.listingId);
    fetch(`${getApiUrl()}/api/messages/thread?${q}`)
      .then((r) => r.json())
      .then((data: { messages?: Message[]; listing?: ThreadListing }) => {
        setThreadMessages(data.messages ?? []);
        setThreadListing(data.listing ?? null);
        setDecryptedBodies({});
      })
      .catch(() => setThreadMessages([]))
      .finally(() => setThreadLoading(false));
  }, [address, selectedThread]);

  // Poll thread every 15s
  useEffect(() => {
    if (!selectedThread || !address) return;
    const id = setInterval(fetchThread, 15_000);
    return () => clearInterval(id);
  }, [selectedThread, address, fetchThread]);

  // ── Mark thread read ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!address || !selectedThread) return;
    fetch(`${getApiUrl()}/api/messages/mark-read`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, other: selectedThread.other, listingId: selectedThread.listingId || undefined }),
    }).catch(() => {});
  }, [address, selectedThread, threadMessages.length]);

  // ── Decrypt encrypted messages ──────────────────────────────────────────────
  useEffect(() => {
    if (!threadMessages.length || !address) return;
    const encryptedMsgs = threadMessages.filter((m) => m.encrypted && m.nonce);
    if (!encryptedMsgs.length) return;
    (async () => {
      const kp = keypair ?? (await ensureKeypair());
      if (!kp) return;
      const newDecrypted: Record<string, string> = {};
      for (const m of encryptedMsgs) {
        if (decryptedBodies[m.id]) continue;
        const isMe = m.fromAddress.toLowerCase() === address.toLowerCase();
        const otherAddr = isMe ? m.toAddress : m.fromAddress;
        const otherPubKey = await fetchPublicKey(otherAddr);
        if (!otherPubKey || !m.nonce) { newDecrypted[m.id] = "[Unable to decrypt]"; continue; }
        const plaintext = decryptMessage(m.body, m.nonce, otherPubKey, kp.secretKey);
        newDecrypted[m.id] = plaintext ?? "[Unable to decrypt]";
      }
      if (Object.keys(newDecrypted).length) setDecryptedBodies((prev) => ({ ...prev, ...newDecrypted }));
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadMessages, keypair, address]);

  // ── Auto-scroll to bottom ───────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [threadMessages]);

  // ── Send message ────────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (opts?: { type?: string; amount?: string }) => {
    if (!address || !selectedThread || sending) return;
    const isOffer = opts?.type === "offer";
    const text = isOffer ? `Offer: ${opts!.amount!} HBAR` : replyBody.trim();
    if (!text) return;
    setSending(true);
    try {
      const kp = await ensureKeypair();
      const recipientPubKey = await fetchPublicKey(selectedThread.other);
      let msgBody = text;
      let encrypted = false;
      let nonce: string | undefined;
      if (kp && recipientPubKey) {
        const result = encryptMessage(msgBody, recipientPubKey, kp.secretKey);
        msgBody = result.ciphertext;
        nonce = result.nonce;
        encrypted = true;
      }
      await fetch(`${getApiUrl()}/api/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromAddress: address,
          toAddress: selectedThread.other,
          body: msgBody,
          listingId: selectedThread.listingId || undefined,
          encrypted,
          nonce,
          type: isOffer ? "offer" : "message",
          offerAmount: isOffer ? opts!.amount : undefined,
        }),
      });
      setReplyBody("");
      setOfferAmount("");
      setShowOfferInput(false);
      fetchThread();
      fetchInbox();
    } finally {
      setSending(false);
    }
  }, [address, selectedThread, replyBody, sending, ensureKeypair, fetchPublicKey, fetchThread, fetchInbox]);

  // ── Offer response ──────────────────────────────────────────────────────────
  const respondToOffer = useCallback(async (msgId: string, action: "accepted" | "declined") => {
    if (!address || respondingId) return;
    setRespondingId(msgId);
    try {
      await fetch(`${getApiUrl()}/api/messages/${msgId}/offer-response`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, action }),
      });
      fetchThread();
      fetchInbox();
    } finally {
      setRespondingId(null);
    }
  }, [address, respondingId, fetchThread, fetchInbox]);

  // ── Select thread ───────────────────────────────────────────────────────────
  const selectThread = (other: string, listingId: string) => {
    setSelectedThread({ other, listingId });
    setMobileView("thread");
    setShowOfferInput(false);
    setReplyBody("");
  };

  const getDisplayBody = (m: Message): string => {
    if (m.type === "offer") return `Offer: ${m.offerAmount} HBAR`;
    if (m.encrypted) return decryptedBodies[m.id] ?? "[Decrypting…]";
    return m.body;
  };

  const sortedConversations = useMemo(() =>
    [...conversations].sort((a, b) =>
      new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime()
    ), [conversations]);

  // ── Render ──────────────────────────────────────────────────────────────────
  // On mobile the BottomNav is fixed at top with pt-14 (3.5rem = 56px) offset applied
  // to the content wrapper. Use 100dvh minus that offset so the chat panel fills
  // exactly the visible viewport without relying on the broken flex-1 chain.
  return (
    <main className="flex flex-col overflow-hidden h-[calc(100dvh-3.5rem)] md:h-auto md:flex-1">
      <div className="flex-1 min-h-0 w-full max-w-5xl mx-auto sm:px-6 sm:py-6 flex flex-col">

        {!address ? (
          <div className="px-4 py-8 flex flex-col items-start gap-3">
            <p className="text-silver">Connect your wallet to view messages.</p>
            <ConnectWalletButton className="btn-frost-cta disabled:opacity-50" />
          </div>
        ) : (
          <div className="glass-card overflow-hidden flex flex-1 min-h-0 sm:rounded-xl">

            {/* ── Inbox sidebar ─────────────────────────────────────── */}
            <div className={`${mobileView === "thread" ? "hidden md:flex" : "flex"} md:flex flex-col w-full md:w-80 shrink-0 border-r border-white/10`}>
              <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                <h1 className="text-base font-bold text-white">Inbox</h1>
              </div>

              <div className="flex-1 overflow-y-auto">
                {inboxLoading && conversations.length === 0 ? (
                  <p className="p-4 text-silver text-sm">Loading…</p>
                ) : sortedConversations.length === 0 ? (
                  <p className="p-4 text-silver text-sm">No messages yet.</p>
                ) : (
                  <ul className="divide-y divide-white/5">
                    {sortedConversations.map((c) => {
                      const listingKey = c.listingId ?? "";
                      const isSelected = selectedThread?.other === c.otherAddress && selectedThread?.listingId === listingKey;
                      const hasUnread = c.unreadCount > 0;
                      return (
                        <li key={`${c.otherAddress}-${listingKey}`}>
                          <button
                            type="button"
                            onClick={() => selectThread(c.otherAddress, listingKey)}
                            className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${isSelected ? "bg-white/10" : "hover:bg-white/5"}`}
                          >
                            {/* Thumbnail */}
                            <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-white/5">
                              <Avatar imageUrl={c.listing?.imageUrl} title={c.listing?.title} />
                            </div>

                            {/* Text */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <span className={`text-sm font-semibold truncate ${hasUnread ? "text-white" : "text-silver"}`}>
                                  {c.listing?.title ?? shortAddr(c.otherAddress)}
                                </span>
                                <span className="text-[10px] text-silver/60 shrink-0">
                                  {relativeTime(c.lastMessage.createdAt)}
                                </span>
                              </div>
                              {c.listing?.title && (
                                <p className="text-[10px] text-silver/50 truncate">{shortAddr(c.otherAddress)}</p>
                              )}
                              <div className="flex items-center justify-between gap-1 mt-0.5">
                                <p className={`text-xs truncate ${hasUnread ? "text-white/80" : "text-silver/60"}`}>
                                  {c.lastMessage.encrypted && !c.lastMessage.type?.startsWith("offer") && <LockIcon />}
                                  {c.preview}
                                </p>
                                {hasUnread && (
                                  <span className="shrink-0 w-4 h-4 rounded-full bg-[#00ffa3] text-black text-[9px] font-bold flex items-center justify-center">
                                    {c.unreadCount > 9 ? "9+" : c.unreadCount}
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            {/* ── Thread view ───────────────────────────────────────── */}
            {selectedThread ? (
              <div className={`${mobileView === "inbox" ? "hidden md:flex" : "flex"} md:flex flex-1 flex-col min-w-0`}>

                {/* Thread header */}
                <div className="px-4 py-3 border-b border-white/10 flex items-center gap-3">
                  {/* Back button (mobile) */}
                  <button
                    type="button"
                    onClick={() => setMobileView("inbox")}
                    className="md:hidden text-silver hover:text-white mr-1"
                    aria-label="Back"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>

                  {threadListing ? (
                    <>
                      <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-white/5">
                        <Avatar imageUrl={threadListing.imageUrl} title={threadListing.title} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">
                          {threadListing.title ?? shortAddr(selectedThread.other)}
                        </p>
                        <p className="text-xs text-silver/60">
                          {formatPriceForDisplay(threadListing.price)} HBAR · {shortAddr(selectedThread.other)}
                        </p>
                      </div>
                      <Link
                        href={`/listing/${encodeURIComponent(selectedThread.listingId)}`}
                        className="text-xs text-chrome hover:text-white transition-colors shrink-0"
                      >
                        View
                      </Link>
                    </>
                  ) : (
                    <p className="text-sm font-semibold text-white">{shortAddr(selectedThread.other)}</p>
                  )}
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                  {threadLoading && threadMessages.length === 0 ? (
                    <p className="text-silver text-sm">Loading…</p>
                  ) : threadMessages.length === 0 ? (
                    <p className="text-silver text-sm text-center mt-8">No messages yet. Say hello!</p>
                  ) : (
                    threadMessages.map((m) => {
                      const isMe = m.fromAddress.toLowerCase() === address!.toLowerCase();
                      const isOffer = m.type === "offer";
                      const displayBody = getDisplayBody(m);

                      if (isOffer) {
                        // Offer bubble
                        const isPending = m.offerStatus === "pending";
                        const isAccepted = m.offerStatus === "accepted";
                        const isDeclined = m.offerStatus === "declined";
                        const canRespond = !isMe && isPending;
                        return (
                          <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                            <div className="max-w-[75%] rounded-2xl border border-white/15 bg-white/5 overflow-hidden">
                              <div className="px-4 py-3">
                                <p className="text-[10px] uppercase tracking-widest text-silver/50 font-semibold mb-1">
                                  {isMe ? "Your offer" : "Offer received"}
                                </p>
                                <p className="text-xl font-bold text-white">{m.offerAmount} HBAR</p>
                                {threadListing?.title && (
                                  <p className="text-xs text-silver/60 mt-0.5 truncate">{threadListing.title}</p>
                                )}
                              </div>
                              {isPending && !canRespond && (
                                <div className="px-4 py-2 bg-white/5 border-t border-white/10">
                                  <p className="text-xs text-silver/60">Waiting for response…</p>
                                </div>
                              )}
                              {canRespond && (
                                <div className="flex border-t border-white/10">
                                  <button
                                    type="button"
                                    onClick={() => respondToOffer(m.id, "declined")}
                                    disabled={!!respondingId}
                                    className="flex-1 py-2.5 text-sm font-semibold text-silver hover:text-white border-r border-white/10 transition-colors disabled:opacity-50"
                                  >
                                    Decline
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => respondToOffer(m.id, "accepted")}
                                    disabled={!!respondingId}
                                    className="flex-1 py-2.5 text-sm font-semibold text-[#00ffa3] hover:bg-[#00ffa3]/10 transition-colors disabled:opacity-50"
                                  >
                                    {respondingId === m.id ? "…" : "Accept"}
                                  </button>
                                </div>
                              )}
                              {(isAccepted || isDeclined) && (
                                <div className={`px-4 py-2 border-t border-white/10 ${isAccepted ? "bg-[#00ffa3]/10" : "bg-rose-500/10"}`}>
                                  <p className={`text-xs font-semibold ${isAccepted ? "text-[#00ffa3]" : "text-rose-400"}`}>
                                    {isAccepted ? "Offer accepted" : "Offer declined"}
                                  </p>
                                </div>
                              )}
                              <p className={`text-[10px] text-silver/40 px-4 pb-2 ${isPending && !canRespond ? "" : "pt-1"}`}>
                                {relativeTime(m.createdAt)}
                              </p>
                            </div>
                          </div>
                        );
                      }

                      // Regular message bubble
                      return (
                        <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm ${
                            isMe
                              ? "bg-[#00ffa3]/20 text-white rounded-br-sm"
                              : "bg-white/10 text-silver rounded-bl-sm"
                          }`}>
                            {m.encrypted && <LockIcon />}
                            <p className="whitespace-pre-wrap break-words">{displayBody}</p>
                            <p className="text-[10px] opacity-50 mt-1 text-right">{relativeTime(m.createdAt)}</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input area — pb accounts for iOS home-indicator safe area */}
                <div className="px-4 py-3 border-t border-white/10 space-y-2" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
                  {showOfferInput ? (
                    <div className="flex gap-2 items-center">
                      <div className="flex-1 flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2">
                        <span className="text-silver/60 text-sm">ℏ</span>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={offerAmount}
                          onChange={(e) => setOfferAmount(e.target.value)}
                          placeholder="Offer amount in HBAR"
                          className="flex-1 bg-transparent text-white text-sm placeholder:text-silver/40 focus:outline-none"
                          autoFocus
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => { setShowOfferInput(false); setOfferAmount(""); }}
                        className="text-silver/60 hover:text-white text-sm px-2"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => sendMessage({ type: "offer", amount: offerAmount })}
                        disabled={!offerAmount || Number(offerAmount) <= 0 || sending}
                        className="btn-frost-cta text-sm px-4 py-2 disabled:opacity-50"
                      >
                        Send offer
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2 items-end">
                      <textarea
                        value={replyBody}
                        onChange={(e) => setReplyBody(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            sendMessage();
                          }
                        }}
                        placeholder="Message…"
                        rows={1}
                        className="flex-1 input-frost text-sm resize-none min-h-[40px] max-h-[120px] py-2.5"
                        style={{ overflow: "hidden" }}
                        onInput={(e) => {
                          const el = e.currentTarget;
                          el.style.height = "auto";
                          el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
                        }}
                      />
                      {/* Make offer button (only on listing threads) */}
                      {selectedThread.listingId && threadListing && (
                        <button
                          type="button"
                          onClick={() => setShowOfferInput(true)}
                          className="rounded-xl border border-white/20 bg-white/5 px-3 py-2.5 text-sm text-silver hover:text-white hover:bg-white/10 transition-colors shrink-0"
                          title="Make an offer"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                          </svg>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => sendMessage()}
                        disabled={!replyBody.trim() || sending}
                        className="rounded-xl bg-[#00ffa3]/20 border border-[#00ffa3]/30 px-3 py-2.5 text-[#00ffa3] hover:bg-[#00ffa3]/30 transition-colors disabled:opacity-40 shrink-0"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="hidden md:flex flex-1 items-center justify-center">
                <div className="text-center space-y-2">
                  <svg className="w-10 h-10 text-white/20 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <p className="text-silver/50 text-sm">Select a conversation</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-silver">Loading…</div>}>
      <MessagesPageContent />
    </Suspense>
  );
}
