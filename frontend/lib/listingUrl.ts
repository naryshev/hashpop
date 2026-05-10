/**
 * URL helpers for listings. The backend accepts both the canonical bytes32 hex
 * form (`0x…66 chars`) and the original ascii form (e.g. `lst-1717123456-abc`).
 * Sharing the bytes32 form produces ugly 80-char URLs; this helper prefers the
 * ascii form whenever the listing id is recoverable.
 */

/**
 * Decode a bytes32-padded listing id back to its original ascii string,
 * mirroring the encoding done by `stringToBytes32Hex`. Returns null if the id
 * doesn't decode to a printable ascii listing identifier.
 */
export function decodeListingId(id: string): string | null {
  if (!id) return null;
  if (!id.startsWith("0x")) return id; // already short / ascii
  if (id.length !== 66) return null;
  try {
    const hex = id.slice(2).replace(/0+$/, "");
    if (hex.length % 2) return null;
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
    }
    const str = new TextDecoder().decode(bytes);
    return /^[\x20-\x7e]+$/.test(str) ? str : null;
  } catch {
    return null;
  }
}

/**
 * Build the canonical, shareable URL path for a listing. Prefers the short
 * ascii form when decodable; falls back to the bytes32 form so legacy or
 * non-string-derived ids still resolve.
 */
export function listingHref(id: string): string {
  return `/listing/${encodeListingIdForUrl(id)}`;
}

/**
 * URL-safe encoded listing id, preferring the short ascii form. Use for any
 * URL that embeds a listing id outside the `/listing/` route — e.g.
 * `/purchase-success/<id>` or `/create?duplicate=<id>`.
 */
export function encodeListingIdForUrl(id: string): string {
  const decoded = decodeListingId(id);
  return encodeURIComponent(decoded ?? id);
}

/**
 * Display-friendly short form for a listing id — used when rendering inside
 * UI rather than building URLs. Falls back to a truncated hex if the id
 * doesn't decode cleanly.
 */
export function formatListingId(id: string): string {
  const decoded = decodeListingId(id);
  if (decoded) return decoded;
  if (id.startsWith("0x") && id.length === 66) return `${id.slice(0, 10)}…`;
  return id;
}
