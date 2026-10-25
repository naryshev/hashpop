import Link from "next/link";
import { listingNotFoundMetadata } from "../../../lib/seo/metadata";

export const metadata = listingNotFoundMetadata();

export default function ListingNotFound() {
  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <h1 className="text-lg text-white">Listing not found</h1>
        <p className="mt-2 text-silver">This listing doesn&apos;t exist or was removed.</p>
        <Link
          href="/marketplace"
          className="mt-2 inline-block text-chrome underline hover:text-white"
        >
          Back to marketplace
        </Link>
      </div>
    </main>
  );
}
