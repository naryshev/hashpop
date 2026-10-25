import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchHbarUsdSnapshot, HBAR_USD_REVALIDATE_SECONDS } from "../../../lib/hbarUsd";
import { fetchPublicListing } from "../../../lib/seo/fetchListing";
import { listingJsonLd, serializeJsonLd } from "../../../lib/seo/jsonld";
import {
  listingMetadata,
  listingNotFoundMetadata,
  listingUnavailableMetadata,
} from "../../../lib/seo/metadata";
import ListingPageClient, { type Listing } from "./listing-page-client";

export const revalidate = HBAR_USD_REVALIDATE_SECONDS;

type ListingPageProps = {
  params: { id: string };
};

export async function generateMetadata({ params }: ListingPageProps): Promise<Metadata> {
  const result = await fetchPublicListing(params.id);
  if (result.status === "not_found") return listingNotFoundMetadata();
  if (result.status === "unavailable") return listingUnavailableMetadata();
  return listingMetadata(params.id, result.listing);
}

export default async function ListingPage({ params }: ListingPageProps) {
  const result = await fetchPublicListing(params.id);
  if (result.status === "not_found") notFound();
  if (result.status === "unavailable") {
    return (
      <ListingPageClient
        key={params.id}
        initialListing={null}
        initialOutcome="unavailable"
        usdPerHbar={null}
      />
    );
  }
  const usdPerHbar = await fetchHbarUsdSnapshot();
  const jsonLd = listingJsonLd(params.id, result.listing, { usdPerHbar });
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
        initialListing={result.listing as Listing}
        initialOutcome="ready"
        usdPerHbar={usdPerHbar}
      />
    </>
  );
}
