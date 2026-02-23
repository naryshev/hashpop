"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AddressDisplay } from "../../components/AddressDisplay";
import { AccountSidebar } from "../../components/AccountSidebar";
import { useHashpackWallet } from "../../lib/hashpackWallet";
import { getApiUrl } from "../../lib/apiUrl";

type InboxConversation = {
  otherAddress: string;
  listingId: string | null;
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

function MessagesPageContent() {
  const { address } = useHashpackWallet();
  const searchParams = useSearchParams();
  const [conversations, setConversations] = useState<InboxConversation[]>([]);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [selectedThread, setSelectedThread] = useState<{ other: string; listingId: string } | null>(null);
  const [threadMessages, setThreadMessages] = useState<Message[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [sending, setSending] = useState(false);

  const listingSortedConversations = useMemo(() => {
    return [...conversations].sort((a, b) => {
      if (a.listingId && !b.listingId) return -1;
      if (!a.listingId && b.listingId) return 1;
      return new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime();
    });
  }, [conversations]);

  useEffect(() => {
    if (!address) return;
    const open = searchParams.get("openThread");
    const listingId = searchParams.get("listingId");
    if (open && listingId) {
      setSelectedThread({ other: decodeURIComponent(open), listingId: decodeURIComponent(listingId) });
    }
  }, [address, searchParams]);

  const fetchInbox = useCallback(() => {
    if (!address) return;
    setInboxLoading(true);
    fetch(`${getApiUrl()}/api/messages/inbox?address=${encodeURIComponent(address)}`)
      .then((res) => res.json())
      .then((data: { conversations?: InboxConversation[] }) => setConversations(data.conversations ?? []))
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
    const q = new URLSearchParams({ address, other: selectedThread.other, listingId: selectedThread.listingId });
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
          listingId: selectedThread.listingId,
        }),
      });
      setReplyBody("");
      const q = new URLSearchParams({ address, other: selectedThread.other, listingId: selectedThread.listingId });
      const res = await fetch(`${getApiUrl()}/api/messages/thread?${q}`);
      const data = await res.json();
      setThreadMessages(data.messages ?? []);
      fetchInbox();
    } finally {
      setSending(false);
    }
  }, [address, selectedThread, replyBody, sending, fetchInbox]);

  return (
    <main className="min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <h1 className="text-xl sm:text-2xl font-bold text-white">Messages</h1>
        <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
          <AccountSidebar />
          {!address ? (
            <p className="text-silver">Connect your wallet to view messages.</p>
          ) : (
            <div className="glass-card overflow-hidden flex flex-col md:flex-row min-h-[420px] rounded-xl">
              <div className={`border-b md:border-b-0 md:border-r border-white/10 ${selectedThread ? "md:w-96 shrink-0" : "w-full"}`}>
                {inboxLoading ? (
                  <p className="p-4 text-silver text-sm">Loading…</p>
                ) : listingSortedConversations.length === 0 ? (
                  <p className="p-4 text-silver text-sm">No messages yet.</p>
                ) : (
                  <ul className="divide-y divide-white/5">
                    {listingSortedConversations.map((c) => {
                      const listingKey = c.listingId ?? "";
                      const isSelected = selectedThread?.other === c.otherAddress && selectedThread?.listingId === listingKey;
                      return (
                        <li key={`${c.otherAddress}-${listingKey}`}>
                          <button
                            type="button"
                            onClick={() => {
                              if (!c.listingId) return;
                              setSelectedThread({ other: c.otherAddress, listingId: c.listingId });
                            }}
                            className={`w-full text-left p-3 hover:bg-white/5 transition-colors ${isSelected ? "bg-white/10" : ""}`}
                          >
                            <p className="text-white font-medium text-sm">
                              <AddressDisplay address={c.otherAddress} className="text-chrome font-mono text-xs" />
                            </p>
                            {c.listingId && (
                              <p className="text-silver text-xs mt-0.5">
                                Listing: {c.listingId.startsWith("0x") ? c.listingId.slice(0, 10) + "…" : c.listingId}
                              </p>
                            )}
                            <p className="text-silver text-xs mt-1 truncate">{c.preview}</p>
                            <p className="text-silver text-xs mt-0.5">
                              {c.lastMessage.createdAt ? new Date(c.lastMessage.createdAt).toLocaleString() : ""}
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
                      <AddressDisplay address={selectedThread.other} className="text-chrome font-mono text-xs" />
                    </span>
                    <Link
                      href={`/listing/${encodeURIComponent(selectedThread.listingId)}`}
                      className="text-chrome text-xs hover:text-white"
                    >
                      View listing
                    </Link>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
                    {threadLoading ? (
                      <p className="text-silver text-sm">Loading thread…</p>
                    ) : threadMessages.length === 0 ? (
                      <p className="text-silver text-sm">No messages yet. Send a message below.</p>
                    ) : (
                      threadMessages.map((m) => {
                        const isMe = m.fromAddress.toLowerCase() === address.toLowerCase();
                        return (
                          <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                            <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${isMe ? "bg-chrome/25 text-white" : "bg-white/10 text-silver"}`}>
                              <p className="text-xs opacity-80 mb-0.5">
                                <AddressDisplay address={m.fromAddress} className="font-mono" />
                              </p>
                              <p className="whitespace-pre-wrap">{m.body}</p>
                              <p className="text-xs opacity-70 mt-1">{new Date(m.createdAt).toLocaleString()}</p>
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
                      placeholder="Type a private message…"
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
        </div>
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
