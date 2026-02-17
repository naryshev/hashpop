"use client";

import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { config } from "../lib/wagmiConfig";
import { Nav } from "./Nav";
import { WalletAccountSync } from "./WalletAccountSync";

const qc = new QueryClient();

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={qc}>
        <WalletAccountSync />
        <Nav />
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
