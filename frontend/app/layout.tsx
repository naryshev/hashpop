import "./globals.css";
import { ClientProviders } from "../components/ClientProviders";
import { BootSplash } from "../components/BootSplash";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Hashpop",
  description: "Buy and sell on the Hedera network with Hashpop - The community marketplace.",
  icons: {
    icon: "/hashpop-cart-3d.PNG",
    shortcut: "/hashpop-cart-3d.PNG",
    apple: "/hashpop-cart-3d.PNG",
  },
  manifest: "/manifest.json",
  metadataBase: new URL("https://hashpop.io"),
  openGraph: {
    type: "website",
    siteName: "Hashpop",
    title: "Hashpop",
    description: "Buy and sell on the Hedera network with Hashpop - The community marketplace.",
    url: "https://hashpop.io",
  },
  twitter: {
    card: "summary_large_image",
    site: "@hashpop",
    creator: "@hashpop",
    title: "Hashpop",
    description: "Buy and sell on the Hedera network with Hashpop - The community marketplace.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  // Resize the layout (and dvh units) when the on-screen keyboard opens, so
  // chat composers ride up with the keyboard and slide back down when it
  // closes instead of leaving the page scrolled/stuck.
  interactiveWidget: "resizes-content",
  themeColor: "#0b111b",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <BootSplash />
        <ClientProviders>{children}</ClientProviders>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
