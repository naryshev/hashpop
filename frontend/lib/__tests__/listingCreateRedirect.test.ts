import { describe, expect, it } from "vitest";
import { listingIdToBytes32, stringToBytes32Hex, generateTimeBasedId } from "../bytes32";
import { decodeListingId, encodeListingIdForUrl } from "../listingUrl";

/**
 * The create flow stores the bytes32 id, then redirects to listingHref(), which
 * prefers the short ascii form. GET /listing/:id re-encodes that short form
 * with the same bytes32 padding. If those diverge, the creator lands on a 404
 * even though sync-listing already wrote the row.
 */
describe("create redirect id", () => {
  it("resolves the public listing path back to the bytes32 sync stored", () => {
    const short = generateTimeBasedId("lst");
    const stored = stringToBytes32Hex(short);
    const pathId = decodeURIComponent(encodeListingIdForUrl(stored));
    expect(listingIdToBytes32(pathId)).toBe(stored);
    expect(listingIdToBytes32(short)).toBe(stored);
  });

  it("keeps an undecodable bytes32 id addressable as itself", () => {
    const stored = `0x${"ab".repeat(32)}` as `0x${string}`;
    expect(decodeListingId(stored)).toBeNull();
    const pathId = decodeURIComponent(encodeListingIdForUrl(stored));
    expect(listingIdToBytes32(pathId)).toBe(stored);
  });
});
