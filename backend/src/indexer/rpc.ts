import { ethers } from "ethers";
import type { Logger } from "pino";
import { EXPECTED_TOPIC0_ITEM_LISTED } from "./decoder";

const RPC_URL = process.env.HEDERA_RPC_URL || "https://testnet.hashio.io/api";

/** Hedera RPC often limits eth_getLogs to ~5 blocks. Use small chunk. */
const BLOCK_CHUNK = 5;

let lastProcessedBlock = 0;

function normalizeAddress(addr: string): `0x${string}` {
  const hex = addr.startsWith("0x") ? addr.slice(2) : addr;
  return ("0x" + hex.toLowerCase()) as `0x${string}`;
}

export async function fetchItemListedLogsFromRpc(
  marketplaceAddress: string,
  log?: Logger
): Promise<any[]> {
  if (!RPC_URL) return [];

  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const toBlockNum = await provider.getBlockNumber();
    if (toBlockNum == null || toBlockNum < 0) return [];

    const fromBlock =
      lastProcessedBlock > 0
        ? lastProcessedBlock + 1
        : Math.max(0, toBlockNum - BLOCK_CHUNK);

    const address = normalizeAddress(marketplaceAddress);
    const logs = await provider.getLogs({
      address,
      topics: [EXPECTED_TOPIC0_ITEM_LISTED as `0x${string}`],
      fromBlock,
      toBlock: toBlockNum,
    });

    return Array.isArray(logs) ? logs : [];
  } catch (err: unknown) {
    const msg = err && typeof err === "object" && "shortMessage" in err
      ? (err as { shortMessage?: string }).shortMessage
      : err instanceof Error
        ? err.message
        : "RPC request failed";
    const isRetryable = typeof msg === "string" && (
      msg.includes("504") || msg.includes("502") || msg.includes("timeout") || msg.includes("TIMEOUT") || msg.includes("Bad Gateway")
    );
    if (log) {
      log[isRetryable ? "warn" : "error"]({ err: msg }, "RPC getLogs failed, skipping this cycle");
    } else {
      console.warn("RPC getLogs failed:", msg);
    }
    return [];
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
