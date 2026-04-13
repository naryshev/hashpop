"use client";

import { useHashpackWallet } from "../../lib/hashpackWallet";
import { ConnectWalletButton } from "../../components/ConnectWalletButton";

export default function OffersPage() {
  const { address } = useHashpackWallet();

  return (
    <main className="min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <h1 className="text-xl sm:text-2xl font-bold text-white">Bids & Offers</h1>
        {!address ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-silver">Connect your wallet to view offers.</p>
            <ConnectWalletButton className="btn-frost-cta disabled:opacity-50" />
          </div>
        ) : (
          <div className="glass-card rounded-xl p-6">
            <p className="text-white font-medium">No offers yet.</p>
            <p className="text-silver text-sm mt-2">
              This page is now a dedicated destination and will show wallet-specific bids and offers
              as they are created.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
