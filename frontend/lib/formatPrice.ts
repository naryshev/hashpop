/**
 * Wei (18 decimals) and tinybar (8 decimals) to HBAR strings.
 * Display amounts use Intl.NumberFormat grouping ("1250" → "1,250").
 * The plain helpers stay ungrouped for math, inputs, and schema.org price.
 */

const hbarIntegerFormat = new Intl.NumberFormat("en-US", {
  useGrouping: true,
  maximumFractionDigits: 0,
});

/** Thin space (U+2009). A regular space in Plex is a full digit and reads as a hole before ℏ. */
export const HBAR_GAP = "\u2009";

/** Formatted amount plus ℏ, separated by a thin space. */
export function withHbarGlyph(amount: string): string {
  return `${amount}${HBAR_GAP}\u210F`;
}

/**
 * Group the integer part of an HBAR amount. The fraction is kept as written
 * so tinybar and wei remainders are not rounded.
 */
export function groupHbarAmount(raw: string): string {
  const s = raw.trim().replace(/,/g, "");
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(s);
  if (!match) return raw.trim();
  const sign = match[1] ?? "";
  const whole = (match[2] ?? "0").replace(/^0+(?=\d)/, "") || "0";
  const frac = match[3];
  let grouped = whole;
  try {
    grouped = hbarIntegerFormat.format(BigInt(whole));
  } catch {
    grouped = whole;
  }
  if (frac == null || frac === "") return `${sign}${grouped}`;
  return `${sign}${grouped}.${frac}`;
}

function hbarFromWei(priceWei: string | number): string {
  const str = String(priceWei).trim().replace(/,/g, "");
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

function hbarFromTinybar(tinybar: string | number): string {
  const str = String(tinybar).trim().replace(/,/g, "");
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

function plainContractAmount(rawAmount: string | number): string {
  const s = String(rawAmount).trim().replace(/,/g, "");
  if (!s) return "0";
  try {
    const n = BigInt(s);
    // Legacy listings used wei (1 HBAR = 1e18). Current flows use tinybar (1 HBAR = 1e8).
    if (n >= 10n ** 15n) return hbarFromWei(s);
    return hbarFromTinybar(s);
  } catch {
    return "0";
  }
}

/** Wei (18 decimals) to a grouped HBAR display string. */
export function formatPriceWeiToHbar(priceWei: string | number): string {
  return groupHbarAmount(hbarFromWei(priceWei));
}

/** Tinybar (8 decimals) to a grouped HBAR display string. */
export function formatTinybarToHbar(tinybar: string | number): string {
  return groupHbarAmount(hbarFromTinybar(tinybar));
}

/**
 * Contract amount to a grouped HBAR display string.
 * Supports legacy wei-priced listings and tinybar-priced listings.
 */
export function formatContractAmountToHbar(rawAmount: string | number): string {
  return groupHbarAmount(plainContractAmount(rawAmount));
}

/** Ungrouped HBAR digits. Safe for Number(), form inputs, and schema.org Offer.price. */
export function hbarAmountPlain(price: string | null | undefined): string {
  if (price == null || price === "") return "0";
  const s = String(price).trim().replace(/,/g, "");
  if (!s) return "0";
  if (s.length > 15 && /^\d+$/.test(s)) return hbarFromWei(s);
  return s;
}

/** Numeric HBAR, ignoring grouping commas. */
export function parseHbarAmount(price: string | null | undefined): number {
  return Number(hbarAmountPlain(price));
}

/** Display price: API may return HBAR (e.g. "84") or legacy wei; groups thousands. */
export function formatPriceForDisplay(price: string | null | undefined): string {
  return groupHbarAmount(hbarAmountPlain(price));
}
