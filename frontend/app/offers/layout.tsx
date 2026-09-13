import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Offers",
  description: "Offers you've made and received on Hashpop.",
  robots: { index: false, follow: false },
};

export default function SegmentLayout({ children }: { children: React.ReactNode }) {
  return children;
}
