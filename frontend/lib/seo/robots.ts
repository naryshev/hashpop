import type { MetadataRoute } from "next";
import { CANONICAL_ORIGIN } from "./host";

/**
 * Public prefixes. `/listing/` and `/profile/` are prefix allows so dynamic
 * ids stay crawlable. OG/Twitter images live at `/opengraph-image.png` and
 * `/twitter-image.png`, not under `/api/`.
 */
export const ROBOTS_ALLOW = [
  "/",
  "/marketplace",
  "/categories",
  "/listing/",
  "/privacy",
  "/terms",
  "/profile/",
] as const;

/** Research checklist. Other account tools are noindexed in middleware. */
export const ROBOTS_DISALLOW = [
  "/messages",
  "/cart",
  "/create",
  "/dashboard",
  "/admin",
  "/api/",
] as const;

export function buildRobots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: [...ROBOTS_ALLOW],
      disallow: [...ROBOTS_DISALLOW],
    },
    sitemap: `${CANONICAL_ORIGIN}/sitemap.xml`,
    host: CANONICAL_ORIGIN,
  };
}
