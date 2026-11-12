import { Suspense } from "react";
import type { Metadata } from "next";
import { MarketplaceHeading } from "../../components/marketplace/MarketplaceHeading";
import { loadInitialMarketplaceListings } from "../../lib/loadMarketplaceListings";
import { withEmptyCategoryRobots } from "../../lib/seo/categoryRobots";
import { marketplaceMetadata } from "../../lib/seo/metadata";
import { fetchPublicListings } from "../../lib/seo/publicListings";
import MarketplacePageClient from "./marketplace-page-client";

export async function generateMetadata(props: {
  searchParams?: Promise<{ category?: string | string[] }>;
}): Promise<Metadata> {
  const searchParams = await props.searchParams;
  const base = marketplaceMetadata();
  const raw = searchParams?.category;
  const category = Array.isArray(raw) ? raw[0] : raw;
  if (!category?.trim()) return base;
  const loaded = await fetchPublicListings();
  return withEmptyCategoryRobots(base, loaded, category);
}

export default async function MarketplacePage() {
  const { items, error } = await loadInitialMarketplaceListings();
  return (
    <>
      {/* /marketplace shows only the filters + grid. The H1 stays in the
          server HTML, visually hidden, and is not rendered from
          MarketplacePageClient so / does not get a second H1. */}
      <MarketplaceHeading />
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
    </>
  );
}
