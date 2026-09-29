import { SEO_COPY } from "./copy";

export const CANONICAL_ORIGIN = SEO_COPY.canonicalOrigin;
export const CANONICAL_HOST = "hashpop.io";
export const WWW_HOST = "www.hashpop.io";

/**
 * Paths that must not be indexed: admin, wallet-gated account tools, and
 * app API routes. Public marketplace, listing, help, and policy pages stay
 * crawlable.
 */
export const PRIVATE_PATH_PREFIXES = [
  "/admin",
  "/area51",
  "/api",
  "/dashboard",
  "/messages",
  "/activity",
  "/selling",
  "/purchases",
  "/watchlist",
  "/cart",
  "/create",
  "/offers",
  "/purchase-success",
] as const;

export function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${CANONICAL_ORIGIN}${normalized}`;
}

/** First host, lowercased, without a trailing port. */
export function requestHost(hostHeader: string | null | undefined): string {
  const first = (hostHeader ?? "").split(",")[0]?.trim().toLowerCase() ?? "";
  return first.replace(/:\d+$/, "");
}

/**
 * Production www → apex redirect target.
 * Returns null for the apex host, preview deployments, and local dev so
 * `*.vercel.app` previews keep working.
 */
export function apexRedirectUrl(
  hostHeader: string | null | undefined,
  pathname: string,
  search = "",
): string | null {
  if (requestHost(hostHeader) !== WWW_HOST) return null;
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const query = search ? (search.startsWith("?") ? search : `?${search}`) : "";
  return `${CANONICAL_ORIGIN}${path}${query}`;
}

export function isNoIndexPath(pathname: string): boolean {
  return PRIVATE_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
