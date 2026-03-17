"use client";

import { useState, useMemo } from "react";
import { parseEther } from "viem";
import { auctionHouseAbi, auctionHouseAddress } from "../lib/contracts";
import { getTransactionErrorMessage } from "../lib/transactionError";
import { auctionIdToBytes32, placeBidMessageHash, defaultDeadline, relayPlaceBid, signHashWithHashpack } from "../lib/ed25519Relay";
import { useRobustContractWrite } from "../hooks/useRobustContractWrite";
import { useHashpackWallet } from "../lib/hashpackWallet";
import { activeHederaChain } from "../lib/hederaChains";

export function BidPanel({ auctionId }: { auctionId: string }) {
  const [amount, setAmount] = useState("0.1");
  const idBytes = useMemo(() => auctionIdToBytes32(auctionId), [auctionId]);
  let bidAmountWei = 0n;
  try {
    bidAmountWei = parseEther(amount || "0");
  } catch {
    bidAmountWei = 0n;
  }

  const { hashconnect, address, accountId } = useHashpackWallet();
  const chainId = activeHederaChain.id;
  const isWrongNetwork = false;

  const { send, isPending, error: writeError } = useRobustContractWrite();
  const isConfirming = false;
  const isSuccess = false;
  const displayError = writeError;
  const errorMessage = getTransactionErrorMessage(displayError, { chainId });

  const [ed25519Open, setEd25519Open] = useState(false);
  const [ed25519Status, setEd25519Status] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [ed25519Error, setEd25519Error] = useState("");

  const submit = async () => {
    await send({
        address: auctionHouseAddress,
        abi: auctionHouseAbi,
        functionName: "placeBid",
        args: [idBytes],
        value: bidAmountWei,
      });
  };
  const deadline = defaultDeadline();
  const messageHash = placeBidMessageHash(idBytes, bidAmountWei, deadline);

  const placeBidWithED25519 = async () => {
    setEd25519Status("loading");
    setEd25519Error("");
    try {
      if (!hashconnect || !accountId || !address) {
        setEd25519Error("Connect HashPack first.");
        setEd25519Status("error");
        return;
      }
      // address from wallet context is already the EVM alias (or long-zero fallback).
      const sig = await signHashWithHashpack(hashconnect, accountId, messageHash);
      await relayPlaceBid({
        auctionId: idBytes,
        bidderAlias: address,
        bidAmountWei: bidAmountWei.toString(),
        deadline,
        messageHash,
        signature: sig,
      });
      setEd25519Status("success");
    } catch (e) {
      setEd25519Error(e instanceof Error ? e.message : "Relay failed");
      setEd25519Status("error");
    }
  };

  const canBid = bidAmountWei > 0n && !isWrongNetwork;

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
      <p className="text-sm text-silver">
        {canBid ? `You will send ${amount} HBAR. Confirm in your wallet.` : "Enter a valid amount (e.g. 0.1)."}
      </p>
      <button
        onClick={() => void submit()}
        disabled={!canBid || isPending || isConfirming}
        className="btn-frost-cta w-full disabled:opacity-60"
      >
        {isPending ? "Confirm in wallet…" : isConfirming ? "Processing…" : isSuccess ? "Bid placed!" : "Place Bid"}
      </button>
      {errorMessage && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2">
          <p className="text-sm text-red-300/90 break-words">{errorMessage}</p>
        </div>
      )}

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
            <p className="text-xs text-silver">
              Signs the bid via your connected HashPack and submits it through the relay.
              HashPack will open a signing prompt — no copy-pasting required.
            </p>
            {!accountId && (
              <p className="text-xs text-yellow-400">Connect HashPack above first.</p>
            )}
            {ed25519Error && <p className="text-xs text-red-400">{ed25519Error}</p>}
            {ed25519Status === "success" && <p className="text-xs text-green-400">Bid submitted.</p>}
            <button
              type="button"
              onClick={() => void placeBidWithED25519()}
              disabled={!accountId || !canBid || ed25519Status === "loading"}
              className="btn-frost w-full text-sm py-2 disabled:opacity-60"
            >
              {ed25519Status === "loading" ? "Signing…" : "Sign & Submit (ED25519)"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
