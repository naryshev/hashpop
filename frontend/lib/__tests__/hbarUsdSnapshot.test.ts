import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchHbarUsdSnapshot, hbarUsdFromEnv, listingOfferPriceLabel } from "../hbarUsd";

describe("HBAR/USD snapshot", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.NEXT_PUBLIC_HBAR_USD;
  });

  it("reads the same env rate the client hook prefers", () => {
    process.env.NEXT_PUBLIC_HBAR_USD = "0.25";
    expect(hbarUsdFromEnv()).toBe(0.25);
  });

  it("uses the env snapshot without calling CoinGecko", async () => {
    process.env.NEXT_PUBLIC_HBAR_USD = "0.25";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchHbarUsdSnapshot()).resolves.toBe(0.25);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(listingOfferPriceLabel("5", 0.25)).toBe("5 ℏ (≈ $1.25 USD)");
  });

  it("returns null when CoinGecko is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await expect(fetchHbarUsdSnapshot()).resolves.toBeNull();
    expect(listingOfferPriceLabel("5", null)).toBeNull();
  });

  it("reads the CoinGecko USD field the client uses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ "hedera-hashgraph": { usd: 0.08 } }),
      }),
    );
    await expect(fetchHbarUsdSnapshot()).resolves.toBe(0.08);
  });
});
