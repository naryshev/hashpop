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

function encodeFunctionData(abi: readonly unknown[], functionName: string, args?: readonly unknown[]): string {
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

function weiToTinybar(wei: bigint): bigint {
  if (wei % WEI_PER_TINYBAR !== 0n) {
    throw new Error("Payable value must resolve to whole tinybars.");
  }
  return wei / WEI_PER_TINYBAR;
}

class TransactionRevertError extends Error {
  constructor(public readonly hash: string, message?: string) {
    super(
      message ||
        `Transaction failed on-chain. Transaction ID: ${hash}. This may indicate insufficient funds or invalid parameters.`
    );
    this.name = "TransactionRevertError";
  }
}

export function useHashpackContractWrite() {
  const { hashconnect, accountId, isConnected, refreshAccountData } = useHashpackWallet();
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
            const functionData = encodeFunctionData(request.abi, request.functionName, request.args);
            const accountObj = sdk.AccountId.fromString(accountId);
            const txIdObj = sdk.TransactionId.generate(accountObj);
            const contractId = sdk.ContractId.fromSolidityAddress(request.address.slice(2));
            const tx = new sdk.ContractExecuteTransaction()
              .setTransactionId(txIdObj)
              .setContractId(contractId)
              .setGas(request.gas ?? DEFAULT_GAS_LIMIT)
              .setFunctionParameters(hexToBytes(functionData));
            if (request.value && request.value > 0n) {
              const tinybar = weiToTinybar(request.value);
              tx.setPayableAmount(sdk.Hbar.fromTinybars(tinybar.toString()));
            }

            txId = txIdObj.toString();
            const receipt = await (hashconnect as any).sendTransaction(accountObj, tx);
            const status = receipt.status;
            if (status !== sdk.Status.Success) {
              throw new TransactionRevertError(
                txId,
                `Transaction failed with Hedera status ${status.toString()}. Transaction ID: ${txId}.`
              );
            }
            safeSetLastHash(txId);
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
    [accountId, hashconnect, isConnected, refreshAccountData]
  );

  return { send, isPending, error, lastHash };
}

