import type { Metadata } from "next";
import { fetchHbarUsdSnapshot, HBAR_USD_REVALIDATE_SECONDS } from "../../../lib/hbarUsd";
import { fetchPublicListing } from "../../../lib/seo/fetchListing";
import { listingJsonLd, serializeJsonLd } from "../../../lib/seo/jsonld";
import { listingMetadata } from "../../../lib/seo/metadata";
import ListingPageClient, { type Listing } from "./listing-page-client";

export const revalidate = HBAR_USD_REVALIDATE_SECONDS;

type ListingPageProps = {
  params: { id: string };
};

export async function generateMetadata({ params }: ListingPageProps): Promise<Metadata> {
  const listing = await fetchPublicListing(params.id);
  return listingMetadata(params.id, listing);
}

export default async function ListingPage({ params }: ListingPageProps) {
  const listing = await fetchPublicListing(params.id);
  const usdPerHbar = listing ? await fetchHbarUsdSnapshot() : null;
  const jsonLd = listing ? listingJsonLd(params.id, listing, { usdPerHbar }) : null;
  return (
    <>
      {jsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
        />
      ) : null}
      <ListingPageClient
        key={params.id}
        initialListing={listing as Listing | null}
        usdPerHbar={usdPerHbar}
      />
    </>
  );
}
