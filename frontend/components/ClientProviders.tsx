"use client";

import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { config } from "../lib/wagmiConfig";
import { HashpackWalletProvider } from "../lib/hashpackWallet";
import { HomeHeader } from "./HomeHeader";
import { Footer } from "./Footer";
import { BottomNav } from "./BottomNav";
import { WalletAccountSync } from "./WalletAccountSync";

const qc = new QueryClient();

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
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
    </WagmiProvider>
  );
}
