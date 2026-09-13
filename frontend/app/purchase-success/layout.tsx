import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Purchase Complete",
  description: "Funds locked in escrow.",
  robots: { index: false, follow: false },
};

export default function SegmentLayout({ children }: { children: React.ReactNode }) {
  return children;
}
