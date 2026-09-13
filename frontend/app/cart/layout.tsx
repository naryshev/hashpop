import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cart",
  description: "Your Hashpop cart.",
  robots: { index: false, follow: false },
};

export default function SegmentLayout({ children }: { children: React.ReactNode }) {
  return children;
}
