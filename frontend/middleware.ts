import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { apexRedirectUrl, isNoIndexPath } from "./lib/seo/host";

/**
 * Canonical host is the apex `https://hashpop.io`.
 *
 * Requests whose host is exactly `www.hashpop.io` 301 to the apex URL with
 * path and query preserved. Any other host — including Vercel preview
 * deployments (`*.vercel.app`) and local dev — is not redirected.
 *
 * Ship also sets the same www → apex rule as a Vercel domain redirect so it
 * applies at the edge, including for static assets, before this middleware.
 * This handler is the application-level guarantee.
 */
export function middleware(request: NextRequest) {
  const host = request.headers.get("host") ?? request.headers.get("x-forwarded-host");
  const destination = apexRedirectUrl(host, request.nextUrl.pathname, request.nextUrl.search);
  if (destination) {
    return NextResponse.redirect(destination, 301);
  }

  const response = NextResponse.next();
  if (isNoIndexPath(request.nextUrl.pathname)) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
