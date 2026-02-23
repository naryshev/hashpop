"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashpackWalletProvider } from "../lib/hashpackWallet";
import { HomeHeader } from "./HomeHeader";
import { Footer } from "./Footer";
import { BottomNav } from "./BottomNav";
import { WalletAccountSync } from "./WalletAccountSync";

const qc = new QueryClient();

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <HashpackWalletProvider>
      <QueryClientProvider client={qc}>
        <WalletAccountSync />
        <HomeHeader />
        <div className="min-h-screen pb-20 md:pb-0 flex flex-col">
          {children}
          <Footer />
        </div>
        <BottomNav />
      </QueryClientProvider>
    </HashpackWalletProvider>
  );
}
