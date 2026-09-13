import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Activity",
  description: "Sales, purchases, offers, messages, and reviews.",
  robots: { index: false, follow: false },
};

export default function SegmentLayout({ children }: { children: React.ReactNode }) {
  return children;
}
