import "./globals.css";
import { ClientProviders } from "../components/ClientProviders";
import { SpeedInsights } from "@vercel/speed-insights/next";

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
        <ClientProviders>{children}</ClientProviders>
        <SpeedInsights />
      </body>
    </html>
  );
}
