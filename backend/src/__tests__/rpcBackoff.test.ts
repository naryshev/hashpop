import { beforeEach, describe, expect, it } from "vitest";
import {
  HEDERA_RPC_PROVIDER_OPTIONS,
  clearRpcBackoffForTests,
  fetchItemListedLogsFromRpc,
  nextRpcBackoffMs,
  setLastProcessedBlock,
} from "../indexer/rpc";

const ADDRESS = "0x8a5d0bb93c3cde63540121656f094319f87b2059";

describe("RPC getLogs backoff", () => {
  beforeEach(() => {
    clearRpcBackoffForTests();
    setLastProcessedBlock(0);
  });

  it("does not detect the network on every call", () => {
    expect(HEDERA_RPC_PROVIDER_OPTIONS).toEqual({ staticNetwork: true });
  });

  it("backs off after 404/502/503 instead of calling again 8s later", async () => {
    expect(nextRpcBackoffMs(1)).toBe(8_000);
    expect(nextRpcBackoffMs(2)).toBe(16_000);
    expect(nextRpcBackoffMs(3)).toBe(32_000);
    expect(nextRpcBackoffMs(20)).toBe(5 * 60_000);

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

    await fetchItemListedLogsFromRpc(ADDRESS, log as never, source, 1_000);
    await fetchItemListedLogsFromRpc(ADDRESS, log as never, source, 1_000 + 7_000);
    expect(calls).toBe(1);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain(ADDRESS);
    expect(warnings[0]).toContain("404");

    await fetchItemListedLogsFromRpc(ADDRESS, log as never, source, 1_000 + 8_000);
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
    await fetchItemListedLogsFromRpc(ADDRESS, log as never, source, 0);
    await fetchItemListedLogsFromRpc(ADDRESS, log as never, source, 8_000);
    // The successful read clears the streak, so the next failure waits 8s, not 16s.
    let calls = 0;
    const retry = {
      getBlockNumber: async () => 20,
      getLogs: async () => {
        calls += 1;
        throw new Error("503 Service Unavailable");
      },
    };
    await fetchItemListedLogsFromRpc(ADDRESS, log as never, retry, 20_000);
    await fetchItemListedLogsFromRpc(ADDRESS, log as never, retry, 20_000 + 8_000);
    expect(calls).toBe(2);
  });
});
