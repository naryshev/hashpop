"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Interface } from "ethers";
import { useHashpackWallet } from "../lib/hashpackWallet";

type WriteRequest = {
  address: `0x${string}`;
  abi: readonly unknown[];
  functionName: string;
  args?: readonly unknown[];
  value?: bigint;
  gas?: number;
};

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;
const BACKOFF_MULTIPLIER = 2;
const DEFAULT_GAS_LIMIT = 1_200_000;
const WEI_PER_TINYBAR = 10_000_000_000n;

function isRetryableWalletError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("request expired") ||
    m.includes("session expired") ||
    m.includes("session not found") ||
    m.includes("missing or invalid") ||
    m.includes("network") ||
    m.includes("timeout") ||
    m.includes("connection")
  );
}

function calculateBackoffDelay(attempt: number): number {
  const delay = INITIAL_BACKOFF_MS * Math.pow(BACKOFF_MULTIPLIER, attempt);
  return Math.min(delay, MAX_BACKOFF_MS);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function encodeFunctionData(
  abi: readonly unknown[],
  functionName: string,
  args?: readonly unknown[],
): string {
  const iface = new Interface(abi as any);
  return iface.encodeFunctionData(functionName, (args ?? []) as any[]);
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (clean.length % 2 !== 0) {
    throw new Error("Invalid hex payload length.");
  }
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.slice(i, i + 2), 16);
  }
  return bytes;
}

function normalizePayableToTinybar(value: bigint): bigint {
  // Legacy callers may still pass wei-like amounts (1 HBAR = 1e18).
  // Current Hedera flows pass tinybar directly (1 HBAR = 1e8).
  const looksLikeWei = value >= 10n ** 15n && value % WEI_PER_TINYBAR === 0n;
  return looksLikeWei ? value / WEI_PER_TINYBAR : value;
}

function isZeroAddress(address: string): boolean {
  return /^0x0{40}$/i.test(address);
}

function pickSingleNodeAccountId(sdk: any, client: any, network: "mainnet" | "testnet") {
  const configuredNodes = client?.network ? Object.values(client.network) : [];
  for (const node of configuredNodes) {
    try {
      if (node && typeof node.toString === "function") {
        return sdk.AccountId.fromString(node.toString());
      }
      if (typeof node === "string") {
        return sdk.AccountId.fromString(node);
      }
    } catch {
      // try next
    }
  }
  // Conservative fallback if client network map is unavailable.
  return sdk.AccountId.fromString(network === "mainnet" ? "0.0.3" : "0.0.3");
}

class TransactionRevertError extends Error {
  constructor(
    public readonly hash: string,
    message?: string,
  ) {
    super(
      message ||
        `Transaction failed on-chain. Transaction ID: ${hash}. This may indicate insufficient funds or invalid parameters.`,
    );
    this.name = "TransactionRevertError";
  }
}

export function useHashpackContractWrite() {
  const { hashconnect, accountId, isConnected, refreshAccountData, network } = useHashpackWallet();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastHash, setLastHash] = useState<string | null>(null);
  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const safeSetPending = (value: boolean) => {
    if (mountedRef.current) setIsPending(value);
  };
  const safeSetError = (value: Error | null) => {
    if (mountedRef.current) setError(value);
  };
  const safeSetLastHash = (value: string) => {
    if (mountedRef.current) setLastHash(value);
  };

  const send = useCallback(
    async (request: WriteRequest): Promise<string> => {
      if (inFlightRef.current) {
        const inFlightError = new Error("A transaction is already pending confirmation.");
        safeSetError(inFlightError);
        throw inFlightError;
      }
      if (!hashconnect || !accountId || !isConnected) {
        const noClientError = new Error("Wallet is not connected. Connect HashPack first.");
        safeSetError(noClientError);
        throw noClientError;
      }
      if (
        !request.address ||
        !/^0x[0-9a-fA-F]{40}$/.test(request.address) ||
        isZeroAddress(request.address)
      ) {
        const addrError = new Error(
          "Contract address is not configured. Set deployed contract addresses in frontend/.env.local (NEXT_PUBLIC_MARKETPLACE_ADDRESS / NEXT_PUBLIC_AUCTION_HOUSE_ADDRESS / NEXT_PUBLIC_ESCROW_ADDRESS).",
        );
        safeSetError(addrError);
        throw addrError;
      }

      inFlightRef.current = true;
      safeSetPending(true);
      safeSetError(null);
      let lastError: Error | null = null;
      let txId: string | null = null;

      try {
        for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
          try {
            if (attempt > 0) await sleep(calculateBackoffDelay(attempt - 1));
            const sdk = await import("@hashgraph/sdk");
            const functionData = encodeFunctionData(
              request.abi,
              request.functionName,
              request.args,
            );
            const accountObj = sdk.AccountId.fromString(accountId);
            const txIdObj = sdk.TransactionId.generate(accountObj);
            const contractId = sdk.ContractId.fromSolidityAddress(request.address.slice(2));
            const tx = new sdk.ContractExecuteTransaction()
              .setTransactionId(txIdObj)
              .setContractId(contractId)
              .setGas(request.gas ?? DEFAULT_GAS_LIMIT)
              .setFunctionParameters(hexToBytes(functionData));
            if (request.value && request.value > 0n) {
              const tinybar = normalizePayableToTinybar(request.value);
              tx.setPayableAmount(sdk.Hbar.fromTinybars(tinybar.toString()));
            }
            const isPayableRequest = !!request.value && request.value > 0n;

            // Prefer signer.call() so HashConnect controls tx population/freeze/signing lifecycle.
            // This avoids intermittent "list is locked" errors from pre-populated transaction internals.
            txId = txIdObj.toString();
            const signer = (hashconnect as any).getSigner?.(accountObj as any);
            const freezeClient =
              (signer && typeof signer.getClient === "function" ? signer.getClient() : null) ??
              (network === "mainnet" ? sdk.Client.forMainnet() : sdk.Client.forTestnet());
            let receipt: any;
            if (!isPayableRequest && signer && typeof signer.call === "function") {
              // For non-payable calls, use freezeWithSigner so HashConnect's own signer
              // populates node account IDs correctly before the transaction is frozen.
              // Using freezeWith(client) here caused CONTRACT_REVERT_EXECUTED because it
              // conflicts with HashConnect's internal tx population lifecycle.
              // freezeWithSigner is the official way to prepare a tx before signer.call().
              if (typeof (tx as any).freezeWithSigner === "function") {
                await (tx as any).freezeWithSigner(signer);
              }
              receipt = await signer.call(tx as any);
              txId = tx.transactionId?.toString?.() ?? receipt?.transactionId?.toString?.() ?? txId;
            } else if (
              isPayableRequest &&
              signer &&
              typeof signer.signTransaction === "function" &&
              freezeClient
            ) {
              // For payable calls, sign with HashPack then execute via Hedera client.
              // This avoids WalletConnect protobuf payload issues and preserves msg.value.
              // HashPack signing requires exactly one node account id before freeze.
              if (typeof (tx as any).setNodeAccountIds === "function") {
                const singleNode = pickSingleNodeAccountId(sdk, freezeClient, network);
                (tx as any).setNodeAccountIds([singleNode]);
              }
              if (typeof (tx as any).isFrozen === "function" && !(tx as any).isFrozen()) {
                tx.freezeWith(freezeClient);
              }
              const signedTx = await signer.signTransaction(tx as any);
              const txResponse = await (signedTx as any).execute(freezeClient);
              txId =
                txResponse?.transactionId?.toString?.() ?? tx.transactionId?.toString?.() ?? txId;
              receipt = await txResponse.getReceipt(freezeClient);
            } else {
              // Fallback for older HashConnect behavior
              receipt = await (hashconnect as any).sendTransaction(accountObj as any, tx as any);
              txId = tx.transactionId?.toString?.() ?? receipt?.transactionId?.toString?.() ?? txId;
            }
            let status = receipt?.status;
            // Some wallet paths can return a transaction response-like object.
            // If status is missing, try to resolve a receipt before checking status.
            if (
              (status == null || typeof status === "undefined") &&
              receipt &&
              typeof receipt.getReceipt === "function"
            ) {
              try {
                const responseReceipt = await receipt.getReceipt();
                if (responseReceipt) {
                  receipt = responseReceipt;
                  status = responseReceipt.status;
                  txId =
                    txId ??
                    responseReceipt?.transactionId?.toString?.() ??
                    tx.transactionId?.toString?.() ??
                    null;
                }
              } catch {
                // leave as-is; handled by status check below
              }
            }
            const statusText = status?.toString?.() ?? "";
            if (!status && txId) {
              // HashPack returned a txId but no status — verify on-chain via mirror node.
              try {
                const mirrorBase =
                  network === "mainnet"
                    ? "https://mainnet.mirrornode.hedera.com"
                    : "https://testnet.mirrornode.hedera.com";
                // Transaction ID format: 0.0.XXXX@seconds.nanos → needs URL encoding
                const txIdForMirror = txId.replace("@", "-").replace(/\./g, "-");
                // Wait briefly for consensus
                await sleep(3000);
                const mirrorRes = await fetch(`${mirrorBase}/api/v1/transactions/${txIdForMirror}`);
                if (mirrorRes.ok) {
                  const mirrorData = (await mirrorRes.json()) as {
                    transactions?: { result?: string }[];
                  };
                  const result = mirrorData?.transactions?.[0]?.result;
                  if (result && result !== "SUCCESS") {
                    throw new TransactionRevertError(
                      txId,
                      `Transaction reverted on-chain with status: ${result}. Transaction ID: ${txId}.`,
                    );
                  }
                }
              } catch (verifyErr) {
                // If it's our own TransactionRevertError, re-throw it
                if (verifyErr instanceof TransactionRevertError) throw verifyErr;
                // Mirror node lookup failed — log but don't block (tx may still be valid)
              }
              if (txId) safeSetLastHash(txId);
              await refreshAccountData().catch(() => {});
              break;
            }
            if (!status || statusText !== sdk.Status.Success.toString()) {
              throw new TransactionRevertError(
                txId || "unknown",
                `Transaction failed with Hedera status ${statusText || "UNKNOWN"}.${txId ? ` Transaction ID: ${txId}.` : ""}`,
              );
            }
            if (txId) safeSetLastHash(txId);
            await refreshAccountData().catch(() => {});
            break;
          } catch (e) {
            const err = e instanceof Error ? e : new Error(String(e));
            lastError = err;
            if (attempt < MAX_RETRIES - 1 && isRetryableWalletError(err.message)) continue;
            safeSetError(err);
            throw err;
          }
        }

        if (!txId) {
          // Some wallet flows return successful receipt but not tx id; surface a non-blocking placeholder.
          if (!lastError) return "submitted";
          const fallback = lastError || new Error("Failed to submit transaction.");
          safeSetError(fallback);
          throw fallback;
        }
        return txId;
      } finally {
        inFlightRef.current = false;
        safeSetPending(false);
      }
    },
    [accountId, hashconnect, isConnected, network, refreshAccountData],
  );

  return { send, isPending, error, lastHash };
}
