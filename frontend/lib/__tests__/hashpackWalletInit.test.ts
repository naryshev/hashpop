import { afterEach, describe, expect, it, vi } from "vitest";
import {
  INIT_TIMEOUT_MESSAGE,
  INIT_TIMEOUT_MS,
  MISSING_WC_PROJECT_ID_MESSAGE,
  bootstrapHashConnect,
  getWalletConnectProjectId,
  isInitTimeoutError,
  shouldRetryHashConnectInit,
  withTimeout,
} from "../hashpackWalletInit";

describe("getWalletConnectProjectId", () => {
  it("returns null when the env var is missing, blank, or whitespace", () => {
    expect(getWalletConnectProjectId({})).toBeNull();
    expect(getWalletConnectProjectId({ NEXT_PUBLIC_WC_PROJECT_ID: "" })).toBeNull();
    expect(getWalletConnectProjectId({ NEXT_PUBLIC_WC_PROJECT_ID: "   " })).toBeNull();
  });

  it("returns the trimmed WalletConnect project id", () => {
    expect(getWalletConnectProjectId({ NEXT_PUBLIC_WC_PROJECT_ID: "  abc123  " })).toBe("abc123");
  });

  it("reads process.env when called with no args", () => {
    const prev = process.env.NEXT_PUBLIC_WC_PROJECT_ID;
    process.env.NEXT_PUBLIC_WC_PROJECT_ID = " from-process ";
    try {
      expect(getWalletConnectProjectId()).toBe("from-process");
    } finally {
      if (prev === undefined) delete process.env.NEXT_PUBLIC_WC_PROJECT_ID;
      else process.env.NEXT_PUBLIC_WC_PROJECT_ID = prev;
    }
  });
});

describe("withTimeout", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves when the work finishes before the deadline", async () => {
    await expect(withTimeout(Promise.resolve("ok"), 50, INIT_TIMEOUT_MESSAGE)).resolves.toBe("ok");
  });

  it("rejects with the timeout error when init never settles", async () => {
    vi.useFakeTimers();
    const hung = new Promise<never>(() => {});
    const pending = withTimeout(hung, INIT_TIMEOUT_MS, INIT_TIMEOUT_MESSAGE);

    const expectReject = expect(pending).rejects.toSatisfy((err: unknown) => {
      return isInitTimeoutError(err) && err instanceof Error && err.message === INIT_TIMEOUT_MESSAGE;
    });

    await vi.advanceTimersByTimeAsync(INIT_TIMEOUT_MS);
    await expectReject;
  });

  it("does not reject early", async () => {
    vi.useFakeTimers();
    const hung = new Promise<never>(() => {});
    let settled = false;
    const pending = withTimeout(hung, INIT_TIMEOUT_MS, INIT_TIMEOUT_MESSAGE).finally(() => {
      settled = true;
    });

    await vi.advanceTimersByTimeAsync(INIT_TIMEOUT_MS - 1);
    expect(settled).toBe(false);

    const expectReject = expect(pending).rejects.toSatisfy(isInitTimeoutError);
    await vi.advanceTimersByTimeAsync(1);
    await expectReject;
  });
});

describe("init failure policy", () => {
  it("does not storage-wipe-retry a hung WalletConnect init", () => {
    expect(shouldRetryHashConnectInit(new Error(INIT_TIMEOUT_MESSAGE))).toBe(false);
  });

  it("retries stale pairing / transient init errors", () => {
    expect(shouldRetryHashConnectInit(new Error("Record was recently deleted"))).toBe(true);
    expect(shouldRetryHashConnectInit("boom")).toBe(true);
  });

  it("exposes an actionable missing-project-id message", () => {
    expect(MISSING_WC_PROJECT_ID_MESSAGE).toMatch(/NEXT_PUBLIC_WC_PROJECT_ID/);
  });
});

describe("bootstrapHashConnect", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the client when init finishes before the UI deadline", async () => {
    const result = await bootstrapHashConnect({
      createClient: async () => "hc",
    });
    expect(result).toEqual({
      client: "hc",
      timedOut: false,
      error: null,
      pending: null,
    });
  });

  it("hits the UI deadline without wiping storage and keeps the in-flight client", async () => {
    vi.useFakeTimers();
    let resolveClient!: (value: string) => void;
    const hung = new Promise<string>((resolve) => {
      resolveClient = resolve;
    });
    let wiped = false;
    let createCalls = 0;

    const resultP = bootstrapHashConnect({
      createClient: async () => {
        createCalls += 1;
        return hung;
      },
      timeoutMs: 1_000,
      wipeStorage: () => {
        wiped = true;
      },
    });

    await vi.advanceTimersByTimeAsync(1_000);
    const result = await resultP;

    expect(result.timedOut).toBe(true);
    expect(result.client).toBeNull();
    expect(result.error).toBe(INIT_TIMEOUT_MESSAGE);
    expect(result.pending).not.toBeNull();
    expect(wiped).toBe(false);
    expect(createCalls).toBe(1);

    resolveClient("late-hc");
    await expect(result.pending).resolves.toBe("late-hc");
  });

  it("wipes storage and retries a stale pairing error, not a hang", async () => {
    let wiped = false;
    const result = await bootstrapHashConnect({
      createClient: async (forceFresh) => {
        if (!forceFresh) throw new Error("Record was recently deleted");
        return "fresh-hc";
      },
      wipeStorage: () => {
        wiped = true;
      },
    });
    expect(wiped).toBe(true);
    expect(result.client).toBe("fresh-hc");
    expect(result.timedOut).toBe(false);
  });
});
