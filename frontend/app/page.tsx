"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ListingImage } from "../components/ListingImage";

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

export default function Home() {
  const [listings, setListings] = useState<any[]>([]);

  useEffect(() => {
    fetch(`${apiUrl}/api/listings`)
      .then((res) => res.json())
      .then((data) => setListings((data.listings || []).slice(0, 6)))
      .catch(() => setListings([]));
  }, []);

  return (
    <main className="p-6 space-y-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">hbay</h1>
          <p className="text-sm text-silver mt-1">Trustless marketplace on Hedera Hashgraph</p>
        </div>

        <section className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {listings.length === 0 ? (
            <p className="text-silver col-span-full">
              No listings yet. <Link href="/marketplace" className="text-chrome hover:text-white underline">View marketplace</Link> or <Link href="/create" className="text-chrome hover:text-white underline">create one</Link>.
            </p>
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
                    {formatListingId(listing.id) || "Untitled"}
                  </h2>
                  <p className="text-chrome mt-2 font-medium">{listing.price} HBAR</p>
                </div>
              </Link>
            ))
          )}
        </section>
      </div>
    </main>
  );
}
