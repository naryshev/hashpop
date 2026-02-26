import "./globals.css";
import { ClientProviders } from "../components/ClientProviders";
import { SpeedInsights } from "@vercel/speed-insights/next";
import Script from "next/script";

export const metadata = {
  title: "Hashpop",
  description: "Hashpop marketplace on Hedera",
  icons: {
    icon: "/hashpop-cart-3d.PNG",
    shortcut: "/hashpop-cart-3d.PNG",
    apple: "/hashpop-cart-3d.PNG",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Script
          id="hashpop-block-evm-injection"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (() => {
                const scrub = () => {
                  try { delete window.ethereum; } catch {}
                  try { delete window.web3; } catch {}
                  try { window.ethereum = undefined; } catch {}
                  try { window.web3 = undefined; } catch {}
                };
                scrub();
                window.addEventListener("eip6963:announceProvider", (event) => {
                  event.stopImmediatePropagation();
                }, true);
                window.addEventListener("eip6963:requestProvider", (event) => {
                  event.stopImmediatePropagation();
                }, true);
              })();
            `,
          }}
        />
        <ClientProviders>{children}</ClientProviders>
        <SpeedInsights />
      </body>
    </html>
  );
}
