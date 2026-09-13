import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Messages",
  description: "Encrypted wallet-to-wallet conversations.",
  robots: { index: false, follow: false },
};

export default function SegmentLayout({ children }: { children: React.ReactNode }) {
  return children;
}
