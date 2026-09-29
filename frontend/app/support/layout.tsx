import type { Metadata } from "next";
import { SEO_COPY } from "../../lib/seo/copy";
import { staticPageMetadata } from "../../lib/seo/metadata";

export const metadata: Metadata = staticPageMetadata({
  title: SEO_COPY.supportTitle,
  description: SEO_COPY.supportDescription,
  path: "/support",
});

export default function SupportLayout({ children }: { children: React.ReactNode }) {
  return children;
}
