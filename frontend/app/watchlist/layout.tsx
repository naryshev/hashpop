import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Watchlist",
  description: "Listings you're watching.",
  robots: { index: false, follow: false },
};

export default function SegmentLayout({ children }: { children: React.ReactNode }) {
  return children;
}
