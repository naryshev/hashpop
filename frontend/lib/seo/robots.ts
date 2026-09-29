import type { MetadataRoute } from "next";
import { CANONICAL_ORIGIN, PRIVATE_PATH_PREFIXES } from "./host";

export { PRIVATE_PATH_PREFIXES };

/** Disallow prefixes for robots.txt. `/api` is written as `/api/`. */
export function robotsDisallowPaths(): string[] {
  return PRIVATE_PATH_PREFIXES.map((prefix) => (prefix === "/api" ? "/api/" : prefix));
}

export function buildRobots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: robotsDisallowPaths(),
    },
    sitemap: `${CANONICAL_ORIGIN}/sitemap.xml`,
    host: CANONICAL_ORIGIN,
  };
}
