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

export default function ProfileLayout({ children }: ProfileLayoutProps) {
  return children;
}
