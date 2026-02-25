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

  return (
    <HashpackWalletProvider>
      <QueryClientProvider client={qc}>
        <WalletAccountSync />
        <HomeHeader />
        <div className={isHome ? "h-screen overflow-y-auto overflow-x-hidden flex flex-col md:overflow-hidden" : "min-h-screen pb-20 md:pb-0 flex flex-col"}>
          {children}
          {!isHome && <Footer />}
        </div>
        {!isHome && <BottomNav />}
      </QueryClientProvider>
    </HashpackWalletProvider>
  );
}
