import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Marketplace",
  description: "Browse verifiable listings on the Hashgraph — buy physical and digital goods with HBAR, protected by on-chain escrow.",
};

export default function SegmentLayout({ children }: { children: React.ReactNode }) {
  return children;
}
