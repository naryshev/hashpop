"use client";

import { useEffect, useState } from "react";
import { useRobustContractWrite } from "../../hooks/useRobustContractWrite";
import {
  pausableAdminAbi,
  marketplaceAddress,
  auctionHouseAddress,
  escrowAddress,
} from "../../lib/contracts";
import { hederaPublicClient } from "../../lib/hederaPublicClient";

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

  const handlePause = async () => {
    if (!window.confirm(`Pause ${contract.label}? New listings and trades will halt.`)) return;
    setStatus(null);
    try {
      const txId = await send({
        address: contract.address,
        abi: pausableAdminAbi,
        functionName: "pause",
      });
      setStatus(`✓ Paused. Tx: ${txId}`);
      setPaused(true);
    } catch (e) {
      setStatus(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const handleUnpause = async () => {
    setStatus(null);
    try {
      const txId = await send({
        address: contract.address,
        abi: pausableAdminAbi,
        functionName: "unpause",
      });
      setStatus(`✓ Unpaused. Tx: ${txId}`);
      setPaused(false);
    } catch (e) {
      setStatus(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <div className="glass-card space-y-4 p-6">
      <div className="flex items-center gap-3">
        <span className="w-28 text-sm text-silver">{contract.label}:</span>
        {paused === null ? (
          <span className="text-sm text-silver">loading…</span>
        ) : paused ? (
          <span className="font-semibold text-rose-400">PAUSED</span>
        ) : (
          <span className="font-semibold text-emerald-400">ACTIVE</span>
        )}
      </div>

      {paused === false && (
        <button
          type="button"
          onClick={() => void handlePause()}
          disabled={isPending}
          className="w-full rounded-glass border border-rose-500/50 bg-rose-500/10 px-4 py-2 font-semibold text-rose-200 hover:bg-rose-500/20 disabled:opacity-60"
        >
          {isPending ? "Confirm in wallet…" : `Pause ${contract.label}`}
        </button>
      )}

      {paused === true && (
        <button
          type="button"
          onClick={() => void handleUnpause()}
          disabled={isPending}
          className="btn-frost-cta w-full disabled:opacity-60"
        >
          {isPending ? "Confirm in wallet…" : `Unpause ${contract.label}`}
        </button>
      )}

      {status && (
        <p
          className={`break-all text-sm ${status.startsWith("✓") ? "text-emerald-400" : "text-rose-400"}`}
        >
          {status}
        </p>
      )}
    </div>
  );
}

export function AdminContracts() {
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h2 className="text-xl font-extrabold text-white">Contracts</h2>
        <p className="text-xs text-silver">
          Pause or unpause Marketplace, AuctionHouse, and Escrow.
        </p>
      </div>
      {CONTRACTS.map((c) => (
        <ContractRow key={`${c.label}-${c.address}`} contract={c} />
      ))}
    </div>
  );
}
