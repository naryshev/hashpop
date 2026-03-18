"use client";

import { useEffect, useState } from "react";
import { useHashpackWallet } from "../../lib/hashpackWallet";
import { useRobustContractWrite } from "../../hooks/useRobustContractWrite";
import {
  pausableAdminAbi,
  marketplaceAddress,
  auctionHouseAddress,
  escrowAddress,
} from "../../lib/contracts";
import { hederaPublicClient } from "../../lib/hederaPublicClient";
import { ConnectWalletButton } from "../../components/ConnectWalletButton";

type ContractInfo = {
  label: string;
  address: `0x${string}`;
};

const CONTRACTS: ContractInfo[] = [
  { label: "Marketplace", address: marketplaceAddress },
  { label: "AuctionHouse", address: auctionHouseAddress },
  { label: "Escrow", address: escrowAddress },
];

function ContractRow({ contract }: { contract: ContractInfo }) {
  const { send, isPending } = useRobustContractWrite();
  const [paused, setPaused] = useState<boolean | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (contract.address === "0x0000000000000000000000000000000000000000") return;
    hederaPublicClient
      .readContract({ address: contract.address, abi: pausableAdminAbi, functionName: "paused" })
      .then((v) => setPaused(v as boolean))
      .catch(() => setPaused(null));
  }, [contract.address]);

  const handleUnpause = async () => {
    setStatus(null);
    try {
      const txId = await send({ address: contract.address, abi: pausableAdminAbi, functionName: "unpause" });
      setStatus(`✓ Unpaused. Tx: ${txId}`);
      setPaused(false);
    } catch (e) {
      setStatus(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <div className="glass-card p-6 space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-sm text-silver w-28">{contract.label}:</span>
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
          {isPending ? "Confirm in wallet…" : `Unpause ${contract.label}`}
        </button>
      )}

      {status && (
        <p className={`text-sm break-all ${status.startsWith("✓") ? "text-emerald-400" : "text-rose-400"}`}>
          {status}
        </p>
      )}
    </div>
  );
}

export default function AdminPage() {
  const { address, isConnected } = useHashpackWallet();

  return (
    <main className="min-h-screen">
      <div className="max-w-lg mx-auto px-4 py-12 space-y-6">
        <h1 className="text-xl font-bold text-white">Contract Admin</h1>

        {!isConnected ? (
          <ConnectWalletButton className="btn-frost-cta w-full" />
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-silver">
              Connected: <span className="text-chrome font-mono">{address}</span>
            </p>
            {CONTRACTS.map((c) => (
              <ContractRow key={c.address} contract={c} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
