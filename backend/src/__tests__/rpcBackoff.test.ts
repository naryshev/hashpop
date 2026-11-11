import { beforeEach, describe, expect, it } from "vitest";
import {
  HEDERA_RPC_PROVIDER_OPTIONS,
  clearRpcBackoffForTests,
  fetchItemListedLogsFromRpc,
  getLastProcessedBlock,
  getSharedRpcProvider,
  hederaNetworkFromRpcUrl,
  isRetryableRpcError,
  nextRpcBackoffMs,
  resetSharedRpcProviderForTests,
  rpcErrorMessage,
  setLastProcessedBlock,
  withJitter,
} from "../indexer/rpc";

const ADDRESS = "0x8a5d0bb93c3cde63540121656f094319f87b2059";
const noJitter = () => 0;

function throwCoalescedGetLogsError() {
  const err = new Error("could not coalesce error");
  Object.assign(err, {
    shortMessage: "could not coalesce error",
    code: "UNKNOWN_ERROR",
    error: {
      code: -32007,
      message: "[Request ID: test] Method eth_getLogs is not permitted as part of batch requests",
    },
    payload: { method: "eth_getLogs" },
  });
  throw err;
}

describe("RPC getLogs backoff", () => {
  beforeEach(() => {
    clearRpcBackoffForTests();
    resetSharedRpcProviderForTests();
    setLastProcessedBlock(0);
  });

  it("does not detect the network on every call and does not batch eth_getLogs", () => {
    expect(HEDERA_RPC_PROVIDER_OPTIONS).toEqual({ staticNetwork: true, batchMaxCount: 1 });
  });

  it("reuses one provider for the same RPC URL", () => {
    const a = getSharedRpcProvider("https://mainnet.hashio.io/api");
    const b = getSharedRpcProvider("https://mainnet.hashio.io/api");
    expect(a).toBe(b);
    const c = getSharedRpcProvider("https://testnet.hashio.io/api");
    expect(c).not.toBe(a);
  });

  it("pins the static network from a Hashio host", () => {
    expect(hederaNetworkFromRpcUrl("https://mainnet.hashio.io/api")?.chainId).toBe(295n);
    expect(hederaNetworkFromRpcUrl("https://testnet.hashio.io/api")?.chainId).toBe(296n);
    expect(hederaNetworkFromRpcUrl("https://previewnet.hashio.io/api")?.chainId).toBe(297n);
    expect(hederaNetworkFromRpcUrl("https://rpc.example/api")).toBeUndefined();
  });

  it("backs off after 404/502/503 instead of calling again 8s later", async () => {
    expect(nextRpcBackoffMs(1)).toBe(8_000);
    expect(nextRpcBackoffMs(2)).toBe(16_000);
    expect(nextRpcBackoffMs(3)).toBe(32_000);
    expect(nextRpcBackoffMs(20)).toBe(5 * 60_000);
    expect(withJitter(8_000, () => 0)).toBe(8_000);
    expect(withJitter(8_000, () => 0.5)).toBe(8_000 + 800);

    let calls = 0;
    const warnings: string[] = [];
    const source = {
      getBlockNumber: async () => 100,
      getLogs: async () => {
        calls += 1;
        const err = new Error("server response 404 Not Found");
        (err as { shortMessage?: string }).shortMessage = "server response 404 Not Found";
        throw err;
      },
    };
    const log = {
      warn: (_obj: unknown, msg?: string) => warnings.push(msg ?? String(_obj)),
      error: (_obj: unknown, msg?: string) => warnings.push(msg ?? String(_obj)),
      debug: () => undefined,
    };

    await fetchItemListedLogsFromRpc(ADDRESS, log as never, source, 1_000, noJitter);
    await fetchItemListedLogsFromRpc(ADDRESS, log as never, source, 1_000 + 7_000, noJitter);
    expect(calls).toBe(1);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain(ADDRESS);
    expect(warnings[0]).toContain("404");

    await fetchItemListedLogsFromRpc(ADDRESS, log as never, source, 1_000 + 8_000, noJitter);
    expect(calls).toBe(2);
  });

  it("resets the backoff after a successful read", async () => {
    const messages = ["Bad Gateway 502", ""];
    let i = 0;
    const source = {
      getBlockNumber: async () => 20,
      getLogs: async () => {
        const message = messages[i] ?? "";
        i += 1;
        if (message) throw new Error(message);
        return [];
      },
    };
    const log = { warn: () => undefined, error: () => undefined, debug: () => undefined };
    await fetchItemListedLogsFromRpc(ADDRESS, log as never, source, 0, noJitter);
    await fetchItemListedLogsFromRpc(ADDRESS, log as never, source, 8_000, noJitter);
    // The successful read clears the streak, so the next failure waits 8s, not 16s.
    setLastProcessedBlock(0);
    let calls = 0;
    const retry = {
      getBlockNumber: async () => 20,
      getLogs: async () => {
        calls += 1;
        throw new Error("503 Service Unavailable");
      },
    };
    await fetchItemListedLogsFromRpc(ADDRESS, log as never, retry, 20_000, noJitter);
    await fetchItemListedLogsFromRpc(ADDRESS, log as never, retry, 20_000 + 8_000, noJitter);
    expect(calls).toBe(2);
  });

  it("logs the inner Hashio -32007 batch rejection, not only could not coalesce error", () => {
    const err = {
      shortMessage: "could not coalesce error",
      code: "UNKNOWN_ERROR",
      error: {
        code: -32007,
        message: "Method eth_getLogs is not permitted as part of batch requests",
      },
      payload: { method: "eth_getLogs" },
    };
    const msg = rpcErrorMessage(err);
    expect(msg).toContain("could not coalesce error");
    expect(msg).toContain("-32007");
    expect(msg).toContain("not permitted as part of batch");
    expect(msg).toContain("eth_getLogs");
    expect(isRetryableRpcError(msg)).toBe(true);
    expect(isRetryableRpcError("server response 429 Too Many Requests")).toBe(true);
  });

  it("chunks getLogs to 5 blocks and advances the cursor on empty successes", async () => {
    const ranges: Array<{ fromBlock: number; toBlock: number }> = [];
    const source = {
      getBlockNumber: async () => 112,
      getLogs: async (filter: object) => {
        ranges.push(filter as { fromBlock: number; toBlock: number });
        return [];
      },
    };
    setLastProcessedBlock(100);
    const logs = await fetchItemListedLogsFromRpc(ADDRESS, undefined, source, 0, noJitter);
    expect(logs).toEqual([]);
    expect(ranges).toEqual([
      expect.objectContaining({ fromBlock: 101, toBlock: 105 }),
      expect.objectContaining({ fromBlock: 106, toBlock: 110 }),
      expect.objectContaining({ fromBlock: 111, toBlock: 112 }),
    ]);
    expect(getLastProcessedBlock()).toBe(112);
  });

  it("keeps earlier chunk logs and does not skip the failed range", async () => {
    const firstLog = { blockNumber: 103 };
    const source = {
      getBlockNumber: async () => 112,
      getLogs: async (filter: object) => {
        const { fromBlock } = filter as { fromBlock: number };
        if (fromBlock === 101) return [firstLog];
        throwCoalescedGetLogsError();
        return [];
      },
    };
    setLastProcessedBlock(100);
    const logs = await fetchItemListedLogsFromRpc(ADDRESS, undefined, source, 0, noJitter);
    expect(logs).toEqual([firstLog]);
    expect(getLastProcessedBlock()).toBe(105);

    let retried: Array<{ fromBlock: number; toBlock: number }> = [];
    const retry = {
      getBlockNumber: async () => 112,
      getLogs: async (filter: object) => {
        retried.push(filter as { fromBlock: number; toBlock: number });
        return [];
      },
    };
    await fetchItemListedLogsFromRpc(ADDRESS, undefined, retry, 8_000, noJitter);
    expect(retried[0]).toEqual(expect.objectContaining({ fromBlock: 106, toBlock: 110 }));
  });

  it("rate-limits repeated identical failure logs", async () => {
    const warnings: Array<[unknown, string?]> = [];
    const debugs: Array<[unknown, string?]> = [];
    const source = {
      getBlockNumber: async () => 20,
      getLogs: async () => {
        throwCoalescedGetLogsError();
        return [];
      },
    };
    const log = {
      warn: (obj: unknown, msg?: string) => warnings.push([obj, msg]),
      error: (obj: unknown, msg?: string) => warnings.push([obj, msg]),
      debug: (obj: unknown, msg?: string) => debugs.push([obj, msg]),
    };
    await fetchItemListedLogsFromRpc(ADDRESS, log as never, source, 0, noJitter);
    await fetchItemListedLogsFromRpc(ADDRESS, log as never, source, 8_000, noJitter);
    await fetchItemListedLogsFromRpc(ADDRESS, log as never, source, 24_000, noJitter);
    expect(warnings).toHaveLength(1);
    expect(String(warnings[0]?.[1])).toContain("-32007");
    expect(debugs.length).toBeGreaterThanOrEqual(2);
    const lastDebug = debugs[debugs.length - 1]?.[0] as { suppressedFailureLogs?: number };
    expect(lastDebug.suppressedFailureLogs).toBeGreaterThanOrEqual(1);
  });
});
