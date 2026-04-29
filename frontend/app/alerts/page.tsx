"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { useHashpackWallet } from "../../lib/hashpackWallet";
import { getApiUrl } from "../../lib/apiUrl";
import { formatHbarWithUsd } from "../../lib/hbarUsd";
import { useHbarUsd } from "../../hooks/useHbarUsd";
import { UserAvatar } from "../../components/UserAvatar";

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
  const now = Date.now();
  const diff = now - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function SectionHeader({ label, href }: { label: string; href?: string }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <span className="text-[11px] font-bold tracking-widest text-silver/60 uppercase">{label}</span>
      {href && (
        <Link href={href} className="text-xs text-[#00ffa3] hover:text-white transition-colors font-medium">
          See all
        </Link>
      )}
    </div>
  );
}

function ActivityRow({ sale, usdRate }: { sale: SaleItem; usdRate: number | null }) {
  const thumb = sale.listing?.imageUrl ?? null;
  const title = sale.listing?.title ?? (sale.listingId ? `${sale.listingId.slice(0, 18)}…` : "Untitled sale");
  const status = sale.listing?.status ?? "";
  const isEscrow = status === "LOCKED";
  const href = sale.listingId ? `/listing/${encodeURIComponent(sale.listingId)}` : "#";

  return (
    <Link href={href} className="flex items-center gap-3 p-3 hover:bg-white/5 transition-colors active:bg-white/10">
      <div className="h-12 w-12 shrink-0 rounded-lg overflow-hidden bg-white/5 border border-white/10">
        {thumb ? (
          <img src={thumb} alt={title} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-white/20 text-lg">□</div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-medium leading-snug truncate">{title}</p>
        <p className="text-silver/60 text-xs mt-0.5">Sold · {relativeDate(sale.createdAt)}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-[#00ffa3] text-sm font-semibold">{formatHbarWithUsd(sale.amount, usdRate)}</p>
        <p className={`text-xs mt-0.5 font-medium ${isEscrow ? "text-amber-400" : "text-[#00ffa3]/70"}`}>
          {isEscrow ? "In Escrow" : "Complete"}
        </p>
      </div>
    </Link>
  );
}

function OfferRow({ conv, myAddress }: { conv: Conversation; myAddress: string }) {
  const href = `/messages?openThread=${encodeURIComponent(conv.otherAddress)}${conv.listingId ? `&listingId=${encodeURIComponent(conv.listingId)}` : ""}`;
  return (
    <Link href={href} className="flex items-center gap-3 p-3 hover:bg-white/5 transition-colors active:bg-white/10">
      <UserAvatar address={conv.otherAddress} size="md" />
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-medium truncate">{shortAddr(conv.otherAddress)}</p>
        <p className="text-silver/60 text-xs mt-0.5 truncate">
          {conv.lastMessage.encrypted ? "Encrypted message" : conv.preview}
        </p>
      </div>
      <div className="shrink-0">
        <p className="text-silver/50 text-xs">{relativeDate(conv.lastMessage.createdAt)}</p>
      </div>
    </Link>
  );
}

function UnreadRow({ conv, myAddress }: { conv: Conversation; myAddress: string }) {
  const href = `/messages?openThread=${encodeURIComponent(conv.otherAddress)}${conv.listingId ? `&listingId=${encodeURIComponent(conv.listingId)}` : ""}`;
  return (
    <Link href={href} className="flex items-center gap-3 p-3 hover:bg-white/5 transition-colors active:bg-white/10">
      <UserAvatar address={conv.otherAddress} size="md" withDot />
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-semibold truncate">{shortAddr(conv.otherAddress)}</p>
        <p className="text-silver/60 text-xs mt-0.5 truncate">
          {conv.lastMessage.encrypted ? "Encrypted message" : conv.preview}
        </p>
      </div>
      <div className="shrink-0">
        <p className="text-silver/50 text-xs">{relativeDate(conv.lastMessage.createdAt)}</p>
      </div>
    </Link>
  );
}

export default function AlertsPage() {
  const { address } = useHashpackWallet();
  const [mounted, setMounted] = useState(false);
  const [sales, setSales] = useState<SaleItem[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const usdRate = useHbarUsd();

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!address) { setLoading(false); return; }
    setLoading(true);
    Promise.all([
      fetch(`${getApiUrl()}/api/user/${address}/purchases`)
        .then((r) => (r.ok ? r.json() : { purchases: [] }))
        .then((d: { purchases?: SaleItem[] }) => setSales((d.purchases ?? []).filter((s) => s.role === "seller")))
        .catch(() => setSales([])),
      fetch(`${getApiUrl()}/api/messages/inbox?address=${encodeURIComponent(address)}`)
        .then((r) => (r.ok ? r.json() : { conversations: [] }))
        .then((d: { conversations?: Conversation[] }) => setConversations(d.conversations ?? []))
        .catch(() => setConversations([])),
    ]).finally(() => setLoading(false));
  }, [address]);

  // Conversations where the last message is FROM someone else = needs attention
  const unread = conversations
    .filter((c) => c.lastMessage.fromAddress.toLowerCase() !== address?.toLowerCase())
    .slice(0, 5);

  // Offer conversations: about listings, last message from someone else
  const offerConvs = conversations
    .filter((c) => c.listingId && c.lastMessage.fromAddress.toLowerCase() !== address?.toLowerCase())
    .slice(0, 5);

  // Recent sales activity
  const recentSales = sales.slice(0, 6);

  return (
    <main className="min-h-screen slide-in-right">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 text-sm text-silver/60 hover:text-white mb-3 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            My Hashpop
          </Link>
          <h1 className="text-2xl font-bold text-white">Alerts</h1>
        </div>

        {!mounted ? (
          <p className="text-silver text-sm">Loading…</p>
        ) : !address ? (
          <p className="text-silver">Connect your wallet to view alerts.</p>
        ) : (
          <>
            {/* Unread Messages */}
            <section>
              <SectionHeader label="Unread Messages" href="/messages" />
              <div className="glass-card overflow-hidden rounded-2xl divide-y divide-white/5">
                {loading ? (
                  <p className="p-4 text-silver text-sm">Loading…</p>
                ) : unread.length === 0 ? (
                  <p className="p-4 text-silver text-sm">No unread messages.</p>
                ) : (
                  unread.map((c) => (
                    <UnreadRow
                      key={`${c.otherAddress}-${c.listingId ?? ""}`}
                      conv={c}
                      myAddress={address}
                    />
                  ))
                )}
              </div>
            </section>

            {/* Offers Received */}
            <section>
              <SectionHeader label="Offers Received" href="/offers" />
              <div className="glass-card overflow-hidden rounded-2xl divide-y divide-white/5">
                {loading ? (
                  <p className="p-4 text-silver text-sm">Loading…</p>
                ) : offerConvs.length === 0 ? (
                  <p className="p-4 text-silver text-sm">No offers received yet.</p>
                ) : (
                  offerConvs.map((c) => (
                    <OfferRow
                      key={`${c.otherAddress}-${c.listingId ?? ""}`}
                      conv={c}
                      myAddress={address}
                    />
                  ))
                )}
              </div>
            </section>

            {/* Recent Activity */}
            <section>
              <SectionHeader label="Recent Activity" href="/purchases" />
              <div className="glass-card overflow-hidden rounded-2xl divide-y divide-white/5">
                {loading ? (
                  <p className="p-4 text-silver text-sm">Loading…</p>
                ) : recentSales.length === 0 ? (
                  <p className="p-4 text-silver text-sm">No recent sales activity.</p>
                ) : (
                  recentSales.map((sale) => (
                    <ActivityRow key={sale.id} sale={sale} usdRate={usdRate} />
                  ))
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
