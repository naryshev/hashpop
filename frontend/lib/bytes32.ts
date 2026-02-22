/**
 * Encode a string as bytes32 hex (same as Solidity / EVM).
 * Browser-safe (no Node Buffer).
 */
export function stringToBytes32Hex(id: string): `0x${string}` {
  const hex = Array.from(new TextEncoder().encode(id))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `0x${hex.padEnd(64, "0").slice(0, 64)}` as `0x${string}`;
}

/** Listing or auction id (string or 0x hex) to bytes32 for contract calls. */
export function listingIdToBytes32(listingId: string): `0x${string}` {
  if (listingId.startsWith("0x")) {
    const body = listingId.slice(2).toLowerCase();
    // Accept short/partial hex ids from URL and normalize to bytes32.
    if (/^[0-9a-f]*$/.test(body) && body.length > 0 && body.length <= 64) {
      return (`0x${body.padEnd(64, "0")}`) as `0x${string}`;
    }
  }
  return stringToBytes32Hex(listingId);
}

/**
 * Generate a unique time-based ID for listings/auctions (fits in 32 bytes).
 */
export function generateTimeBasedId(prefix: "lst" | "auc" = "lst"): string {
  const t = Date.now();
  const r = Math.random().toString(36).slice(2, 9);
  return `${prefix}-${t}-${r}`.slice(0, 32);
}
