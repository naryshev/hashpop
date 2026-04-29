"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { useHashpackWallet } from "../../lib/hashpackWallet";
import { getApiUrl } from "../../lib/apiUrl";

type Conversation = {
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

function shortAddr(addr: string): string {
  if (!addr) return "";
  if (/^\d+\.\d+\.\d+$/.test(addr)) return addr;
  if (addr.startsWith("0x") && addr.length > 12) return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
  return addr;
}

function relativeDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function OfferCard({ conv, myAddress }: { conv: Conversation; myAddress: string }) {
  const isUnread = conv.lastMessage.fromAddress.toLowerCase() !== myAddress.toLowerCase();
  const href = `/messages?openThread=${encodeURIComponent(conv.otherAddress)}${conv.listingId ? `&listingId=${encodeURIComponent(conv.listingId)}` : ""}`;

  return (
    <Link
      href={href}
      className="flex items-center gap-4 p-4 hover:bg-white/5 transition-colors active:bg-white/10"
    >
      <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-white/80 text-base font-bold select-none">
        {conv.otherAddress[2]?.toUpperCase() ?? "?"}
        {isUnread && (
          <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-[#00ffa3] border-2 border-[#0b111b]" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className={`text-sm truncate ${isUnread ? "text-white font-semibold" : "text-white font-medium"}`}>
            {shortAddr(conv.otherAddress)}
          </p>
          <p className="text-silver/50 text-xs shrink-0">{relativeDate(conv.lastMessage.createdAt)}</p>
        </div>
        {conv.listingId && (
          <p className="text-[#00ffa3]/70 text-xs mt-0.5 truncate font-mono">
            {conv.listingId.startsWith("0x") ? `${conv.listingId.slice(0, 14)}…` : conv.listingId}
          </p>
        )}
        <p className="text-silver/60 text-xs mt-0.5 truncate">
          {conv.lastMessage.encrypted ? "Encrypted message" : conv.preview}
        </p>
      </div>
    </Link>
  );
}

export default function OffersPage() {
  const { address } = useHashpackWallet();
  const [mounted, setMounted] = useState(false);
  const [allOffers, setAllOffers] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => setMounted(true), []);

  const fetchInbox = useCallback(() => {
    if (!address) { setLoading(false); return; }
    setLoading(true);
    fetch(`${getApiUrl()}/api/messages/inbox?address=${encodeURIComponent(address)}`)
      .then((r) => (r.ok ? r.json() : { conversations: [] }))
      .then((d: { conversations?: Conversation[] }) =>
        setAllOffers((d.conversations ?? []).filter((c) => Boolean(c.listingId))),
      )
      .catch(() => setAllOffers([]))
      .finally(() => setLoading(false));
  }, [address]);

  useEffect(() => { fetchInbox(); }, [fetchInbox]);

  const newOffers = allOffers.filter(
    (c) => c.lastMessage.fromAddress.toLowerCase() !== (address ?? "").toLowerCase(),
  );
  const repliedOffers = allOffers.filter(
    (c) => c.lastMessage.fromAddress.toLowerCase() === (address ?? "").toLowerCase(),
  );

  return (
    <main className="min-h-screen slide-in-right">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div>
          <Link
            href="/alerts"
            className="inline-flex items-center gap-1 text-sm text-silver/60 hover:text-white mb-3 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Alerts
          </Link>
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-white">Bids & Offers</h1>
            {newOffers.length > 0 && (
              <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-[#00ffa3] px-2 text-xs font-bold text-black">
                {newOffers.length}
              </span>
            )}
          </div>
        </div>

        {!mounted ? (
          <p className="text-silver text-sm">Loading…</p>
        ) : !address ? (
          <p className="text-silver">Connect your wallet to view offers.</p>
        ) : loading ? (
          <p className="text-silver text-sm">Loading…</p>
        ) : allOffers.length === 0 ? (
          <div className="glass-card rounded-2xl p-6 text-center">
            <p className="text-white font-medium">No offers yet.</p>
            <p className="text-silver text-sm mt-2">
              When buyers message you about your listings, they will appear here.
            </p>
            <Link href="/selling" className="inline-block mt-4 text-sm text-[#00ffa3] hover:text-white transition-colors">
              View your listings →
            </Link>
          </div>
        ) : (
          <>
            {newOffers.length > 0 && (
              <section>
                <p className="text-[11px] font-bold tracking-widest text-silver/60 uppercase mb-3">New</p>
                <div className="glass-card overflow-hidden rounded-2xl divide-y divide-white/5">
                  {newOffers.map((c) => (
                    <OfferCard key={`${c.otherAddress}-${c.listingId ?? ""}`} conv={c} myAddress={address} />
                  ))}
                </div>
              </section>
            )}
            {repliedOffers.length > 0 && (
              <section>
                <p className="text-[11px] font-bold tracking-widest text-silver/60 uppercase mb-3">Replied</p>
                <div className="glass-card overflow-hidden rounded-2xl divide-y divide-white/5">
                  {repliedOffers.map((c) => (
                    <OfferCard key={`${c.otherAddress}-${c.listingId ?? ""}`} conv={c} myAddress={address} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
