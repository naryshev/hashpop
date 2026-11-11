import { ethers } from "ethers";
import type { Logger } from "pino";
import { EXPECTED_TOPIC0_ITEM_LISTED } from "./decoder";

const RPC_URL = process.env.HEDERA_RPC_URL || "https://testnet.hashio.io/api";

/** Hedera RPC often limits eth_getLogs to ~5 blocks. Use small chunk. */
const BLOCK_CHUNK = 5;

/** Skip eth_chainId. An unset network makes JsonRpcProvider log "failed to detect network" and retry. */
export const HEDERA_RPC_PROVIDER_OPTIONS = { staticNetwork: true } as const;

const RPC_BACKOFF_BASE_MS = 8_000;
const RPC_BACKOFF_MAX_MS = 5 * 60_000;

let lastProcessedBlock = 0;
let rpcFailureStreak = 0;
let rpcBackoffUntil = 0;

export type RpcLogSource = {
  getBlockNumber(): Promise<number>;
  getLogs(filter: object): Promise<unknown[]>;
};

export function clearRpcBackoffForTests(): void {
  rpcFailureStreak = 0;
  rpcBackoffUntil = 0;
}

export function nextRpcBackoffMs(streak: number): number {
  const exponent = Math.min(Math.max(streak, 1), 16);
  return Math.min(RPC_BACKOFF_MAX_MS, RPC_BACKOFF_BASE_MS * 2 ** (exponent - 1));
}

function normalizeAddress(addr: string): `0x${string}` {
  const hex = addr.startsWith("0x") ? addr.slice(2) : addr;
  return ("0x" + hex.toLowerCase()) as `0x${string}`;
}

export async function fetchItemListedLogsFromRpc(
  marketplaceAddress: string,
  log?: Logger,
  source?: RpcLogSource,
  now: number = Date.now(),
): Promise<any[]> {
  if (!source && !RPC_URL) return [];
  if (now < rpcBackoffUntil) {
    log?.debug?.(
      { marketplaceAddress, retryInMs: rpcBackoffUntil - now },
      "RPC getLogs skipped during backoff",
    );
    return [];
  }

  try {
    const provider =
      source ?? new ethers.JsonRpcProvider(RPC_URL, undefined, HEDERA_RPC_PROVIDER_OPTIONS);
    const toBlockNum = await provider.getBlockNumber();
    if (toBlockNum == null || toBlockNum < 0) return [];

    const fromBlock =
      lastProcessedBlock > 0 ? lastProcessedBlock + 1 : Math.max(0, toBlockNum - BLOCK_CHUNK);

    const address = normalizeAddress(marketplaceAddress);
    const logs = await provider.getLogs({
      address,
      topics: [EXPECTED_TOPIC0_ITEM_LISTED as `0x${string}`],
      fromBlock,
      toBlock: toBlockNum,
    });

    rpcFailureStreak = 0;
    rpcBackoffUntil = 0;
    return Array.isArray(logs) ? logs : [];
  } catch (err: unknown) {
    const msg = rpcErrorMessage(err);
    rpcFailureStreak += 1;
    const delay = nextRpcBackoffMs(rpcFailureStreak);
    rpcBackoffUntil = now + delay;
    const line = `RPC getLogs failed for ${marketplaceAddress} (${msg}). Next attempt in ${Math.round(delay / 1000)}s.`;
    const isRetryable =
      /502|503|504|404|timeout|bad gateway|detect network|econnreset|enotfound/i.test(msg);
    if (log) {
      log[isRetryable ? "warn" : "error"]({ err: msg, delayMs: delay }, line);
    } else {
      console.warn(line);
    }
    return [];
  }
}

function rpcErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "shortMessage" in err) {
    const shortMessage = (err as { shortMessage?: string }).shortMessage;
    if (shortMessage) return shortMessage;
  }
  if (err instanceof Error && err.message) return err.message;
  return "RPC request failed";
}

export function updateLastProcessedBlock(blockNumber: number): void {
  if (blockNumber > lastProcessedBlock) lastProcessedBlock = blockNumber;
}

export function getLastProcessedBlock(): number {
  return lastProcessedBlock;
}

export function setLastProcessedBlock(blockNumber: number): void {
  lastProcessedBlock = Math.max(0, blockNumber);
}
