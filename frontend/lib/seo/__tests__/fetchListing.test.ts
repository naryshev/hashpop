import { afterEach, describe, expect, it, vi } from "vitest";
import { loadPublicListing } from "../fetchListing";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("loadPublicListing", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns the listing when the backend responds 200", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(200, { listing: { id: "0xabc", title: "Galaxy Gas" } }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const result = await loadPublicListing("lst-galaxy");
    expect(result).toEqual({
      status: "ok",
      listing: { id: "0xabc", title: "Galaxy Gas" },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/api/listing/lst-galaxy");
    expect(init.cache).toBe("no-store");
  });

  it("classifies a backend 404 as not found", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(404, { error: "Listing not found" })),
    );
    await expect(loadPublicListing("missing-id")).resolves.toEqual({ status: "not_found" });
  });

  it("does not treat an empty id as a transient failure", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(loadPublicListing("   ")).resolves.toEqual({ status: "not_found" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("classifies 5xx as unavailable instead of not found", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(503, { error: "Database unavailable" })),
    );
    await expect(loadPublicListing("lst-1")).resolves.toEqual({ status: "unavailable" });
  });

  it("classifies a timeout or network error as unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new DOMException("The operation was aborted", "TimeoutError");
      }),
    );
    await expect(loadPublicListing("lst-1")).resolves.toEqual({ status: "unavailable" });
  });

  it("classifies a 200 without a listing id as unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(200, { listing: null })),
    );
    await expect(loadPublicListing("lst-1")).resolves.toEqual({ status: "unavailable" });
  });
});
