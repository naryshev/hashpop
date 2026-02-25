"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { HashpackWalletProvider } from "../lib/hashpackWallet";
import { HomeHeader } from "./HomeHeader";
import { Footer } from "./Footer";
import { BottomNav } from "./BottomNav";
import { WalletAccountSync } from "./WalletAccountSync";

const qc = new QueryClient();

export function ClientProviders({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const isSignIn = pathname === "/signin";
  const isFullscreenRoute = isHome;

  return (
    <HashpackWalletProvider>
      <QueryClientProvider client={qc}>
        <WalletAccountSync />
        {!isSignIn && <HomeHeader />}
        <div className={isFullscreenRoute ? "h-screen overflow-hidden flex flex-col" : "min-h-screen pb-20 md:pb-0 flex flex-col"}>
          {children}
          {!isFullscreenRoute && !isSignIn && <Footer />}
        </div>
        {!isFullscreenRoute && <BottomNav />}
      </QueryClientProvider>
    </HashpackWalletProvider>
  );
}
