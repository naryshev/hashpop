import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "My Hashpop",
  description: "Your Hashpop dashboard.",
  robots: { index: false, follow: false },
};

export default function SegmentLayout({ children }: { children: React.ReactNode }) {
  return children;
}
