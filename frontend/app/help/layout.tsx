import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Help Center · Hashpop",
  description:
    "Hashpop help center: how escrow works, what HBAR is, connecting HashPack, disputes, returns and more.",
  openGraph: {
    title: "Help Center · Hashpop",
    description: "Answers to common questions about escrow, HBAR, HashPack and disputes.",
    type: "website",
  },
};

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return children;
}
