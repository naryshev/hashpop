import "./globals.css";
import { ClientProviders } from "../components/ClientProviders";
import { SpeedInsights } from "@vercel/speed-insights/next";

export const metadata = {
  title: "Hashpop",
  description: "Hashpop marketplace on Hedera",
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
