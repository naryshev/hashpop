import { ethers } from "ethers";
import { EXPECTED_TOPIC0_ITEM_LISTED } from "./decoder";

const RPC_URL = process.env.HEDERA_RPC_URL;

/** Hedera RPC limits eth_getLogs to a 7-day block range. Use a small chunk to stay under limit. */
const BLOCK_CHUNK = 2000;

let lastProcessedBlock = 0;

export async function fetchItemListedLogsFromRpc(
  marketplaceAddress: string
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

    const logs = await provider.getLogs({
      address: marketplaceAddress as `0x${string}`,
      topics: [EXPECTED_TOPIC0_ITEM_LISTED as `0x${string}`],
      fromBlock,
      toBlock: toBlockNum,
    });

    return Array.isArray(logs) ? logs : [];
  } catch (err) {
    console.error("RPC getLogs error:", err);
    return [];
  }
}

export function updateLastProcessedBlock(blockNumber: number): void {
  if (blockNumber > lastProcessedBlock) lastProcessedBlock = blockNumber;
}

export function getLastProcessedBlock(): number {
  return lastProcessedBlock;
}
