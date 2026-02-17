"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { BuyButton } from "../../../components/BuyButton";
import { BidPanel } from "../../../components/BidPanel";
import { ListingImage } from "../../../components/ListingImage";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

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

export default function ListingPage() {
  const params = useParams();
  const id = (params.id as string) || "";
  const [listing, setListing] = useState<{ id: string; seller: string; price: string; status: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`${apiUrl}/api/listing/${encodeURIComponent(id)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => setListing(data.listing))
      .catch(() => setListing(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <main className="p-6 max-w-4xl mx-auto">
        <p className="text-silver">Loading…</p>
      </main>
    );
  }

  if (!listing) {
    return (
      <main className="p-6 max-w-4xl mx-auto">
        <p className="text-silver">Listing not found.</p>
        <Link href="/marketplace" className="text-chrome hover:text-white underline mt-2 inline-block">
          Back to marketplace
        </Link>
      </main>
    );
  }

  const isListed = listing.status === "LISTED";
  const displayId = formatListingId(listing.id);

  return (
    <main className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <p className="text-sm text-silver">Listing #{displayId}</p>
        <h1 className="text-3xl font-semibold text-white mt-1">{displayId}</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <ListingImage aspectRatio="video" className="w-full" />
          <div className="glass-card p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Details</h2>
            <div className="space-y-2">
              <p className="text-sm text-silver">
                Price: <span className="text-chrome font-medium">{listing.price} HBAR</span>
              </p>
              <p className="text-sm text-silver">
                Seller: <span className="text-chrome font-mono text-xs">{listing.seller}</span>
              </p>
              <p className="text-sm text-silver">Status: {listing.status}</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {isListed && <BuyButton listingId={listing.id} price={listing.price} />}
          <BidPanel auctionId={listing.id} />
        </div>
      </div>
    </main>
  );
}
