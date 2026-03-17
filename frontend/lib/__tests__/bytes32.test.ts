import { describe, it, expect } from "vitest";
import { stringToBytes32Hex, listingIdToBytes32, generateTimeBasedId } from "../bytes32";

describe("stringToBytes32Hex", () => {
  it("encodes a short string to 64-char hex", () => {
    const result = stringToBytes32Hex("abc");
    expect(result).toMatch(/^0x[0-9a-f]{64}$/);
    // 'a'=61, 'b'=62, 'c'=63 in hex
    expect(result.startsWith("0x616263")).toBe(true);
  });

  it("pads short strings with zeros", () => {
    const result = stringToBytes32Hex("a");
    expect(result).toBe("0x" + "61" + "0".repeat(62));
  });

  it("truncates strings longer than 32 bytes", () => {
    const long = "a".repeat(64);
    const result = stringToBytes32Hex(long);
    expect(result.length).toBe(66); // 0x + 64 hex chars
  });
});

describe("listingIdToBytes32", () => {
  it("pads short hex IDs to bytes32", () => {
    const result = listingIdToBytes32("0xabc");
    expect(result).toBe("0x" + "abc" + "0".repeat(61));
  });

  it("passes through full-length hex", () => {
    const full = "0x" + "ab".repeat(32);
    expect(listingIdToBytes32(full)).toBe(full);
  });

  it("encodes non-hex strings via stringToBytes32Hex", () => {
    const result = listingIdToBytes32("lst-12345");
    expect(result).toMatch(/^0x[0-9a-f]{64}$/);
  });
});

describe("generateTimeBasedId", () => {
  it("generates an ID with default 'lst' prefix", () => {
    const id = generateTimeBasedId();
    expect(id.startsWith("lst-")).toBe(true);
  });

  it("generates an ID with 'auc' prefix", () => {
    const id = generateTimeBasedId("auc");
    expect(id.startsWith("auc-")).toBe(true);
  });

  it("generates unique IDs", () => {
    const a = generateTimeBasedId();
    const b = generateTimeBasedId();
    expect(a).not.toBe(b);
  });

  it("does not exceed 32 characters", () => {
    expect(generateTimeBasedId().length).toBeLessThanOrEqual(32);
  });
});
