import { Suspense, type ReactNode } from "react";
import type { Metadata } from "next";
import { HomeAbout, HomeIntro } from "../components/home/HomeSeo";
import { loadInitialMarketplaceListings } from "../lib/loadMarketplaceListings";
import { HOMEPAGE_SEO } from "../lib/seo/homepage";
import { socialImages } from "../lib/seo/metadata";
import MarketplacePageClient from "./marketplace/marketplace-page-client";

// Homepage title, description, and social cards. Other routes keep SEO_COPY.
// Next 14 rewrites alternates.canonical "/" to https://hashpop.io (no slash)
// because the pathname is "/". The link below is the homepage canonical.
const images = socialImages();

export const metadata: Metadata = {
  title: { absolute: HOMEPAGE_SEO.title },
  description: HOMEPAGE_SEO.description,
  openGraph: {
    type: "website",
    siteName: "Hashpop",
    title: HOMEPAGE_SEO.title,
    description: HOMEPAGE_SEO.description,
    url: "https://hashpop.io/",
    images: images.openGraph,
  },
  twitter: {
    card: "summary_large_image",
    site: "@hashpop",
    creator: "@hashpop",
    title: HOMEPAGE_SEO.title,
    description: HOMEPAGE_SEO.description,
    images: images.twitter,
  },
};

export const dynamic = "force-dynamic";

function ListingsFallback() {
  return (
    <main className="min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <p className="text-silver">Loading listings…</p>
      </div>
    </main>
  );
}

export default async function Home() {
  const { items, error } = await loadInitialMarketplaceListings();
  const intro: ReactNode = <HomeIntro />;
  const about: ReactNode = <HomeAbout />;
  return (
    <>
      <link rel="canonical" href="https://hashpop.io/" />
      <Suspense fallback={<ListingsFallback />}>
        <MarketplacePageClient
          initialItems={items}
          initialError={error}
          intro={intro}
          about={about}
        />
      </Suspense>
    </>
  );
}
