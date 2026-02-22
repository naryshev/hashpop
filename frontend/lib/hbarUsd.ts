/**
 * HBAR/USD rate for display. Fetches from CoinGecko (no key) or uses NEXT_PUBLIC_HBAR_USD.
 */

const COINGECKO_URL = "https://api.coingecko.com/api/v3/simple/price?ids=hedera-hashgraph&vs_currencies=usd";

let cachedRate: number | null = null;
let fetchPromise: Promise<number | null> | null = null;

export async function fetchHbarUsd(): Promise<number | null> {
  if (cachedRate != null) return cachedRate;
  const envRate = process.env.NEXT_PUBLIC_HBAR_USD;
  if (envRate != null && envRate.trim() !== "") {
    const n = Number(envRate.trim());
    if (!Number.isNaN(n) && n > 0) {
      cachedRate = n;
      return cachedRate;
    }
  }
  if (typeof window === "undefined") return null;
  if (!fetchPromise) {
    fetchPromise = fetch(COINGECKO_URL)
      .then((r) => r.json())
      .then((data: { "hedera-hashgraph"?: { usd?: number } }) => {
        const usd = data?.["hedera-hashgraph"]?.usd;
        if (typeof usd === "number" && usd > 0) {
          cachedRate = usd;
          return usd;
        }
        return null;
      })
      .catch(() => null);
  }
  return fetchPromise;
}

/** Format "X HBAR" with optional " ($Y.YY)" when rate is available. */
export function formatHbarWithUsd(hbarDisplay: string, usdPerHbar: number | null): string {
  const base = `${hbarDisplay} HBAR`;
  if (usdPerHbar == null || usdPerHbar <= 0) return base;
  const hbarNum = Number(hbarDisplay);
  if (Number.isNaN(hbarNum)) return base;
  const usd = hbarNum * usdPerHbar;
  if (usd >= 0.01) return `${base} ($${usd.toFixed(2)})`;
  if (usd > 0) return `${base} ($${usd.toFixed(4)})`;
  return base;
}
