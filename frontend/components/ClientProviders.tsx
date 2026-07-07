"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashpackWalletProvider } from "../lib/hashpackWallet";
import { HashPackConfirmProvider } from "../lib/hashpackConfirm";
import { SignInModalProvider } from "../lib/signInModal";
import { ProfilesProvider } from "../lib/profiles";
import { TopBarProvider } from "../lib/topBar";
import { BottomNav } from "./BottomNav";
import { WalletAccountSync } from "./WalletAccountSync";
import { DesktopShell } from "./DesktopShell";
import { PwaInstallPrompt } from "./PwaInstallPrompt";

const qc = new QueryClient();

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <HashpackWalletProvider>
      <QueryClientProvider client={qc}>
        <HashPackConfirmProvider>
          <SignInModalProvider>
            <ProfilesProvider>
            <TopBarProvider>
              <WalletAccountSync />
              <DesktopShell>{children}</DesktopShell>
              {/* Mobile floating nav; desktop nav lives in DesktopShell. */}
              <BottomNav />
              <PwaInstallPrompt />
            </TopBarProvider>
            </ProfilesProvider>
          </SignInModalProvider>
        </HashPackConfirmProvider>
      </QueryClientProvider>
    </HashpackWalletProvider>
  );
}
