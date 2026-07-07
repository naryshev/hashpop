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
  themeColor: "#0b111b",
};

// Runs before hydration: surfaces fatal boot errors on the splash so failures
// in webviews without devtools (e.g. wallet dapp browsers) are screenshotable.
const BOOT_ERROR_CATCHER = `
(function () {
  function show(msg) {
    try {
      var el = document.getElementById("hp-boot-error");
      if (!el) return;
      el.textContent = String(msg || "Unknown boot error").slice(0, 600);
      el.classList.remove("hidden");
    } catch (e) {}
  }
  window.addEventListener("error", function (e) {
    show(e && (e.message || (e.error && e.error.message)));
  });
  window.addEventListener("unhandledrejection", function (e) {
    show(e && e.reason && (e.reason.message || e.reason));
  });
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: BOOT_ERROR_CATCHER }} />
        <BootSplash />
        <ClientProviders>{children}</ClientProviders>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
