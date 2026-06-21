"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { HashpackWalletProvider } from "../lib/hashpackWallet";
import { HashPackConfirmProvider } from "../lib/hashpackConfirm";
import { SignInModalProvider } from "../lib/signInModal";
import { ProfilesProvider } from "../lib/profiles";
import { TopBarProvider } from "../lib/topBar";
import { Footer } from "./Footer";
import { BottomNav } from "./BottomNav";
import { WalletAccountSync } from "./WalletAccountSync";
import { AppSidebar } from "./AppSidebar";
import { DesktopShell } from "./DesktopShell";

const qc = new QueryClient();

export function ClientProviders({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <HashpackWalletProvider>
      <QueryClientProvider client={qc}>
        <HashPackConfirmProvider>
          <SignInModalProvider>
            <ProfilesProvider>
            <TopBarProvider>
              <WalletAccountSync />
              <DesktopShell>
                {children}
                <Footer />
              </DesktopShell>
              {/* Mobile sidebar drawer stays mobile-only; the floating
                  BottomNav is shared across mobile and desktop. */}
              <div className="md:hidden">
                <AppSidebar open={sidebarOpen} setOpen={setSidebarOpen} />
              </div>
              <BottomNav />
            </TopBarProvider>
            </ProfilesProvider>
          </SignInModalProvider>
        </HashPackConfirmProvider>
      </QueryClientProvider>
    </HashpackWalletProvider>
  );
}
