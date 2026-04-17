"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useHashpackWallet } from "../../lib/hashpackWallet";
import { getApiUrl } from "../../lib/apiUrl";
import { formatPriceForDisplay } from "../../lib/formatPrice";
import { ConnectWalletButton } from "../../components/ConnectWalletButton";
import { BackToHashpop } from "../../components/BackToHashpop";
import { AddressDisplay } from "../../components/AddressDisplay";

type Conversation = {
  otherAddress: string;
  listingId: string | null;
  preview: string;
  unreadCount: number;
  lastMessage: { createdAt: string; type?: string | null };
  listing: { title: string | null; imageUrl: string | null; price: string } | null;
};

type Offer = {
  id: string;
  fromAddress: string;
  toAddress: string;
  offerAmount: string | null;
  offerStatus: string | null;
  createdAt: string;
  listingId: string | null;
  listing: { id: string; title: string | null; imageUrl: string | null; price: string; seller: string; status: string } | null;
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function EmptySection({ message }: { message: string }) {
  return (
    <p className="text-silver/60 text-sm py-2">{message}</p>
  );
}

export default function AlertsPage() {
  const { address } = useHashpackWallet();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingOffers, setLoadingOffers] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;

    setLoadingMessages(true);
    fetch(`${getApiUrl()}/api/messages/inbox?address=${encodeURIComponent(address.toLowerCase())}`)
      .then((r) => (r.ok ? r.json() : { conversations: [] }))
      .then((d: { conversations?: Conversation[] }) => setConversations(d.conversations ?? []))
      .catch(() => setConversations([]))
      .finally(() => setLoadingMessages(false));

    setLoadingOffers(true);
    fetch(`${getApiUrl()}/api/messages/offers?address=${encodeURIComponent(address.toLowerCase())}`)
      .then((r) => (r.ok ? r.json() : { offers: [] }))
      .then((d: { offers?: Offer[] }) => setOffers(d.offers ?? []))
      .catch(() => setOffers([]))
      .finally(() => setLoadingOffers(false));
  }, [address]);

  const respondToOffer = async (offerId: string, action: "accepted" | "declined") => {
    if (!address || respondingId) return;
    setRespondingId(offerId);
    try {
      await fetch(`${getApiUrl()}/api/messages/${offerId}/offer-response`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, action }),
      });
      setOffers((prev) =>
        prev.map((o) => (o.id === offerId ? { ...o, offerStatus: action } : o))
      );
    } finally {
      setRespondingId(null);
    }
  };

  const unreadConvos = conversations.filter((c) => c.unreadCount > 0);
  const receivedOffers = offers.filter((o) => o.toAddress.toLowerCase() === address?.toLowerCase());
  const pendingOffers = receivedOffers.filter((o) => o.offerStatus === "pending" || !o.offerStatus);

  return (
    <main className="min-h-screen slide-in-right">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-8">
        <div>
          <BackToHashpop />
          <h1 className="text-xl font-bold text-white mt-1">Alerts</h1>
        </div>

        {!address ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-silver">Connect your wallet to view alerts.</p>
            <ConnectWalletButton className="btn-frost-cta disabled:opacity-50" />
          </div>
        ) : (
          <div className="space-y-8">

            {/* Offers requiring action */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-silver uppercase tracking-wide">
                  Offers
                  {pendingOffers.length > 0 && (
                    <span className="ml-2 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-[#00ffa3] text-black text-[10px] font-bold">
                      {pendingOffers.length}
                    </span>
                  )}
                </h2>
                <Link href="/offers" className="text-xs text-chrome hover:text-white">
                  See all
                </Link>
              </div>
              {loadingOffers ? (
                <p className="text-silver/60 text-sm">Loading…</p>
              ) : receivedOffers.length === 0 ? (
                <EmptySection message="No offers received yet." />
              ) : (
                <div className="space-y-3">
                  {receivedOffers.slice(0, 5).map((offer) => {
                    const isPending = offer.offerStatus === "pending" || !offer.offerStatus;
                    const threadUrl = offer.listingId
                      ? `/messages?openThread=${encodeURIComponent(offer.fromAddress)}&listingId=${encodeURIComponent(offer.listingId)}`
                      : `/messages?openThread=${encodeURIComponent(offer.fromAddress)}`;
                    return (
                      <div key={offer.id} className="glass-card rounded-xl overflow-hidden">
                        {offer.listing && (
                          <Link
                            href={`/listing/${encodeURIComponent(offer.listingId!)}`}
                            className="flex items-center gap-3 px-4 pt-3 pb-2.5 border-b border-white/5 hover:bg-white/5 transition-colors"
                          >
                            {offer.listing.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={offer.listing.imageUrl}
                                alt={offer.listing.title ?? ""}
                                className="h-10 w-10 rounded-lg object-cover shrink-0"
                              />
                            ) : (
                              <div className="h-10 w-10 rounded-lg bg-white/10 shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-white truncate">
                                {offer.listing.title ?? "Listing"}
                              </p>
                              <p className="text-xs text-silver/50">
                                {formatPriceForDisplay(offer.listing.price)} HBAR asking
                              </p>
                            </div>
                          </Link>
                        )}
                        <div className="px-4 py-3 flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-base font-bold text-white">
                              {offer.offerAmount} HBAR
                            </p>
                            <p className="text-xs text-silver/50 mt-0.5">
                              From{" "}
                              <AddressDisplay
                                address={offer.fromAddress}
                                showAvatar
                                className="inline-flex"
                              />
                              {" · "}{relativeTime(offer.createdAt)}
                            </p>
                          </div>
                          {!isPending && (
                            <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                              offer.offerStatus === "accepted"
                                ? "bg-[#00ffa3]/15 text-[#00ffa3]"
                                : "bg-rose-500/15 text-rose-400"
                            }`}>
                              {offer.offerStatus}
                            </span>
                          )}
                          <Link
                            href={threadUrl}
                            className="shrink-0 text-xs text-chrome hover:text-white border border-white/15 rounded-lg px-3 py-1.5 transition-colors"
                          >
                            View
                          </Link>
                        </div>
                        {isPending && (
                          <div className="flex border-t border-white/10">
                            <button
                              type="button"
                              onClick={() => respondToOffer(offer.id, "declined")}
                              disabled={!!respondingId}
                              className="flex-1 py-2.5 text-sm font-semibold text-silver hover:text-white border-r border-white/10 transition-colors disabled:opacity-50"
                            >
                              Decline
                            </button>
                            <button
                              type="button"
                              onClick={() => respondToOffer(offer.id, "accepted")}
                              disabled={!!respondingId}
                              className="flex-1 py-2.5 text-sm font-semibold text-[#00ffa3] hover:bg-[#00ffa3]/10 transition-colors disabled:opacity-50"
                            >
                              {respondingId === offer.id ? "…" : "Accept"}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Unread messages */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-silver uppercase tracking-wide">
                  Messages
                  {unreadConvos.length > 0 && (
                    <span className="ml-2 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-[#00ffa3] text-black text-[10px] font-bold">
                      {unreadConvos.length}
                    </span>
                  )}
                </h2>
                <Link href="/messages" className="text-xs text-chrome hover:text-white">
                  See all
                </Link>
              </div>
              {loadingMessages ? (
                <p className="text-silver/60 text-sm">Loading…</p>
              ) : unreadConvos.length === 0 ? (
                <EmptySection message="No unread messages." />
              ) : (
                <div className="glass-card rounded-xl divide-y divide-white/5 overflow-hidden">
                  {unreadConvos.slice(0, 8).map((convo) => {
                    const threadUrl = `/messages?openThread=${encodeURIComponent(convo.otherAddress)}${convo.listingId ? `&listingId=${encodeURIComponent(convo.listingId)}` : ""}`;
                    return (
                      <Link
                        key={`${convo.otherAddress}-${convo.listingId ?? ""}`}
                        href={threadUrl}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors"
                      >
                        {convo.listing?.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={convo.listing.imageUrl}
                            alt=""
                            className="h-10 w-10 rounded-lg object-cover shrink-0"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-white/[0.08] shrink-0 flex items-center justify-center">
                            <svg className="w-4 h-4 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                            </svg>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <AddressDisplay
                              address={convo.otherAddress}
                              className="text-sm font-medium text-white truncate"
                            />
                            {convo.unreadCount > 0 && (
                              <span className="shrink-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#00ffa3] px-1 text-[10px] font-bold text-black">
                                {convo.unreadCount}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-silver/60 truncate mt-0.5">{convo.preview}</p>
                        </div>
                        <p className="text-[10px] text-silver/40 shrink-0">
                          {relativeTime(convo.lastMessage.createdAt)}
                        </p>
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>

          </div>
        )}
      </div>
    </main>
  );
}
