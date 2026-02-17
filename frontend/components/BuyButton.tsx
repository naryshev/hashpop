"use client";

import { useState } from "react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther } from "viem";
import { marketplaceAbi, marketplaceAddress } from "../lib/contracts";
import {
  listingIdToBytes32,
  buyNowMessageHash,
  defaultDeadline,
  relayBuy,
  fetchAccountAlias,
} from "../lib/ed25519Relay";

function toBytes32(listingId: string): `0x${string}` {
  if (listingId.startsWith("0x") && listingId.length === 66) return listingId as `0x${string}`;
  const hex = Array.from(new TextEncoder().encode(listingId))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `0x${hex.padEnd(64, "0").slice(0, 64)}` as `0x${string}`;
}

export function BuyButton({ listingId, price }: { listingId: string; price: string }) {
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const [ed25519Open, setEd25519Open] = useState(false);
  const [accountIdOrAlias, setAccountIdOrAlias] = useState("");
  const [signature, setSignature] = useState("");
  const [ed25519Status, setEd25519Status] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [ed25519Error, setEd25519Error] = useState("");

  const buy = () => {
    const idBytes = toBytes32(listingId);
    writeContract({
      address: marketplaceAddress,
      abi: marketplaceAbi,
      functionName: "buyNow",
      args: [idBytes],
      value: parseEther(price),
    });
  };

  const priceWei = parseEther(price);
  const idBytes = listingIdToBytes32(listingId);
  const deadline = defaultDeadline();
  const messageHash = buyNowMessageHash(idBytes, priceWei, deadline);

  const resolveAlias = async (): Promise<`0x${string}` | null> => {
    const s = accountIdOrAlias.trim();
    if (!s) return null;
    if (s.startsWith("0x") && s.length === 42) return s as `0x${string}`;
    if (/^0\.0\.\d+$/.test(s)) return fetchAccountAlias(s);
    return null;
  };

  const buyWithED25519 = async () => {
    setEd25519Status("loading");
    setEd25519Error("");
    try {
      const buyerAlias = await resolveAlias();
      if (!buyerAlias) {
        setEd25519Error("Enter a Hedera account ID (0.0.XXXXX) or EVM alias (0x...).");
        setEd25519Status("error");
        return;
      }
      const sig = signature.trim().startsWith("0x") ? signature.trim() : `0x${signature.trim()}`;
      if (sig.length < 130) {
        setEd25519Error("Paste the full ED25519 signature (0x + 128 hex chars).");
        setEd25519Status("error");
        return;
      }
      await relayBuy({
        listingId: idBytes,
        buyerAlias,
        priceWei: priceWei.toString(),
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
    <div className="glass-card p-4 space-y-4">
      <h3 className="text-lg font-semibold text-white mb-2">Buy Now</h3>
      <p className="text-2xl font-bold text-chrome mb-4">{price} HBAR</p>
      <button
        onClick={buy}
        disabled={isPending || isConfirming}
        className="btn-frost-cta w-full disabled:opacity-60"
      >
        {isPending ? "Confirming..." : isConfirming ? "Processing..." : isSuccess ? "Purchased!" : "Buy Now (ECDSA)"}
      </button>

      <div>
        <button
          type="button"
          onClick={() => setEd25519Open((o) => !o)}
          className="text-sm text-chrome hover:text-white underline"
        >
          {ed25519Open ? "Hide" : "Use ED25519 account (HashPack)"}
        </button>
        {ed25519Open && (
          <div className="mt-3 p-3 rounded-lg bg-white/5 border border-white/10 space-y-2">
            <p className="text-xs text-silver">
              Sign the message in HashPack (ED25519), then paste the signature. Relayer submits the tx.
            </p>
            <input
              type="text"
              placeholder="Account ID (0.0.XXXXX) or EVM alias (0x...)"
              value={accountIdOrAlias}
              onChange={(e) => setAccountIdOrAlias(e.target.value)}
              className="w-full px-3 py-2 rounded bg-black/40 border border-white/20 text-white text-sm placeholder:text-silver"
            />
            <p className="text-xs text-silver break-all">
              Message hash to sign: <code className="text-chrome">{messageHash}</code>
            </p>
            <input
              type="text"
              placeholder="Signature (0x...)"
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              className="w-full px-3 py-2 rounded bg-black/40 border border-white/20 text-white text-sm placeholder:text-silver"
            />
            {ed25519Error && <p className="text-xs text-red-400">{ed25519Error}</p>}
            {ed25519Status === "success" && <p className="text-xs text-green-400">Purchase submitted.</p>}
            <button
              type="button"
              onClick={buyWithED25519}
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
