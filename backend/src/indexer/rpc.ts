import { ethers } from "ethers";
import type { Logger } from "pino";
import { EXPECTED_TOPIC0_ITEM_LISTED } from "./decoder";

const RPC_URL = process.env.HEDERA_RPC_URL || "https://testnet.hashio.io/api";

/** Inclusive max blocks per eth_getLogs call. Hashio also caps by a 7-day timestamp window. */
const BLOCK_CHUNK = 5;

const HEDERA_CHAIN_IDS: Record<string, number> = {
  mainnet: 295,
  testnet: 296,
  previewnet: 297,
};

/**
 * Hashio rejects eth_getLogs inside a JSON-RPC batch (-32007), and ethers v6
 * batches by default (even a one-element array). Disable batching and skip
 * repeated eth_chainId detection. A shared provider is reused across polls.
 */
export const HEDERA_RPC_PROVIDER_OPTIONS = {
  staticNetwork: true,
  batchMaxCount: 1,
} as const;

const RPC_BACKOFF_BASE_MS = 8_000;
const RPC_BACKOFF_MAX_MS = 5 * 60_000;
const FAILURE_LOG_INTERVAL_MS = 60_000;

let lastProcessedBlock = 0;
let rpcFailureStreak = 0;
let rpcBackoffUntil = 0;
let lastFailureSignature = "";
let lastFailureLogAt = 0;
let suppressedFailureLogs = 0;
let sharedProvider: ethers.JsonRpcProvider | null = null;
let sharedProviderUrl: string | null = null;

export type RpcLogSource = {
  getBlockNumber(): Promise<number>;
  getLogs(filter: object): Promise<unknown[]>;
};

export type RpcLogFilter = {
  address: string;
  topics: string[];
  fromBlock: number;
  toBlock: number;
};

export function clearRpcBackoffForTests(): void {
  rpcFailureStreak = 0;
  rpcBackoffUntil = 0;
  lastFailureSignature = "";
  lastFailureLogAt = 0;
  suppressedFailureLogs = 0;
}

export function resetSharedRpcProviderForTests(): void {
  sharedProvider = null;
  sharedProviderUrl = null;
}

export function nextRpcBackoffMs(streak: number): number {
  const exponent = Math.min(Math.max(streak, 1), 16);
  return Math.min(RPC_BACKOFF_MAX_MS, RPC_BACKOFF_BASE_MS * 2 ** (exponent - 1));
}

export function withJitter(baseMs: number, random: () => number = Math.random): number {
  return baseMs + Math.floor(random() * 0.2 * baseMs);
}

/** `https://mainnet.hashio.io/api` → Network(295). Only exact host labels count. */
export function hederaNetworkFromRpcUrl(rpcUrl: string | undefined): ethers.Network | undefined {
  const value = rpcUrl?.trim();
  if (!value) return undefined;
  let host: string;
  try {
    host = new URL(value).hostname.toLowerCase();
  } catch {
    return undefined;
  }
  const labels = host.split(".");
  const found = Object.keys(HEDERA_CHAIN_IDS).filter((network) => labels.includes(network));
  if (found.length !== 1) return undefined;
  return ethers.Network.from(HEDERA_CHAIN_IDS[found[0]!]);
}

export function getSharedRpcProvider(rpcUrl: string = RPC_URL): ethers.JsonRpcProvider {
  if (!sharedProvider || sharedProviderUrl !== rpcUrl) {
    const network = hederaNetworkFromRpcUrl(rpcUrl);
    sharedProvider = new ethers.JsonRpcProvider(rpcUrl, network, {
      staticNetwork: network ?? true,
      batchMaxCount: 1,
    });
    sharedProviderUrl = rpcUrl;
  }
  return sharedProvider;
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
  random: () => number = Math.random,
): Promise<any[]> {
  if (!source && !RPC_URL) return [];
  if (now < rpcBackoffUntil) {
    log?.debug?.(
      { marketplaceAddress, retryInMs: rpcBackoffUntil - now },
      "RPC getLogs skipped during backoff",
    );
    return [];
  }

  const collected: unknown[] = [];
  let fromBlock = 0;
  let chunkTo = 0;
  try {
    const provider = source ?? getSharedRpcProvider(RPC_URL);
    const toBlockNum = await provider.getBlockNumber();
    if (toBlockNum == null || toBlockNum < 0) return [];

    fromBlock =
      lastProcessedBlock > 0 ? lastProcessedBlock + 1 : Math.max(0, toBlockNum - BLOCK_CHUNK + 1);
    if (fromBlock > toBlockNum) return [];

    const address = normalizeAddress(marketplaceAddress);

    while (fromBlock <= toBlockNum) {
      chunkTo = Math.min(toBlockNum, fromBlock + BLOCK_CHUNK - 1);
      try {
        const logs = await provider.getLogs({
          address,
          topics: [EXPECTED_TOPIC0_ITEM_LISTED as `0x${string}`],
          fromBlock,
          toBlock: chunkTo,
        });
        if (Array.isArray(logs)) collected.push(...logs);
        if (chunkTo > lastProcessedBlock) lastProcessedBlock = chunkTo;
        fromBlock = chunkTo + 1;
      } catch (err: unknown) {
        recordRpcFailure(marketplaceAddress, err, log, now, random, fromBlock, chunkTo);
        return collected;
      }
    }

    rpcFailureStreak = 0;
    rpcBackoffUntil = 0;
    return collected;
  } catch (err: unknown) {
    recordRpcFailure(marketplaceAddress, err, log, now, random, fromBlock, chunkTo);
    return collected;
  }
}

function recordRpcFailure(
  marketplaceAddress: string,
  err: unknown,
  log: Logger | undefined,
  now: number,
  random: () => number,
  fromBlock: number,
  chunkTo: number,
): void {
  const msg = rpcErrorMessage(err);
  rpcFailureStreak += 1;
  const delay = withJitter(nextRpcBackoffMs(rpcFailureStreak), random);
  rpcBackoffUntil = now + delay;
  const line = `RPC getLogs failed for ${marketplaceAddress} (${msg}). Next attempt in ${Math.round(delay / 1000)}s.`;
  logRpcFailure(
    log,
    isRetryableRpcError(msg) ? "warn" : "error",
    { err: msg, delayMs: delay, fromBlock, toBlock: chunkTo },
    line,
    now,
  );
}

export function rpcErrorMessage(err: unknown): string {
  const parts: string[] = [];
  if (err && typeof err === "object") {
    const e = err as {
      shortMessage?: unknown;
      code?: unknown;
      message?: unknown;
      error?: unknown;
      payload?: { method?: unknown };
      info?: { error?: unknown; responseStatus?: unknown };
    };
    if (typeof e.shortMessage === "string" && e.shortMessage) parts.push(e.shortMessage);
    else if (err instanceof Error && err.message) parts.push(err.message);
    if (e.code != null && e.code !== "") parts.push(`code=${String(e.code)}`);
    const inner = e.error ?? e.info?.error;
    if (inner && typeof inner === "object") {
      const rpc = inner as { code?: unknown; message?: unknown; details?: unknown };
      if (rpc.code != null) parts.push(`rpcCode=${String(rpc.code)}`);
      if (typeof rpc.message === "string" && rpc.message) parts.push(rpc.message);
      if (rpc.details != null && rpc.details !== "") parts.push(String(rpc.details));
    } else if (typeof inner === "string" && inner) {
      parts.push(inner);
    }
    if (e.payload?.method) parts.push(`method=${String(e.payload.method)}`);
    if (e.info?.responseStatus != null) parts.push(`status=${String(e.info.responseStatus)}`);
  } else if (err instanceof Error && err.message) {
    parts.push(err.message);
  }
  return parts.length > 0 ? parts.join("; ") : "RPC request failed";
}

export function isRetryableRpcError(msg: string): boolean {
  return /429|32007|32004|rate limit|too many requests|coalesce|unknown_error|not permitted as part of batch|502|503|504|404|timeout|bad gateway|detect network|econnreset|enotfound/i.test(
    msg,
  );
}

function logRpcFailure(
  log: Logger | undefined,
  level: "warn" | "error",
  details: Record<string, unknown>,
  line: string,
  now: number,
): void {
  const signature = String(details.err ?? line);
  if (signature === lastFailureSignature && now - lastFailureLogAt < FAILURE_LOG_INTERVAL_MS) {
    suppressedFailureLogs += 1;
    log?.debug?.({ ...details, suppressedFailureLogs }, line);
    return;
  }
  const extra = suppressedFailureLogs > 0 ? { suppressedFailureLogs } : {};
  suppressedFailureLogs = 0;
  lastFailureSignature = signature;
  lastFailureLogAt = now;
  if (log) {
    log[level]({ ...details, ...extra }, line);
  } else {
    console.warn(line);
  }
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
