import type { Metadata } from "next";
import { getApiUrl } from "../../../lib/apiUrl";
import { formatPriceForDisplay } from "../../../lib/formatPrice";

type ListingMeta = {
  title?: string | null;
  subtitle?: string | null;
  description?: string | null;
  price?: string;
  imageUrl?: string | null;
  mediaUrls?: string[];
};

/**
 * Dynamic listing metadata: real title, description, price, and photo for
 * search results and link previews (iMessage/X/Discord cards). Best effort —
 * a slow or down API falls back to a generic title rather than failing the
 * page.
 */
export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const fallback: Metadata = { title: "Listing" };
  const id = decodeURIComponent(params?.id ?? "");
  if (!id) return fallback;
  try {
    const res = await fetch(`${getApiUrl()}/api/listing/${encodeURIComponent(id)}`, {
      signal: AbortSignal.timeout(3000),
      next: { revalidate: 300 },
    });
    if (!res.ok) return fallback;
    const data = (await res.json()) as { listing?: ListingMeta };
    const listing = data.listing;
    if (!listing) return fallback;

    const title = listing.title?.trim() || "Listing";
    const priceHbar = formatPriceForDisplay(listing.price || "0");
    const priceBit = priceHbar !== "0" ? `${priceHbar} ℏ — ` : "";
    const description = (
      listing.description?.trim() ||
      listing.subtitle?.trim() ||
      `${priceBit}Buy ${title} on Hashpop, the escrow-protected marketplace on Hedera.`
    ).slice(0, 300);
    const image = listing.mediaUrls?.[0] ?? listing.imageUrl ?? null;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: "website",
        ...(image ? { images: [{ url: image }] } : {}),
      },
      twitter: {
        card: image ? "summary_large_image" : "summary",
        title,
        description,
        ...(image ? { images: [image] } : {}),
      },
    };
  } catch {
    return fallback;
  }
}

export default function ListingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
