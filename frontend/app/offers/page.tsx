"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useHashpackWallet } from "../../lib/hashpackWallet";
import { getApiUrl } from "../../lib/apiUrl";
import { formatPriceForDisplay } from "../../lib/formatPrice";
import { ConnectWalletButton } from "../../components/ConnectWalletButton";
import { BackToHashpop } from "../../components/BackToHashpop";
import { AddressDisplay } from "../../components/AddressDisplay";

type OfferListing = {
  id: string;
  title: string | null;
  imageUrl: string | null;
  price: string;
  seller: string;
  status: string;
} | null;

type Offer = {
  id: string;
  fromAddress: string;
  toAddress: string;
  offerAmount: string | null;
  offerStatus: string | null;
  createdAt: string;
  listingId: string | null;
  listing: OfferListing;
};

function StatusBadge({ status }: { status: string | null }) {
  if (status === "accepted") return <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[#00ffa3]/15 text-[#00ffa3]">Accepted</span>;
  if (status === "declined") return <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400">Declined</span>;
  return <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-white/10 text-silver">Pending</span>;
}

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

export default function OffersPage() {
  const { address } = useHashpackWallet();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;
    setLoading(true);
    fetch(`${getApiUrl()}/api/messages/offers?address=${encodeURIComponent(address.toLowerCase())}`)
      .then((r) => (r.ok ? r.json() : { offers: [] }))
      .then((d: { offers?: Offer[] }) => setOffers(d.offers ?? []))
      .catch(() => setOffers([]))
      .finally(() => setLoading(false));
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

  const received = offers.filter((o) => o.toAddress.toLowerCase() === address?.toLowerCase());
  const sent = offers.filter((o) => o.fromAddress.toLowerCase() === address?.toLowerCase());

  return (
    <main className="min-h-screen slide-in-right">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <BackToHashpop />
        <h1 className="text-xl font-bold text-white">Bids & Offers</h1>

        {!address ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-silver">Connect your wallet to view offers.</p>
            <ConnectWalletButton className="btn-frost-cta disabled:opacity-50" />
          </div>
        ) : loading ? (
          <p className="text-silver text-sm">Loading…</p>
        ) : offers.length === 0 ? (
          <div className="glass-card rounded-xl p-6 text-center">
            <p className="text-white font-medium">No offers yet.</p>
            <p className="text-silver text-sm mt-1">Offers you send or receive will appear here.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Received offers */}
            {received.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-silver uppercase tracking-wide">Received</h2>
                {received.map((offer) => (
                  <OfferCard
                    key={offer.id}
                    offer={offer}
                    myAddress={address}
                    isSent={false}
                    onRespond={respondToOffer}
                    respondingId={respondingId}
                  />
                ))}
              </section>
            )}

            {/* Sent offers */}
            {sent.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-silver uppercase tracking-wide">Sent</h2>
                {sent.map((offer) => (
                  <OfferCard
                    key={offer.id}
                    offer={offer}
                    myAddress={address}
                    isSent
                    onRespond={respondToOffer}
                    respondingId={respondingId}
                  />
                ))}
              </section>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function OfferCard({
  offer,
  myAddress,
  isSent,
  onRespond,
  respondingId,
}: {
  offer: Offer;
  myAddress: string;
  isSent: boolean;
  onRespond: (id: string, action: "accepted" | "declined") => Promise<void>;
  respondingId: string | null;
}) {
  const isPending = offer.offerStatus === "pending";
  const canRespond = !isSent && isPending;
  const threadUrl = offer.listingId
    ? `/messages?openThread=${encodeURIComponent(isSent ? offer.toAddress : offer.fromAddress)}&listingId=${encodeURIComponent(offer.listingId)}`
    : `/messages?openThread=${encodeURIComponent(isSent ? offer.toAddress : offer.fromAddress)}`;

  return (
    <div className="glass-card rounded-xl overflow-hidden">
      {/* Listing thumbnail row */}
      {offer.listing && (
        <Link href={`/listing/${encodeURIComponent(offer.listingId!)}`} className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-white/5 hover:bg-white/5 transition-colors">
          {offer.listing.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={offer.listing.imageUrl}
              alt={offer.listing.title ?? ""}
              className="h-12 w-12 rounded-lg object-cover shrink-0"
            />
          ) : (
            <div className="h-12 w-12 rounded-lg bg-white/10 shrink-0 flex items-center justify-center">
              <svg className="w-5 h-5 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{offer.listing.title ?? "Listing"}</p>
            <p className="text-xs text-silver/60">{formatPriceForDisplay(offer.listing.price)} HBAR asking</p>
          </div>
        </Link>
      )}

      {/* Offer details */}
      <div className="px-4 py-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold text-white">{offer.offerAmount} HBAR</span>
            <StatusBadge status={offer.offerStatus} />
          </div>
          <p className="text-xs text-silver/50 mt-0.5">
            {isSent ? "To " : "From "}
            <AddressDisplay
              address={isSent ? offer.toAddress : offer.fromAddress}
              showAvatar
              className="inline-flex"
            />
            {" · "}{relativeTime(offer.createdAt)}
          </p>
        </div>
        <Link
          href={threadUrl}
          className="shrink-0 text-xs text-chrome hover:text-white border border-white/15 rounded-lg px-3 py-1.5 transition-colors"
        >
          View thread
        </Link>
      </div>

      {/* Accept / Decline actions */}
      {canRespond && (
        <div className="flex border-t border-white/10">
          <button
            type="button"
            onClick={() => onRespond(offer.id, "declined")}
            disabled={!!respondingId}
            className="flex-1 py-2.5 text-sm font-semibold text-silver hover:text-white border-r border-white/10 transition-colors disabled:opacity-50"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={() => onRespond(offer.id, "accepted")}
            disabled={!!respondingId}
            className="flex-1 py-2.5 text-sm font-semibold text-[#00ffa3] hover:bg-[#00ffa3]/10 transition-colors disabled:opacity-50"
          >
            {respondingId === offer.id ? "…" : "Accept"}
          </button>
        </div>
      )}
    </div>
  );
}
