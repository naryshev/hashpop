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
  buyer: string | null;
  requireEscrow: boolean;
  shippedAt: string | null;
  exchangeConfirmedAt: string | null;
  trackingNumber: string | null;
  trackingCarrier: string | null;
  createdAt: string | null;
};

// Escrow stepper states for the right-rail controller. Map the on-chain
// listing status + delivery timestamps down to one of these positions so the
// stepper reflects reality without the page having to consult the contract.
type StepKey = "funded" | "shipped" | "delivered" | "released";
const STEPS: { key: StepKey; label: string }[] = [
  { key: "funded", label: "Funded" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
  { key: "released", label: "Released" },
];

function deriveStepIndex(listing: ListingPreview | undefined): number {
  if (!listing) return -1;
  const status = (listing.status ?? "").toUpperCase();
  if (status === "SOLD") return 3; // released
  if (listing.exchangeConfirmedAt) return 2; // delivered
  if (listing.shippedAt || listing.trackingNumber) return 1; // shipped
  if (status === "LOCKED") return 0; // funded
  return -1;
}

type StateKey = "PAID" | "SHIPPED" | "DELIVERED" | "RELEASED" | "DISPUTED" | "AWAITING";
const STATE_STYLE: Record<StateKey, { bg: string; text: string; label: string }> = {
  PAID: { bg: "bg-chrome", text: "text-black", label: "PAID" },
  SHIPPED: { bg: "bg-amber-400", text: "text-black", label: "SHIPPED" },
  DELIVERED: { bg: "bg-[#00e5ff]", text: "text-black", label: "DELIVERED" },
  RELEASED: { bg: "bg-[#00b37a]", text: "text-white", label: "RELEASED" },
  DISPUTED: { bg: "bg-rose-500", text: "text-white", label: "DISPUTED" },
  AWAITING: { bg: "bg-white/10", text: "text-silver", label: "AWAITING" },
};

function stateKeyFor(listing: ListingPreview | undefined): StateKey {
  if (!listing) return "AWAITING";
  const status = (listing.status ?? "").toUpperCase();
  if (status === "SOLD") return "RELEASED";
  if (status === "CANCELLED") return "DISPUTED";
  if (listing.exchangeConfirmedAt) return "DELIVERED";
  if (listing.shippedAt || listing.trackingNumber) return "SHIPPED";
  if (status === "LOCKED") return "PAID";
  return "AWAITING";
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

// Stable colour pair derived from an address — used for avatars and the
// thumbnail swatch when no listing image is available, so each correspondent
// reads as a recognisable person/item without shipping artwork.
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

function paletteFor(seed: string): readonly [string, string] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
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

function ItemThumb({ listing, size = 42 }: { listing: ListingPreview; size?: number }) {
  if (listing.imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={listing.imageUrl}
        alt=""
        className="shrink-0 rounded-glass-lg object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  const [a, b] = paletteFor(listing.id);
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-glass-lg text-lg text-white/90"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${a}, ${b})`,
      }}
    >
      ◇
    </span>
  );
}

function StatePill({ stateKey, size = "sm" }: { stateKey: StateKey; size?: "sm" | "md" }) {
  const s = STATE_STYLE[stateKey];
  const pad = size === "sm" ? "px-2 py-0.5 text-[9px]" : "px-2.5 py-1 text-[10px]";
  return (
    <span className={`inline-flex items-center rounded-full font-bold tracking-wider ${pad} ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  );
}

type TabKey = "active" | "awaiting" | "disputed" | "closed";
const TABS: { key: TabKey; label: string }[] = [
  { key: "active", label: "Active" },
  { key: "awaiting", label: "Awaiting" },
  { key: "disputed", label: "Disputed" },
  { key: "closed", label: "Closed" },
];

function tabFor(stateKey: StateKey): TabKey {
  if (stateKey === "DISPUTED") return "disputed";
  if (stateKey === "RELEASED") return "closed";
  if (stateKey === "AWAITING") return "awaiting";
  return "active"; // PAID, SHIPPED, DELIVERED
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
  const [activeTab, setActiveTab] = useState<TabKey>("active");
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
            buyer: l.buyer ?? null,
            requireEscrow: !!l.requireEscrow,
            shippedAt: l.shippedAt ?? null,
            exchangeConfirmedAt: l.exchangeConfirmedAt ?? null,
            trackingNumber: l.trackingNumber ?? null,
            trackingCarrier: l.trackingCarrier ?? null,
            createdAt: l.createdAt ?? null,
          },
        }));
      } catch {
        // best-effort
      } finally {
        listingFetchInFlight.current.delete(listingId);
      }
    },
    [listingPreviews],
  );

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

  // Bucket conversations by tab. Listing-bound chats route into the tab that
  // matches their derived escrow state; inquiries with no order land in
  // "Awaiting" so the sidebar always has a place for them.
  const conversationsByTab = useMemo(() => {
    const buckets: Record<TabKey, InboxConversation[]> = {
      active: [],
      awaiting: [],
      disputed: [],
      closed: [],
    };
    for (const c of conversations) {
      if (!c.listingId) {
        buckets.awaiting.push(c);
        continue;
      }
      const listing = listingPreviews[c.listingId];
      const key = tabFor(stateKeyFor(listing));
      buckets[key].push(c);
    }
    return buckets;
  }, [conversations, listingPreviews]);

  const visibleConversations = useMemo(() => {
    const list = [...conversationsByTab[activeTab]];
    list.sort(
      (a, b) =>
        new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime(),
    );
    return list;
  }, [conversationsByTab, activeTab]);

  // Keep the active tab in sync with whatever the user selected — if they
  // open a disputed conversation we shouldn't leave the sidebar showing
  // Active and the focused row hidden.
  useEffect(() => {
    if (!selectedThread?.listingId) return;
    const listing = listingPreviews[selectedThread.listingId];
    if (!listing) return;
    const tab = tabFor(stateKeyFor(listing));
    setActiveTab(tab);
  }, [selectedThread, listingPreviews]);

  const selectedListing = selectedThread?.listingId
    ? listingPreviews[selectedThread.listingId]
    : undefined;
  const selectedState = stateKeyFor(selectedListing);
  const stepIdx = deriveStepIndex(selectedListing);
  const swatch = selectedListing ? paletteFor(selectedListing.id) : null;
  const isBuyer =
    !!address && !!selectedListing?.buyer &&
    selectedListing.buyer.toLowerCase() === address.toLowerCase();
  const canRelease = isBuyer && stepIdx >= 1 && selectedState !== "RELEASED";
  const isClosed = selectedState === "RELEASED";

  return (
    <main className="min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold text-white">Conversations</h1>
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
          <div className="glass-card overflow-hidden flex flex-col lg:flex-row min-h-[640px] rounded-glass-lg">
            {/* Order-grouped sidebar */}
            <aside
              className={`flex flex-col border-b lg:border-b-0 lg:border-r border-white/10 ${
                selectedThread ? "lg:w-[320px] shrink-0" : "w-full"
              }`}
            >
              <div className="flex flex-wrap items-center gap-1.5 border-b border-white/10 p-3">
                {TABS.map((t) => {
                  const isActive = t.key === activeTab;
                  const count = conversationsByTab[t.key].length;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setActiveTab(t.key)}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${
                        isActive
                          ? "border border-chrome/40 bg-chrome/[0.08] text-chrome"
                          : "border border-white/10 text-silver hover:bg-white/5"
                      }`}
                    >
                      {t.label}
                      <span
                        className={`font-mono text-[10px] ${isActive ? "text-chrome" : "text-silver"}`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="flex-1 overflow-y-auto py-2">
                {inboxLoading ? (
                  <p className="px-4 py-3 text-silver text-sm">Loading…</p>
                ) : visibleConversations.length === 0 ? (
                  <p className="px-4 py-3 text-silver text-sm">
                    {activeTab === "active"
                      ? "No active escrows."
                      : activeTab === "awaiting"
                        ? "No inquiries waiting."
                        : activeTab === "disputed"
                          ? "No disputes — nice."
                          : "Nothing closed yet."}
                  </p>
                ) : (
                  <ul className="space-y-1.5 px-2">
                    {visibleConversations.map((c) => {
                      const listingKey = c.listingId ?? "";
                      const isSelected =
                        selectedThread?.other === c.otherAddress &&
                        selectedThread?.listingId === listingKey;
                      const listing = c.listingId ? listingPreviews[c.listingId] : undefined;
                      const stateKey = stateKeyFor(listing);
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
                            className={`block w-full rounded-glass-lg border p-3 text-left transition-colors ${
                              isSelected
                                ? "border-chrome/40 bg-[#0e1422]/85"
                                : "border-transparent hover:bg-white/[0.03]"
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              {listing ? (
                                <ItemThumb listing={listing} size={42} />
                              ) : (
                                <Avatar address={c.otherAddress} size={42} />
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-[13px] font-bold text-white">
                                  {listing?.title ?? (
                                    <AddressDisplay
                                      address={c.otherAddress}
                                      className="text-white font-mono text-xs"
                                    />
                                  )}
                                </div>
                                <div className="mt-1 flex items-center gap-1.5">
                                  {listing?.price && (
                                    <span className="text-[11px] font-semibold text-chrome">
                                      {listing.price} ℏ
                                    </span>
                                  )}
                                  <StatePill stateKey={stateKey} />
                                </div>
                              </div>
                            </div>
                            <div className="mt-2 flex items-center gap-2 border-t border-white/[0.06] pt-2">
                              <Avatar address={c.otherAddress} size={20} />
                              <span className="min-w-0 flex-1 truncate text-[11px] text-silver">
                                {c.lastMessage.encrypted && (
                                  <LockIcon className="mr-1 inline-block h-2.5 w-2.5 opacity-60" />
                                )}
                                {c.preview}
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
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </aside>

            {/* Thread + right rail */}
            {selectedThread ? (
              <div className="flex min-h-0 flex-1 flex-col">
                {/* Large order header */}
                <div
                  className="flex items-center gap-4 border-b border-white/10 px-5 py-4"
                  style={{
                    background: swatch
                      ? `linear-gradient(135deg, ${swatch[0]}33, transparent)`
                      : undefined,
                  }}
                >
                  {selectedListing ? (
                    <ItemThumb listing={selectedListing} size={56} />
                  ) : (
                    <Avatar address={selectedThread.other} size={56} />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-base font-bold text-white">
                      {selectedListing?.title ?? "Direct conversation"}
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <Avatar address={selectedThread.other} size={18} />
                      <span className="font-mono text-[11px] text-white/80">
                        <AddressDisplay
                          address={selectedThread.other}
                          className="text-white/80 font-mono text-[11px]"
                        />
                      </span>
                      <E2EBadge />
                    </div>
                  </div>
                  {selectedListing?.price && (
                    <div className="text-right">
                      <div className="text-lg font-extrabold text-chrome">
                        {selectedListing.price} ℏ
                      </div>
                      <div className="font-mono text-[10px] text-silver">locked in escrow</div>
                    </div>
                  )}
                </div>

                <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
                  {/* Messages column */}
                  <div className="flex min-h-0 flex-1 flex-col">
                    <div className="flex-1 space-y-2 overflow-y-auto px-5 py-4">
                      {threadLoading ? (
                        <p className="text-silver text-sm">Loading thread…</p>
                      ) : threadMessages.length === 0 ? (
                        <p className="text-silver text-sm">No messages yet. Send a message below.</p>
                      ) : (
                        <>
                          <div className="my-2 text-center font-mono text-[10px] text-silver">
                            —{" "}
                            {selectedListing?.createdAt
                              ? `Order opened · ${new Date(
                                  selectedListing.createdAt,
                                ).toLocaleDateString()}`
                              : "Conversation"}
                            {" "}—
                          </div>
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

                  {/* Right rail: escrow controller */}
                  {selectedListing && (
                    <aside className="w-full border-t border-white/10 px-4 py-4 lg:w-[260px] lg:border-l lg:border-t-0 lg:overflow-y-auto">
                      <div className="mb-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-silver">
                        Escrow
                      </div>
                      <div className="mb-4 rounded-glass-lg border border-chrome/25 bg-chrome/[0.04] px-3 py-2.5">
                        <div className="font-mono text-[10px] text-chrome">Listing</div>
                        <div className="mt-1 break-all font-mono text-[11px] text-white">
                          {formatListingId(selectedListing.id)}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        {STEPS.map((s, i) => {
                          const done = stepIdx >= i;
                          const current = stepIdx === i;
                          return (
                            <div
                              key={s.key}
                              className={`flex items-center gap-2.5 py-1 text-[12px] ${
                                done ? "text-white" : "text-silver"
                              }`}
                            >
                              <span
                                className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold ${
                                  done ? "bg-chrome text-black" : "bg-white/[0.05] text-silver"
                                } ${current ? "ring-1 ring-chrome/60" : ""}`}
                              >
                                {done && !current ? "✓" : i + 1}
                              </span>
                              {s.label}
                            </div>
                          );
                        })}
                      </div>

                      <div className="mt-4 flex flex-col gap-2">
                        {canRelease ? (
                          <Link
                            href={listingHref(selectedListing.id)}
                            className="btn-frost-cta inline-flex items-center justify-center rounded-glass px-3 py-2 text-[12px] font-semibold"
                          >
                            Release {selectedListing.price} ℏ
                          </Link>
                        ) : (
                          <Link
                            href={listingHref(selectedListing.id)}
                            className="inline-flex items-center justify-center rounded-glass border border-white/10 px-3 py-2 text-[12px] text-silver transition-colors hover:border-chrome/40 hover:text-chrome"
                          >
                            View order →
                          </Link>
                        )}
                        {!isClosed && (
                          <button
                            type="button"
                            className="inline-flex items-center justify-center rounded-glass border border-rose-500/30 px-3 py-2 text-[12px] text-rose-400 transition-colors hover:bg-rose-500/[0.08]"
                          >
                            Open dispute
                          </button>
                        )}
                      </div>

                      {(selectedListing.trackingNumber || selectedListing.trackingCarrier) && (
                        <>
                          <div className="mb-2 mt-5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-silver">
                            Shipping
                          </div>
                          <div className="rounded-glass border border-white/10 bg-white/[0.02] px-3 py-2 text-[11px] text-white">
                            <div className="text-silver">
                              {selectedListing.trackingCarrier ?? "Carrier"}
                            </div>
                            <div className="break-all font-mono">
                              {selectedListing.trackingNumber ?? "—"}
                            </div>
                          </div>
                        </>
                      )}
                    </aside>
                  )}
                </div>
              </div>
            ) : (
              <div className="hidden flex-1 items-center justify-center p-8 text-center text-silver lg:flex">
                <div>
                  <div className="text-sm">Select a conversation to read messages.</div>
                  <div className="mt-1 font-mono text-[11px]">
                    Chats are grouped by order · all messages are end-to-end encrypted.
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
