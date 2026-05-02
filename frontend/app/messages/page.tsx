"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AddressDisplay } from "../../components/AddressDisplay";
import { useHashpackWallet } from "../../lib/hashpackWallet";
import { getApiUrl } from "../../lib/apiUrl";
import { resolveListingImageUrl } from "../../lib/listingImageUrl";

type InboxConversation = {
  otherAddress: string;
  listingId: string | null;
  lastMessage: {
    fromAddress: string;
    toAddress: string;
    body: string;
    createdAt: string;
    type?: string;
  };
  preview: string;
};

type Message = {
  id: string;
  fromAddress: string;
  toAddress: string;
  body: string;
  listingId: string | null;
  type?: string;
  imageUrl?: string | null;
  createdAt: string;
};

function MessagesPageContent() {
  const { address } = useHashpackWallet();
  const searchParams = useSearchParams();
  const [conversations, setConversations] = useState<InboxConversation[]>([]);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [selectedThread, setSelectedThread] = useState<{ other: string; listingId: string } | null>(
    null,
  );
  const [threadMessages, setThreadMessages] = useState<Message[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [sending, setSending] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [composeAddress, setComposeAddress] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [composeSending, setComposeSending] = useState(false);

  const listingSortedConversations = useMemo(() => {
    return [...conversations].sort((a, b) => {
      if (a.listingId && !b.listingId) return -1;
      if (!a.listingId && b.listingId) return 1;
      return (
        new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime()
      );
    });
  }, [conversations]);

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
    if (!address || !selectedThread) {
      setThreadMessages([]);
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
      await fetch(`${getApiUrl()}/api/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromAddress: address,
          toAddress: selectedThread.other,
          body: replyBody.trim(),
          listingId: selectedThread.listingId || undefined,
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
      fetchInbox();
    } finally {
      setSending(false);
    }
  }, [address, selectedThread, replyBody, sending, fetchInbox]);

  const sendCompose = useCallback(async () => {
    if (!address || !composeAddress.trim() || !composeBody.trim() || composeSending) return;
    const toAddr = composeAddress.trim().toLowerCase();
    if (toAddr === address.toLowerCase()) return;
    setComposeSending(true);
    try {
      await fetch(`${getApiUrl()}/api/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromAddress: address,
          toAddress: toAddr,
          body: composeBody.trim(),
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
  }, [address, composeAddress, composeBody, composeSending, fetchInbox]);

  return (
    <main className="min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-bold text-white">Messages</h1>
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

        {/* Compose Modal */}
        {showCompose && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
            onClick={() => setShowCompose(false)}
          >
            <div
              className="glass-card w-full max-w-md mx-4 p-6 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-lg font-bold text-white">New Message</h2>
              <input
                type="text"
                value={composeAddress}
                onChange={(e) => setComposeAddress(e.target.value)}
                placeholder="Recipient wallet address (0x...) or account ID (0.0.XXXXX)"
                className="input-frost w-full text-sm"
              />
              <textarea
                value={composeBody}
                onChange={(e) => setComposeBody(e.target.value)}
                placeholder="Type your message..."
                className="input-frost w-full text-sm min-h-[100px] resize-y"
                rows={4}
              />
              <div className="flex gap-3 justify-end">
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
                  {composeSending ? "Sending..." : "Send"}
                </button>
              </div>
            </div>
          </div>
        )}

        {!address ? (
          <p className="text-silver">Connect your wallet to view messages.</p>
        ) : (
          <div className="glass-card overflow-hidden flex flex-col md:flex-row min-h-[420px] rounded-xl">
            <div
              className={`border-b md:border-b-0 md:border-r border-white/10 ${selectedThread ? "md:w-96 shrink-0" : "w-full"}`}
            >
              {inboxLoading ? (
                <p className="p-4 text-silver text-sm">Loading...</p>
              ) : listingSortedConversations.length === 0 ? (
                <p className="p-4 text-silver text-sm">No messages yet.</p>
              ) : (
                <ul className="divide-y divide-white/5">
                  {listingSortedConversations.map((c) => {
                    const listingKey = c.listingId ?? "";
                    const isSelected =
                      selectedThread?.other === c.otherAddress &&
                      selectedThread?.listingId === listingKey;
                    return (
                      <li key={`${c.otherAddress}-${listingKey}`}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedThread({ other: c.otherAddress, listingId: listingKey });
                          }}
                          className={`w-full text-left p-3 hover:bg-white/5 transition-colors ${isSelected ? "bg-white/10" : ""}`}
                        >
                          <p className="text-white font-medium text-sm">
                            <AddressDisplay
                              address={c.otherAddress}
                              className="text-chrome font-mono text-xs"
                            />
                          </p>
                          {c.listingId && (
                            <p className="text-silver text-xs mt-0.5">
                              Listing:{" "}
                              {c.listingId.startsWith("0x")
                                ? c.listingId.slice(0, 10) + "..."
                                : c.listingId}
                            </p>
                          )}
                          <p className="text-silver text-xs mt-1 truncate">{c.preview}</p>
                          <p className="text-silver text-xs mt-0.5">
                            {c.lastMessage.createdAt
                              ? new Date(c.lastMessage.createdAt).toLocaleString()
                              : ""}
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
                  <span className="text-white font-medium text-sm block">
                    <AddressDisplay
                      address={selectedThread.other}
                      className="text-chrome font-mono text-xs"
                    />
                  </span>
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
                    <p className="text-silver text-sm">Loading thread...</p>
                  ) : threadMessages.length === 0 ? (
                    <p className="text-silver text-sm">No messages yet. Send a message below.</p>
                  ) : (
                    threadMessages.map((m) => {
                      const isMe = m.fromAddress.toLowerCase() === address.toLowerCase();
                      const isOffer = m.type === "offer";
                      const resolvedImg = resolveListingImageUrl(m.imageUrl);
                      return (
                        <div
                          key={m.id}
                          className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${isMe ? "bg-chrome/25 text-white" : "bg-white/10 text-silver"}`}
                          >
                            <p className="text-xs opacity-80 mb-0.5">
                              <AddressDisplay address={m.fromAddress} className="font-mono" />
                              {isOffer && (
                                <span className="ml-1.5 inline-block rounded bg-chrome/30 text-white px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                                  Offer
                                </span>
                              )}
                            </p>
                            {isOffer && resolvedImg && (
                              <Link
                                href={
                                  m.listingId
                                    ? `/listing/${encodeURIComponent(m.listingId)}`
                                    : "#"
                                }
                                className="block mb-2"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={resolvedImg}
                                  alt="Listing preview"
                                  className="w-full max-w-[240px] rounded-md border border-white/10 object-cover"
                                />
                              </Link>
                            )}
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
                    placeholder="Type a message..."
                    className="input-frost w-full text-sm min-h-[72px] resize-y mb-2"
                    rows={2}
                  />
                  <button
                    type="button"
                    onClick={sendReply}
                    disabled={!replyBody.trim() || sending}
                    className="btn-frost-cta w-full text-sm py-2 disabled:opacity-50"
                  >
                    {sending ? "Sending..." : "Send"}
                  </button>
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
        <div className="min-h-screen flex items-center justify-center text-silver">Loading...</div>
      }
    >
      <MessagesPageContent />
    </Suspense>
  );
}
