import type { Metadata } from "next";
import { SEO_COPY } from "../../../lib/seo/copy";
import { staticPageMetadata } from "../../../lib/seo/metadata";

type ProfileLayoutProps = {
  params: { address: string };
  children: React.ReactNode;
};

export function generateMetadata({ params }: ProfileLayoutProps): Metadata {
  let address = params.address;
  try {
    address = decodeURIComponent(params.address);
  } catch {
    address = params.address;
  }
  return staticPageMetadata({
    title: SEO_COPY.profileTitle,
    description: SEO_COPY.profileDescription,
    path: `/profile/${encodeURIComponent(address)}`,
  });
}

/**
 * The Vercel preview toolbar is a draggable circle (a menu icon) injected on
 * preview deployments. It is not part of Hashpop. On /profile it was parked on
 * the right edge, clipped, and covering the grid. This rule is mounted only
 * with the profile layout, so the toolbar stays available on every other route.
 */
const HIDE_PREVIEW_TOOLBAR = "vercel-live-feedback{display:none !important}";

export default function ProfileLayout({ children }: ProfileLayoutProps) {
  return (
    <>
      <style>{HIDE_PREVIEW_TOOLBAR}</style>
      {children}
    </>
  );
}
