/**
 * Wei (18 decimals) to HBAR number string for display.
 */
export function formatPriceWeiToHbar(priceWei: string | number): string {
  const str = String(priceWei).trim();
  if (!str || str === "0" || str === "0x") return "0";
  try {
    const wei = BigInt(str);
    if (wei === 0n) return "0";
    const div = 10n ** 18n;
    const whole = wei / div;
    const frac = wei % div;
    const fracStr = frac.toString().padStart(18, "0").slice(0, 18).replace(/0+$/, "") || "0";
    if (fracStr === "0") return whole.toString();
    return `${whole}.${fracStr}`;
  } catch {
    return "0";
  }
}

/** Tinybar (8 decimals) to HBAR number string for display. */
export function formatTinybarToHbar(tinybar: string | number): string {
  const str = String(tinybar).trim();
  if (!str || str === "0" || str === "0x") return "0";
  try {
    const tb = BigInt(str);
    if (tb === 0n) return "0";
    const div = 10n ** 8n;
    const whole = tb / div;
    const frac = tb % div;
    const fracStr = frac.toString().padStart(8, "0").replace(/0+$/, "") || "0";
    if (fracStr === "0") return whole.toString();
    return `${whole}.${fracStr}`;
  } catch {
    return "0";
  }
}

/**
 * Contract amount to HBAR display.
 * Supports legacy wei-priced listings and tinybar-priced listings.
 */
export function formatContractAmountToHbar(rawAmount: string | number): string {
  const s = String(rawAmount).trim();
  if (!s) return "0";
  try {
    const n = BigInt(s);
    // Legacy listings used wei (1 HBAR = 1e18). Current flows use tinybar (1 HBAR = 1e8).
    if (n >= 10n ** 15n) return formatPriceWeiToHbar(s);
    return formatTinybarToHbar(s);
  } catch {
    return "0";
  }
}

/** Display price: API may return HBAR (e.g. "84") or legacy wei; normalizes to HBAR string. */
export function formatPriceForDisplay(price: string | null | undefined): string {
  if (price == null || price === "") return "0";
  const s = String(price).trim();
  if (!s) return "0";
  if (s.length > 15 && /^\d+$/.test(s)) return formatPriceWeiToHbar(s);
  return s;
}
