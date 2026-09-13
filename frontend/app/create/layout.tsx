import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create Listing",
  description: "List an item for sale on Hashpop — on-chain, escrow-protected, paid in HBAR.",
};

export default function SegmentLayout({ children }: { children: React.ReactNode }) {
  return children;
}
