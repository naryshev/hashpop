"use client";

import { useState } from "react";
import { useWriteContract } from "wagmi";
import { parseEther } from "viem";
import { auctionHouseAbi, auctionHouseAddress } from "../lib/contracts";
import {
  auctionIdToBytes32,
  placeBidMessageHash,
  defaultDeadline,
  relayPlaceBid,
  fetchAccountAlias,
} from "../lib/ed25519Relay";

export function BidPanel({ auctionId }: { auctionId: string }) {
  const [amount, setAmount] = useState("0.1");
  const { writeContract, isPending, error } = useWriteContract();

  const [ed25519Open, setEd25519Open] = useState(false);
  const [accountIdOrAlias, setAccountIdOrAlias] = useState("");
  const [signature, setSignature] = useState("");
  const [ed25519Status, setEd25519Status] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [ed25519Error, setEd25519Error] = useState("");

  const submit = () => {
    const idBytes = formatId(auctionId);
    writeContract({
      address: auctionHouseAddress,
      abi: auctionHouseAbi,
      functionName: "placeBid",
      args: [idBytes],
      value: parseEther(amount),
    });
  };

  const bidAmountWei = parseEther(amount);
  const idBytes = auctionIdToBytes32(auctionId);
  const deadline = defaultDeadline();
  const messageHash = placeBidMessageHash(idBytes, bidAmountWei, deadline);

  const resolveAlias = async (): Promise<`0x${string}` | null> => {
    const s = accountIdOrAlias.trim();
    if (!s) return null;
    if (s.startsWith("0x") && s.length === 42) return s as `0x${string}`;
    if (/^0\.0\.\d+$/.test(s)) return fetchAccountAlias(s);
    return null;
  };

  const placeBidWithED25519 = async () => {
    setEd25519Status("loading");
    setEd25519Error("");
    try {
      const bidderAlias = await resolveAlias();
      if (!bidderAlias) {
        setEd25519Error("Enter Hedera account ID (0.0.XXXXX) or EVM alias (0x...).");
        setEd25519Status("error");
        return;
      }
      const sig = signature.trim().startsWith("0x") ? signature.trim() : `0x${signature.trim()}`;
      if (sig.length < 130) {
        setEd25519Error("Paste the full ED25519 signature (0x + 128 hex chars).");
        setEd25519Status("error");
        return;
      }
      await relayPlaceBid({
        auctionId: idBytes,
        bidderAlias,
        bidAmountWei: bidAmountWei.toString(),
        deadline,
        messageHash,
        signature: sig as `0x${string}`,
      });
      setEd25519Status("success");
    } catch (e) {
      setEd25519Error(e instanceof Error ? e.message : "Relay failed");
      setEd25519Status("error");
    }
  };

  return (
    <div className="glass-card p-4 space-y-3">
      <h3 className="text-lg font-semibold text-white">Place Bid</h3>
      <label className="block">
        <span className="text-sm text-silver">Amount (HBAR)</span>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="input-frost mt-1 w-full"
        />
      </label>
      <button
        onClick={submit}
        disabled={isPending}
        className="btn-frost-cta w-full disabled:opacity-60"
      >
        {isPending ? "Submitting..." : "Place Bid (ECDSA)"}
      </button>
      {error && <p className="text-sm text-rose-400">{error.message}</p>}

      <div>
        <button
          type="button"
          onClick={() => setEd25519Open((o) => !o)}
          className="text-sm text-chrome hover:text-white underline"
        >
          {ed25519Open ? "Hide" : "Use ED25519 account"}
        </button>
        {ed25519Open && (
          <div className="mt-3 p-3 rounded-lg bg-white/5 border border-white/10 space-y-2">
            <input
              type="text"
              placeholder="Account ID (0.0.XXXXX) or EVM alias (0x...)"
              value={accountIdOrAlias}
              onChange={(e) => setAccountIdOrAlias(e.target.value)}
              className="w-full px-3 py-2 rounded bg-black/40 border border-white/20 text-white text-sm"
            />
            <p className="text-xs text-silver break-all">Sign in HashPack: <code className="text-chrome">{messageHash}</code></p>
            <input
              type="text"
              placeholder="Signature (0x...)"
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              className="w-full px-3 py-2 rounded bg-black/40 border border-white/20 text-white text-sm"
            />
            {ed25519Error && <p className="text-xs text-red-400">{ed25519Error}</p>}
            {ed25519Status === "success" && <p className="text-xs text-green-400">Bid submitted.</p>}
            <button
              type="button"
              onClick={placeBidWithED25519}
              disabled={ed25519Status === "loading"}
              className="btn-frost w-full text-sm py-2 disabled:opacity-60"
            >
              {ed25519Status === "loading" ? "Submitting…" : "Submit (ED25519)"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function formatId(id: string): `0x${string}` {
  const hex = Buffer.from(id).toString("hex").padEnd(64, "0").slice(0, 64);
  return `0x${hex}` as `0x${string}`;
}
