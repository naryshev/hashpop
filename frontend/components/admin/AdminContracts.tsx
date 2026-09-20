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
import { material } from "../../lib/materials";

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
      setStatus(`Paused. Tx: ${txId}`);
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
      setStatus(`Unpaused. Tx: ${txId}`);
      setPaused(false);
    } catch (e) {
      setStatus(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <div className={`${material.regular} space-y-3 rounded-[14px] p-5`}>
      <div className="flex items-center gap-3">
        <span className="w-28 text-sm text-silver">{contract.label}</span>
        {paused === null ? (
          <span className="text-sm text-silver">loading…</span>
        ) : paused ? (
          <span className="text-sm font-semibold text-danger">Paused</span>
        ) : (
          <span className="text-sm font-semibold text-[#00ffa3]">Active</span>
        )}
      </div>

      {paused === false && (
        <button
          type="button"
          onClick={() => void handlePause()}
          disabled={isPending}
          className="w-full rounded-[14px] border border-danger/50 bg-danger/10 px-4 py-2 text-sm font-semibold text-danger disabled:opacity-60"
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
          className={`break-all text-sm ${status.startsWith("Error") ? "text-danger" : "text-[#00ffa3]"}`}
        >
          {status}
        </p>
      )}
    </div>
  );
}

export function AdminContracts() {
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h2 className="text-sm font-semibold text-white">Contracts</h2>
      {CONTRACTS.map((c) => (
        <ContractRow key={`${c.label}-${c.address}`} contract={c} />
      ))}
    </div>
  );
}
