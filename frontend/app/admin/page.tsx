"use client";

import { useEffect, useState } from "react";
import { useHashpackWallet } from "../../lib/hashpackWallet";
import { useRobustContractWrite } from "../../hooks/useRobustContractWrite";
import { marketplaceAddress, marketplaceAdminAbi } from "../../lib/contracts";
import { hederaPublicClient } from "../../lib/hederaPublicClient";
import { ConnectWalletButton } from "../../components/ConnectWalletButton";

export default function AdminPage() {
  const { address, isConnected } = useHashpackWallet();
  const { send, isPending } = useRobustContractWrite();
  const [paused, setPaused] = useState<boolean | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (marketplaceAddress === "0x0000000000000000000000000000000000000000") return;
    hederaPublicClient
      .readContract({ address: marketplaceAddress, abi: marketplaceAdminAbi, functionName: "paused" })
      .then((v) => setPaused(v as boolean))
      .catch(() => setPaused(null));
  }, []);

  const handleUnpause = async () => {
    setStatus(null);
    try {
      const txId = await send({ address: marketplaceAddress, abi: marketplaceAdminAbi, functionName: "unpause" });
      setStatus(`✓ Unpaused. Tx: ${txId}`);
      setPaused(false);
    } catch (e) {
      setStatus(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <main className="min-h-screen">
      <div className="max-w-lg mx-auto px-4 py-12 space-y-6">
        <h1 className="text-xl font-bold text-white">Contract Admin</h1>

        {!isConnected ? (
          <ConnectWalletButton className="btn-frost-cta w-full" />
        ) : (
          <div className="glass-card p-6 space-y-4">
            <p className="text-sm text-silver">Connected: <span className="text-chrome font-mono">{address}</span></p>

            <div className="flex items-center gap-3">
              <span className="text-sm text-silver">Marketplace status:</span>
              {paused === null ? (
                <span className="text-silver text-sm">loading…</span>
              ) : paused ? (
                <span className="text-rose-400 font-semibold">PAUSED</span>
              ) : (
                <span className="text-emerald-400 font-semibold">ACTIVE</span>
              )}
            </div>

            {paused === true && (
              <button
                onClick={handleUnpause}
                disabled={isPending}
                className="btn-frost-cta w-full disabled:opacity-60"
              >
                {isPending ? "Confirm in wallet…" : "Unpause Marketplace"}
              </button>
            )}

            {paused === false && (
              <p className="text-emerald-400 text-sm">Contract is active — no action needed.</p>
            )}

            {status && (
              <p className={`text-sm break-all ${status.startsWith("✓") ? "text-emerald-400" : "text-rose-400"}`}>
                {status}
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
