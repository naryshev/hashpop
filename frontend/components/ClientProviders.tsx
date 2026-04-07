"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { HashpackWalletProvider } from "../lib/hashpackWallet";
import { Footer } from "./Footer";
import { BottomNav } from "./BottomNav";
import { WalletAccountSync } from "./WalletAccountSync";
import { AppSidebar } from "./AppSidebar";

const qc = new QueryClient();

export function ClientProviders({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const isSignIn = pathname === "/signin";
  const isFullscreenRoute = isHome;
  const useSidebarNav = !isHome && !isSignIn;

  return (
    <HashpackWalletProvider>
      <QueryClientProvider client={qc}>
        <WalletAccountSync />
        {useSidebarNav ? (
          <div className="min-h-screen pt-14 md:pt-0 flex flex-col md:flex-row">
            <AppSidebar />
            <div className="min-w-0 flex-1 flex flex-col">
              {children}
              <Footer />
            </div>
          </div>
        ) : (
          <div
            className={
              isFullscreenRoute
                ? "h-screen overflow-hidden flex flex-col"
                : "min-h-screen pt-14 md:pt-0 flex flex-col"
            }
          >
            {children}
            {!isFullscreenRoute && !isSignIn && <Footer />}
          </div>
        )}
        {!isFullscreenRoute && <BottomNav signInMode={isSignIn} />}
      </QueryClientProvider>
    </HashpackWalletProvider>
  );
}
