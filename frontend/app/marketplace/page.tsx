"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ListingImage } from "../../components/ListingImage";

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

export default function MarketplacePage() {
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${apiUrl}/api/listings`)
      .then((res) => res.json())
      .then((data) => setListings(data.listings || []))
      .catch(() => setListings([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="p-6 space-y-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-semibold text-white mb-6">Marketplace</h1>
        {loading ? (
          <p className="text-silver">Loading listings…</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            {listings.length === 0 ? (
              <p className="text-silver col-span-full">No listings found. Create one to get started!</p>
            ) : (
              listings.map((listing) => (
                <Link
                  key={listing.id}
                  href={`/listing/${encodeURIComponent(listing.id)}`}
                  className="glass-card overflow-hidden transition-all duration-200 hover:border-white/20 hover:shadow-glow"
                >
                  <ListingImage className="w-full" />
                  <div className="p-4">
                    <p className="text-sm text-silver">Listing #{formatListingId(listing.id)}</p>
                    <h2 className="text-lg font-medium text-white mt-1">
                      {listing.title || formatListingId(listing.id) || "Untitled"}
                    </h2>
                    <p className="text-chrome mt-2 font-medium">{listing.price} HBAR</p>
                  </div>
                </Link>
              ))
            )}
          </div>
        )}
      </div>
    </main>
  );
}
