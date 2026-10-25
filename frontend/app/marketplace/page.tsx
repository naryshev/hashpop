import { Suspense } from "react";
import type { Metadata } from "next";
import { loadInitialMarketplaceListings } from "../../lib/loadMarketplaceListings";
import { marketplaceMetadata } from "../../lib/seo/metadata";
import MarketplacePageClient from "./marketplace-page-client";

export function generateMetadata(): Metadata {
  return marketplaceMetadata();
}

export default async function MarketplacePage() {
  const { items, error } = await loadInitialMarketplaceListings();
  return (
    <Suspense
      fallback={
        <main className="min-h-screen">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
            <p className="text-silver">Loading listings…</p>
          </div>
        </main>
      }
    >
      <MarketplacePageClient initialItems={items} initialError={error} />
    </Suspense>
  );
}
