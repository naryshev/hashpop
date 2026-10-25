import { formatPriceForDisplay, groupHbarAmount, parseHbarAmount } from "./formatPrice";

/**
 * HBAR/USD rate for display. Fetches from CoinGecko (no key) or uses NEXT_PUBLIC_HBAR_USD.
 */

const COINGECKO_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=hedera-hashgraph&vs_currencies=usd";

/** How long a server-rendered HBAR/USD snapshot stays attached to a listing page. */
export const HBAR_USD_REVALIDATE_SECONDS = 60;

let cachedRate: number | null = null;
let fetchPromise: Promise<number | null> | null = null;

/** NEXT_PUBLIC_HBAR_USD, when set. The client hook and the SSR snapshot both prefer it. */
export function hbarUsdFromEnv(): number | null {
  const envRate = process.env.NEXT_PUBLIC_HBAR_USD;
  if (envRate == null || envRate.trim() === "") return null;
  const n = Number(envRate.trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export async function fetchHbarUsd(): Promise<number | null> {
  if (cachedRate != null) return cachedRate;
  const envRate = hbarUsdFromEnv();
  if (envRate != null) {
    cachedRate = envRate;
    return cachedRate;
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
  const numeric = String(hbarDisplay).replace(/,/g, "").trim();
  const base = `${groupHbarAmount(numeric)} HBAR`;
  if (usdPerHbar == null || usdPerHbar <= 0) return base;
  const hbarNum = Number(numeric);
  if (Number.isNaN(hbarNum)) return base;
  const usd = hbarNum * usdPerHbar;
  if (usd >= 0.01) return `${base} ($${usd.toFixed(2)})`;
  if (usd > 0) return `${base} ($${usd.toFixed(4)})`;
  return base;
}

/**
 * USD amount for a listing, rounded the same way the buy button shows it.
 * Null when the rate is missing or the HBAR amount is not a number.
 */
export function usdPriceFromHbar(
  hbar: string | null | undefined,
  usdPerHbar: number | null | undefined,
): string | null {
  if (usdPerHbar == null || !(usdPerHbar > 0) || !Number.isFinite(usdPerHbar)) return null;
  const hbarNum = parseHbarAmount(hbar);
  if (!Number.isFinite(hbarNum)) return null;
  const usd = hbarNum * usdPerHbar;
  if (!Number.isFinite(usd)) return null;
  return usd.toFixed(2);
}

/** Visible figure that must match Offer.price, e.g. `5 ℏ (≈ $0.50 USD)`. */
export function listingOfferPriceLabel(
  hbar: string | null | undefined,
  usdPerHbar: number | null | undefined,
): string | null {
  const usd = usdPriceFromHbar(hbar, usdPerHbar);
  if (usd == null) return null;
  return `${formatPriceForDisplay(hbar)} ℏ (≈ $${usd} USD)`;
}

type CoinGeckoPrice = { "hedera-hashgraph"?: { usd?: number } };

/**
 * Server snapshot of the rate `useHbarUsd` displays.
 * Uses NEXT_PUBLIC_HBAR_USD when set, otherwise CoinGecko, cached for a short window.
 * Returns null when neither source is available so callers can skip a USD Offer.
 */
export async function fetchHbarUsdSnapshot(): Promise<number | null> {
  const fromEnv = hbarUsdFromEnv();
  if (fromEnv != null) return fromEnv;
  try {
    const res = await fetch(COINGECKO_URL, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(4000),
      next: { revalidate: HBAR_USD_REVALIDATE_SECONDS },
    } as RequestInit);
    if (!res.ok) return null;
    const data = (await res.json()) as CoinGeckoPrice;
    const usd = data?.["hedera-hashgraph"]?.usd;
    if (typeof usd === "number" && Number.isFinite(usd) && usd > 0) return usd;
    return null;
  } catch {
    return null;
  }
}
