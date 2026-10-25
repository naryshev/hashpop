import { describe, expect, it, vi } from "vitest";
import { LISTING_CLIENT_FETCH_TIMEOUT_MS, resolveListingRefresh } from "../listingLoad";

describe("resolveListingRefresh", () => {
  it("stops on a confirmed 404 without retrying", async () => {
    const fetchImpl = vi.fn(async () => ({
      status: 404,
      ok: false,
      json: async () => ({ error: "Listing not found" }),
    }));
    const result = await resolveListingRefresh({
      url: "http://api.test/api/listing/missing",
      timeoutMs: 50,
      maxAttempts: 4,
      retryDelayMs: 1,
      fetchImpl,
    });
    expect(result).toEqual({ phase: "missing" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("returns the listing when a retry succeeds", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        status: 503,
        ok: false,
        json: async () => ({}),
      })
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({ listing: { id: "lst-1", title: "Galaxy Gas" } }),
      });
    const result = await resolveListingRefresh({
      url: "http://api.test/api/listing/lst-1",
      timeoutMs: 50,
      maxAttempts: 3,
      retryDelayMs: 1,
      fetchImpl,
    });
    expect(result).toEqual({
      phase: "ready",
      listing: { id: "lst-1", title: "Galaxy Gas" },
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("settles a hung request as unavailable instead of loading forever", async () => {
    const fetchImpl = vi.fn(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise<never>((_resolve, reject) => {
          init.signal.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted", "TimeoutError"));
          });
        }),
    );
    const started = Date.now();
    const result = await resolveListingRefresh({
      url: "http://api.test/api/listing/lst-1",
      timeoutMs: 30,
      maxAttempts: 2,
      retryDelayMs: 1,
      fetchImpl,
    });
    expect(result).toEqual({ phase: "unavailable" });
    expect(Date.now() - started).toBeLessThan(LISTING_CLIENT_FETCH_TIMEOUT_MS);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
