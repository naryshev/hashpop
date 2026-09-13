import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Purchases & Sales",
  description: "Track your Hashpop orders, shipping, and escrow releases.",
  robots: { index: false, follow: false },
};

export default function SegmentLayout({ children }: { children: React.ReactNode }) {
  return children;
}
