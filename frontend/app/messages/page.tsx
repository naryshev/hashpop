"use client";
import { encodeListingIdForUrl, formatListingId, listingHref } from "../../lib/listingUrl";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AddressDisplay } from "../../components/AddressDisplay";
import { useHashpackWallet } from "../../lib/hashpackWallet";
import { getApiUrl } from "../../lib/apiUrl";
import { useEncryptionKey } from "../../lib/useEncryptionKey";
import { encryptMessage, decryptMessage } from "../../lib/chatEncryption";

type InboxConversation = {
  otherAddress: string;
  listingId: string | null;
  lastMessage: {
    fromAddress: string;
    toAddress: string;
    body: string;
    createdAt: string;
    encrypted?: boolean;
  };
  preview: string;
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
};

type ListingPreview = {
  id: string;
  title: string | null;
  price: string | null;
  status: string | null;
  imageUrl: string | null;
  seller: string;
  requireEscrow?: boolean;
};

type StatusKey = "LISTED" | "LOCKED" | "SOLD" | "CANCELLED";

const STATUS_STYLE: Record<StatusKey, { bg: string; text: string; label: string }> = {
  LISTED: { bg: "bg-chrome", text: "text-black", label: "ACTIVE" },
  LOCKED: { bg: "bg-amber-400", text: "text-black", label: "LOCKED" },
  SOLD: { bg: "bg-rose-500", text: "text-white", label: "SOLD" },
  CANCELLED: { bg: "bg-zinc-600", text: "text-white", label: "CANCELLED" },
};

function statusStyleFor(status: string | null) {
  if (!status) return null;
  const key = status.toUpperCase() as StatusKey;
  return STATUS_STYLE[key] ?? null;
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function E2EBadge({ tone = "chrome" }: { tone?: "chrome" | "muted" }) {
  const color = tone === "chrome" ? "text-chrome" : "text-silver";
  return (
    <span className={`inline-flex items-center gap-1 font-mono text-[10px] ${color}`}>
      <LockIcon className="h-2.5 w-2.5" />
      E2E
    </span>
  );
}

function SendArrow() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 19V5" />
      <path d="m5 12 7-7 7 7" />
    </svg>
  );
}

// Stable colour pair derived from an address — used for the avatar gradient
// so the conversation list reads as a cast of recognisable people without
// having to ship avatar images.
const AVATAR_PALETTES: ReadonlyArray<readonly [string, string]> = [
  ["#f97316", "#7c2d12"],
  ["#a78bfa", "#5b21b6"],
  ["#22d3ee", "#0e7490"],
  ["#f43f5e", "#881337"],
  ["#10b981", "#064e3b"],
  ["#fb923c", "#7c2d12"],
  ["#94a3b8", "#1e293b"],
  ["#60a5fa", "#1e3a8a"],
];

function paletteFor(address: string): readonly [string, string] {
  let hash = 0;
  for (let i = 0; i < address.length; i++) hash = (hash * 31 + address.charCodeAt(i)) | 0;
  return AVATAR_PALETTES[Math.abs(hash) % AVATAR_PALETTES.length];
}

function initialFor(address: string): string {
  const cleaned = address.replace(/^0x/, "").replace(/^0\.0\./, "");
  return (cleaned[0] || "?").toUpperCase();
}

function Avatar({
  address,
  size = 36,
  online,
}: {
  address: string;
  size?: number;
  online?: boolean;
}) {
  const [a, b] = paletteFor(address);
  return (
    <span className="relative inline-flex shrink-0">
      <span
        className="flex items-center justify-center rounded-full font-bold text-white"
        style={{
          width: size,
          height: size,
          background: `linear-gradient(135deg, ${a}, ${b})`,
          fontSize: Math.round(size * 0.42),
        }}
      >
        {initialFor(address)}
      </span>
      {online && (
        <span
          className="absolute bottom-0 right-0 rounded-full bg-chrome"
          style={{
            width: Math.round(size * 0.28),
            height: Math.round(size * 0.28),
            border: "2px solid #0b111b",
          }}
        />
      )}
    </span>
  );
}

// Item thumbnail used in the order-context strip above a thread. Falls back
// to a category-coloured swatch when the listing has no image, matching the
// glyph-on-gradient pattern from the Chat Explorations design.
function ItemThumb({ listing, size = 40 }: { listing: ListingPreview; size?: number }) {
  if (listing.imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={listing.imageUrl}
        alt=""
        className="shrink-0 rounded-glass object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  const [a, b] = paletteFor(listing.id);
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-glass text-lg"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${a}, ${b})`,
      }}
    >
      <span className="text-white/90">◇</span>
    </span>
  );
}

function MessagesPageContent() {
  const { address } = useHashpackWallet();
  const searchParams = useSearchParams();
  const [conversations, setConversations] = useState<InboxConversation[]>([]);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [selectedThread, setSelectedThread] = useState<{ other: string; listingId: string } | null>(
    null,
  );
  const [threadMessages, setThreadMessages] = useState<Message[]>([]);
  const [decryptedBodies, setDecryptedBodies] = useState<Record<string, string>>({});
  const [threadLoading, setThreadLoading] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [sending, setSending] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [composeAddress, setComposeAddress] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [composeSending, setComposeSending] = useState(false);
  const [listingPreviews, setListingPreviews] = useState<Record<string, ListingPreview>>({});
  const [search, setSearch] = useState("");
  const { keypair, ensureKeypair } = useEncryptionKey();

  const publicKeyCache = useRef<Record<string, string | null>>({});
  const listingFetchInFlight = useRef<Set<string>>(new Set());

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

  const fetchListingPreview = useCallback(
    async (listingId: string) => {
      if (!listingId) return;
      if (listingPreviews[listingId]) return;
      if (listingFetchInFlight.current.has(listingId)) return;
      listingFetchInFlight.current.add(listingId);
      try {
        const res = await fetch(
          `${getApiUrl()}/api/listing/${encodeListingIdForUrl(listingId)}`,
        );
        if (!res.ok) return;
        const data = await res.json();
        if (!data?.listing) return;
        const l = data.listing;
        setListingPreviews((prev) => ({
          ...prev,
          [listingId]: {
            id: listingId,
            title: l.title ?? null,
            price: l.price?.toString?.() ?? l.price ?? null,
            status: l.status ?? null,
            imageUrl: l.imageUrl ?? null,
            seller: l.seller ?? "",
            requireEscrow: !!l.requireEscrow,
          },
        }));
      } catch {
        // ignore — preview is best-effort
      } finally {
        listingFetchInFlight.current.delete(listingId);
      }
    },
    [listingPreviews],
  );

  const listingSortedConversations = useMemo(() => {
    const filtered = search.trim()
      ? conversations.filter(
          (c) =>
            c.otherAddress.toLowerCase().includes(search.toLowerCase()) ||
            (c.listingId ?? "").toLowerCase().includes(search.toLowerCase()) ||
            c.preview.toLowerCase().includes(search.toLowerCase()),
        )
      : conversations;
    return [...filtered].sort((a, b) => {
      if (a.listingId && !b.listingId) return -1;
      if (!a.listingId && b.listingId) return 1;
      return (
        new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime()
      );
    });
  }, [conversations, search]);

  useEffect(() => {
    if (!address) return;
    const open = searchParams.get("openThread");
    const listingId = searchParams.get("listingId");
    if (open) {
      setSelectedThread({
        other: decodeURIComponent(open),
        listingId: listingId ? decodeURIComponent(listingId) : "",
      });
    }
  }, [address, searchParams]);

  const fetchInbox = useCallback(() => {
    if (!address) return;
    setInboxLoading(true);
    fetch(`${getApiUrl()}/api/messages/inbox?address=${encodeURIComponent(address)}`)
      .then((res) => res.json())
      .then((data: { conversations?: InboxConversation[] }) =>
        setConversations(data.conversations ?? []),
      )
      .catch(() => setConversations([]))
      .finally(() => setInboxLoading(false));
  }, [address]);

  useEffect(() => {
    fetchInbox();
  }, [fetchInbox]);

  // Hydrate listing previews for every conversation that references one. The
  // strip above each thread depends on this data, and the conversation rows
  // surface the item title when available.
  useEffect(() => {
    const ids = new Set<string>();
    for (const c of conversations) if (c.listingId) ids.add(c.listingId);
    if (selectedThread?.listingId) ids.add(selectedThread.listingId);
    ids.forEach((id) => {
      void fetchListingPreview(id);
    });
  }, [conversations, selectedThread, fetchListingPreview]);

  useEffect(() => {
    if (!threadMessages.length || !address) return;
    const encryptedMsgs = threadMessages.filter((m) => m.encrypted && m.nonce);
    if (!encryptedMsgs.length) return;

    const doDecrypt = async () => {
      const kp = keypair ?? (await ensureKeypair());
      if (!kp) return;

      const newDecrypted: Record<string, string> = {};
      for (const m of encryptedMsgs) {
        if (decryptedBodies[m.id]) continue;
        const isMe = m.fromAddress.toLowerCase() === address.toLowerCase();
        const otherAddr = isMe ? m.toAddress : m.fromAddress;
        const otherPubKey = await fetchPublicKey(otherAddr);
        if (!otherPubKey || !m.nonce) {
          newDecrypted[m.id] = "[Unable to decrypt]";
          continue;
        }
        const plaintext = decryptMessage(m.body, m.nonce, otherPubKey, kp.secretKey);
        newDecrypted[m.id] = plaintext ?? "[Unable to decrypt]";
      }
      if (Object.keys(newDecrypted).length > 0) {
        setDecryptedBodies((prev) => ({ ...prev, ...newDecrypted }));
      }
    };
    doDecrypt();
  }, [threadMessages, keypair, address, ensureKeypair, fetchPublicKey, decryptedBodies]);

  useEffect(() => {
    if (!address || !selectedThread) {
      setThreadMessages([]);
      setDecryptedBodies({});
      return;
    }
    setThreadLoading(true);
    const q = new URLSearchParams({ address, other: selectedThread.other });
    if (selectedThread.listingId) {
      q.set("listingId", selectedThread.listingId);
    }
    fetch(`${getApiUrl()}/api/messages/thread?${q}`)
      .then((res) => res.json())
      .then((data: { messages?: Message[] }) => {
        setThreadMessages(data.messages ?? []);
        setDecryptedBodies({});
      })
      .catch(() => {
        setThreadMessages([]);
      })
      .finally(() => setThreadLoading(false));
  }, [address, selectedThread]);

  const sendReply = useCallback(async () => {
    if (!address || !selectedThread || !replyBody.trim() || sending) return;
    setSending(true);
    try {
      const kp = await ensureKeypair();
      const recipientPubKey = await fetchPublicKey(selectedThread.other);

      let msgBody = replyBody.trim();
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
        }),
      });
      setReplyBody("");
      const q = new URLSearchParams({ address, other: selectedThread.other });
      if (selectedThread.listingId) {
        q.set("listingId", selectedThread.listingId);
      }
      const res = await fetch(`${getApiUrl()}/api/messages/thread?${q}`);
      const data = await res.json();
      setThreadMessages(data.messages ?? []);
      setDecryptedBodies({});
      fetchInbox();
    } finally {
      setSending(false);
    }
  }, [address, selectedThread, replyBody, sending, fetchInbox, ensureKeypair, fetchPublicKey]);

  const sendCompose = useCallback(async () => {
    if (!address || !composeAddress.trim() || !composeBody.trim() || composeSending) return;
    const toAddr = composeAddress.trim().toLowerCase();
    if (toAddr === address.toLowerCase()) return;
    setComposeSending(true);
    try {
      const kp = await ensureKeypair();
      const recipientPubKey = await fetchPublicKey(toAddr);

      let msgBody = composeBody.trim();
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
          toAddress: toAddr,
          body: msgBody,
          encrypted,
          nonce,
        }),
      });
      setShowCompose(false);
      setComposeAddress("");
      setComposeBody("");
      setSelectedThread({ other: toAddr, listingId: "" });
      fetchInbox();
    } finally {
      setComposeSending(false);
    }
  }, [
    address,
    composeAddress,
    composeBody,
    composeSending,
    ensureKeypair,
    fetchPublicKey,
    fetchInbox,
  ]);

  const getDisplayBody = (m: Message): string => {
    if (m.encrypted) {
      return decryptedBodies[m.id] ?? "[Decrypting…]";
    }
    return m.body;
  };

  const selectedListing = selectedThread?.listingId
    ? listingPreviews[selectedThread.listingId]
    : undefined;
  const selectedStatusStyle = selectedListing ? statusStyleFor(selectedListing.status) : null;

  // The thread opens with a synthesised "Escrow funded" system bubble when the
  // listing has an active escrow contract — this is how the Chat Explorations
  // design surfaces the order moment in-line with the conversation. Real
  // escrow events will replace this once the indexer emits them as messages.
  const escrowSystemBubble = useMemo(() => {
    if (!selectedListing) return null;
    if (!selectedListing.requireEscrow) return null;
    const price = selectedListing.price;
    return {
      title: `Escrow funded · ${price ?? "—"} ℏ locked`,
      sub: `Listing ${formatListingId(selectedListing.id)} · Buyer must release within 14d of delivery`,
    };
  }, [selectedListing]);

  return (
    <main className="min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold text-white">Messages</h1>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-chrome/10 border border-chrome/30 px-2.5 py-1 text-[11px] font-semibold text-chrome">
              <LockIcon className="h-3 w-3" />
              End-to-end encrypted
            </span>
          </div>
          {address && (
            <button
              type="button"
              onClick={() => setShowCompose(true)}
              className="btn-frost-cta text-sm px-4 py-2"
            >
              Compose
            </button>
          )}
        </div>

        {showCompose && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
            onClick={() => setShowCompose(false)}
          >
            <div
              className="glass-card w-full max-w-md mx-4 p-6 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-lg font-bold text-white">New message</h2>
              <input
                type="text"
                value={composeAddress}
                onChange={(e) => setComposeAddress(e.target.value)}
                placeholder="Recipient wallet address (0x…) or account ID (0.0.XXXXX)"
                className="input-frost w-full text-sm"
              />
              <textarea
                value={composeBody}
                onChange={(e) => setComposeBody(e.target.value)}
                placeholder="Type your message…"
                className="input-frost w-full text-sm min-h-[100px] resize-y"
                rows={4}
              />
              <div className="flex items-center justify-between gap-3">
                <E2EBadge />
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCompose(false)}
                    className="text-silver text-sm hover:text-white transition-colors px-4 py-2"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={sendCompose}
                    disabled={!composeAddress.trim() || !composeBody.trim() || composeSending}
                    className="btn-frost-cta text-sm px-4 py-2 disabled:opacity-50"
                  >
                    {composeSending ? "Sending…" : "Send"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {!address ? (
          <p className="text-silver">Connect your wallet to view messages.</p>
        ) : (
          <div className="glass-card overflow-hidden flex flex-col md:flex-row min-h-[560px] rounded-glass-lg">
            {/* Conversation list */}
            <aside
              className={`flex flex-col border-b md:border-b-0 md:border-r border-white/10 ${
                selectedThread ? "md:w-80 shrink-0" : "w-full"
              }`}
            >
              <div className="p-3 border-b border-white/10">
                <div className="flex h-9 items-center gap-2 rounded-full border border-white/10 bg-[#0f1726]/90 px-3">
                  <span className="text-silver text-xs">⌕</span>
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search conversations…"
                    className="flex-1 bg-transparent text-sm text-white placeholder:text-silver focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {inboxLoading ? (
                  <p className="p-4 text-silver text-sm">Loading…</p>
                ) : listingSortedConversations.length === 0 ? (
                  <p className="p-4 text-silver text-sm">No messages yet.</p>
                ) : (
                  <ul className="divide-y divide-white/5">
                    {listingSortedConversations.map((c) => {
                      const listingKey = c.listingId ?? "";
                      const isSelected =
                        selectedThread?.other === c.otherAddress &&
                        selectedThread?.listingId === listingKey;
                      const listing = c.listingId ? listingPreviews[c.listingId] : undefined;
                      return (
                        <li key={`${c.otherAddress}-${listingKey}`}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedThread({
                                other: c.otherAddress,
                                listingId: listingKey,
                              });
                            }}
                            className={`flex w-full gap-3 px-3 py-3 text-left transition-colors hover:bg-white/5 ${
                              isSelected
                                ? "bg-chrome/[0.04] border-l-[3px] border-chrome"
                                : "border-l-[3px] border-transparent"
                            }`}
                          >
                            <Avatar address={c.otherAddress} size={40} />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className="truncate text-sm font-semibold text-white">
                                  <AddressDisplay
                                    address={c.otherAddress}
                                    className="text-white font-mono text-xs"
                                  />
                                </span>
                                <span className="font-mono text-[10px] text-silver">
                                  {c.lastMessage.createdAt
                                    ? new Date(c.lastMessage.createdAt).toLocaleDateString([], {
                                        month: "short",
                                        day: "numeric",
                                      })
                                    : ""}
                                </span>
                              </div>
                              {c.listingId && (
                                <div className="mt-0.5 flex items-center gap-1.5 text-[10px]">
                                  <span className="truncate font-mono text-chrome">
                                    #{formatListingId(c.listingId).slice(0, 12)}
                                  </span>
                                  {listing?.title && (
                                    <span className="truncate text-silver">· {listing.title}</span>
                                  )}
                                </div>
                              )}
                              <div className="mt-1 flex items-center gap-2">
                                <span className="truncate text-xs text-silver">
                                  {c.lastMessage.encrypted && (
                                    <LockIcon className="mr-1 inline-block h-3 w-3 opacity-60" />
                                  )}
                                  {c.preview}
                                </span>
                              </div>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </aside>

            {/* Thread */}
            {selectedThread ? (
              <div className="flex min-h-0 flex-1 flex-col">
                {/* Thread header */}
                <div className="flex items-center gap-3 border-b border-white/10 px-5 py-3">
                  <Avatar address={selectedThread.other} size={38} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-bold text-white">
                        <AddressDisplay
                          address={selectedThread.other}
                          className="text-white font-mono text-xs"
                        />
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 font-mono text-[10px] text-silver">
                      <span>{selectedThread.other.slice(0, 10)}…</span>
                      <E2EBadge />
                    </div>
                  </div>
                </div>

                {/* Order / listing context strip */}
                {selectedListing && (
                  <div className="flex items-center gap-3 border-b border-white/10 bg-[#0e1422]/80 px-5 py-2.5">
                    <ItemThumb listing={selectedListing} size={36} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-semibold text-white">
                        {selectedListing.title ?? "Listing"}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 font-mono text-[10px] text-silver">
                        <span>#{formatListingId(selectedListing.id).slice(0, 16)}</span>
                        {selectedListing.price && (
                          <span>· {selectedListing.price} ℏ in escrow</span>
                        )}
                      </div>
                    </div>
                    {selectedStatusStyle && (
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[9px] font-bold tracking-wider ${selectedStatusStyle.bg} ${selectedStatusStyle.text}`}
                      >
                        {selectedStatusStyle.label}
                      </span>
                    )}
                    <Link
                      href={listingHref(selectedListing.id)}
                      className="rounded-glass border border-white/10 px-3 py-1 text-[11px] text-silver hover:border-chrome/50 hover:text-chrome transition-colors"
                    >
                      View order →
                    </Link>
                  </div>
                )}

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2 min-h-[260px]">
                  {threadLoading ? (
                    <p className="text-silver text-sm">Loading thread…</p>
                  ) : threadMessages.length === 0 ? (
                    <p className="text-silver text-sm">No messages yet. Send a message below.</p>
                  ) : (
                    <>
                      {escrowSystemBubble && (
                        <div className="my-3 flex justify-center">
                          <div className="max-w-md rounded-glass-lg border border-chrome/30 bg-chrome/[0.06] px-3.5 py-2.5 text-center">
                            <div className="text-[11px] font-bold text-chrome">
                              ⚡ {escrowSystemBubble.title}
                            </div>
                            <div className="mt-0.5 font-mono text-[10px] text-silver">
                              {escrowSystemBubble.sub}
                            </div>
                          </div>
                        </div>
                      )}
                      {threadMessages.map((m) => {
                        const isMe = m.fromAddress.toLowerCase() === address.toLowerCase();
                        return (
                          <div
                            key={m.id}
                            className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                          >
                            <div
                              className={`max-w-[70%] rounded-glass-lg px-3.5 py-2 text-sm shadow-inner ${
                                isMe
                                  ? "bg-chrome text-black"
                                  : "border border-white/10 bg-[#0e1422]/85 text-white"
                              }`}
                            >
                              <p className="whitespace-pre-wrap leading-relaxed">
                                {getDisplayBody(m)}
                              </p>
                              <div
                                className={`mt-1 flex items-center justify-end gap-1.5 text-[10px] ${
                                  isMe ? "text-black/55" : "text-silver"
                                }`}
                              >
                                <span>
                                  {new Date(m.createdAt).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                                {m.encrypted && <LockIcon className="h-2.5 w-2.5 opacity-70" />}
                                {isMe && <span>✓✓</span>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>

                {/* Composer */}
                <div className="border-t border-white/10 bg-[#0b111b] px-4 py-3">
                  <div className="flex items-end gap-2">
                    <div className="flex flex-1 items-end gap-2 rounded-glass-lg border border-white/10 bg-[#0f1726]/90 px-3 py-2 focus-within:border-chrome/50">
                      <E2EBadge />
                      <textarea
                        value={replyBody}
                        onChange={(e) => setReplyBody(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            void sendReply();
                          }
                        }}
                        placeholder={`Encrypted message to ${selectedThread.other.slice(0, 10)}…`}
                        rows={1}
                        className="flex-1 resize-none bg-transparent text-sm text-white placeholder:text-silver focus:outline-none min-h-[24px] max-h-32"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={sendReply}
                      disabled={!replyBody.trim() || sending}
                      className="btn-frost-cta inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm disabled:opacity-50"
                    >
                      {sending ? "Sending…" : "Send"}
                      {!sending && <SendArrow />}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="hidden flex-1 items-center justify-center p-8 text-center text-silver md:flex">
                <div>
                  <div className="text-sm">Select a conversation to read messages.</div>
                  <div className="mt-1 font-mono text-[11px]">
                    All messages are end-to-end encrypted wallet-to-wallet.
                  </div>
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
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-silver">Loading…</div>
      }
    >
      <MessagesPageContent />
    </Suspense>
  );
}
