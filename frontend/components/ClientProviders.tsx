"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { HashpackWalletProvider } from "../lib/hashpackWallet";
import { HashPackConfirmProvider } from "../lib/hashpackConfirm";
import { SignInModalProvider } from "../lib/signInModal";
import { Footer } from "./Footer";
import { BottomNav } from "./BottomNav";
import { WalletAccountSync } from "./WalletAccountSync";
import { AppSidebar } from "./AppSidebar";
import { DesktopShell } from "./DesktopShell";

const qc = new QueryClient();

export function ClientProviders({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const isFullscreenRoute = isHome;

  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <HashpackWalletProvider>
      <QueryClientProvider client={qc}>
        <HashPackConfirmProvider>
          <SignInModalProvider>
            <WalletAccountSync />
            {isFullscreenRoute ? (
              <div className="flex h-screen flex-col overflow-hidden">{children}</div>
            ) : (
              <>
                <DesktopShell>
                  {children}
                  <Footer />
                </DesktopShell>
                {/* Mobile-only nav chrome. AppSidebar provides the slide-out
                    drawer; BottomNav renders the floating top bar with a
                    hamburger. Both are no-ops on desktop via md:hidden. */}
                <div className="md:hidden">
                  <AppSidebar open={sidebarOpen} setOpen={setSidebarOpen} />
                  <BottomNav showMenu onMenuClick={() => setSidebarOpen(true)} />
                </div>
              </>
            )}
          </SignInModalProvider>
        </HashPackConfirmProvider>
      </QueryClientProvider>
    </HashpackWalletProvider>
  );
}
