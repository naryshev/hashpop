import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Area 51",
  description: "Experiments.",
  robots: { index: false, follow: false },
};

export default function SegmentLayout({ children }: { children: React.ReactNode }) {
  return children;
}
