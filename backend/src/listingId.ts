/**
 * One listing-id canonicalizer for the wallet guard and the HTTP handlers.
 * Optional `0x` plus exactly 64 hex digits is the same id either way.
 * Short ascii URL ids (`lst-…`) keep the historical bytes32 encoding.
 * Anything else is malformed and must be rejected (400) before a write.
 */
export function canonicalListingId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const id = raw.trim();
  if (!id || id.length > 80) return null;

  const prefixed = id.length >= 2 && id.slice(0, 2).toLowerCase() === "0x";
  const bare = prefixed ? id.slice(2) : id;
  const isBytes32 =
    /^[0-9a-fA-F]{64}$/.test(bare) &&
    ((prefixed && id.length === 66) || (!prefixed && id.length === 64));
  if (isBytes32) return `0x${bare.toLowerCase()}`;

  // `0x` with the wrong length, or a hex string that is not 64 digits,
  // must not be padded or utf8-hashed into a different key.
  if (prefixed) return null;
  if (/^[0-9a-fA-F]+$/.test(id)) return null;
  if (id.length > 32) return null;
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id)) return null;
  return listingIdToBytes32(id);
}

/** Convert a short ascii listing id to the bytes32 key the contracts use. */
export function listingIdToBytes32(id: string): string {
  if (!id || typeof id !== "string") return `0x${"0".repeat(64)}`;
  if (id.startsWith("0x") || id.startsWith("0X")) {
    const body = id.slice(2).toLowerCase();
    if (/^[0-9a-f]*$/.test(body) && body.length > 0 && body.length <= 64) {
      return `0x${body.padEnd(64, "0")}`;
    }
  }
  const hex = Buffer.from(id, "utf8").toString("hex").padEnd(64, "0").slice(0, 64);
  return `0x${hex}`;
}
