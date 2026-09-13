import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Profile",
  description: "Seller profile, listings, and ratings on Hashpop.",
};

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return children;
}
