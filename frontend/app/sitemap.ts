import type { MetadataRoute } from "next";
import { getApiUrl } from "../lib/apiUrl";
import { encodeListingIdForUrl } from "../lib/listingUrl";

const BASE_URL = "https://hashpop.io";

// Regenerate at most hourly — listings churn, but crawlers don't need
// real-time freshness.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/marketplace`, lastModified: now, changeFrequency: "hourly", priority: 1 },
    { url: `${BASE_URL}/categories`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE_URL}/create`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE_URL}/support`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${BASE_URL}/help`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${BASE_URL}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${BASE_URL}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ];

  // Active listings — best effort; a slow or down API must never break the
  // sitemap, so fall back to the static pages alone.
  try {
    const res = await fetch(`${getApiUrl()}/api/listings`, {
      signal: AbortSignal.timeout(3500),
      next: { revalidate: 3600 },
    });
    if (!res.ok) return staticEntries;
    const data = (await res.json()) as {
      listings?: { id: string; status?: string; createdAt?: string }[];
    };
    const listingEntries: MetadataRoute.Sitemap = (data.listings ?? [])
      .filter((l) => (l.status || "").toUpperCase() === "LISTED")
      .slice(0, 5000)
      .map((l) => ({
        url: `${BASE_URL}/listing/${encodeListingIdForUrl(l.id)}`,
        lastModified: l.createdAt ? new Date(l.createdAt) : now,
        changeFrequency: "daily" as const,
        priority: 0.8,
      }));
    return [...staticEntries, ...listingEntries];
  } catch {
    return staticEntries;
  }
}
