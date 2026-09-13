import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Selling",
  description: "Your active and past listings.",
  robots: { index: false, follow: false },
};

export default function SegmentLayout({ children }: { children: React.ReactNode }) {
  return children;
}
