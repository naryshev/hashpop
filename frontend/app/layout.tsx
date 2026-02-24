import "./globals.css";
import { ClientProviders } from "../components/ClientProviders";
import { SpeedInsights } from "@vercel/speed-insights/next";

export const metadata = {
  title: "Hashpop",
  description: "Hashpop marketplace on Hedera",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/favicon.png",
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
