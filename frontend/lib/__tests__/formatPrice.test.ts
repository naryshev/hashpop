import { describe, it, expect } from "vitest";
import {
  formatPriceWeiToHbar,
  formatTinybarToHbar,
  formatContractAmountToHbar,
  formatPriceForDisplay,
} from "../formatPrice";

describe("formatPriceWeiToHbar", () => {
  it("returns '0' for empty/zero inputs", () => {
    expect(formatPriceWeiToHbar("0")).toBe("0");
    expect(formatPriceWeiToHbar("")).toBe("0");
    expect(formatPriceWeiToHbar("0x")).toBe("0");
  });

  it("converts 1e18 wei to 1 HBAR", () => {
    expect(formatPriceWeiToHbar("1000000000000000000")).toBe("1");
  });

  it("converts fractional amounts", () => {
    expect(formatPriceWeiToHbar("500000000000000000")).toBe("0.5");
  });

  it("handles large values", () => {
    expect(formatPriceWeiToHbar("100000000000000000000")).toBe("100");
  });

  it("returns '0' for invalid input", () => {
    expect(formatPriceWeiToHbar("not-a-number")).toBe("0");
  });
});

describe("formatTinybarToHbar", () => {
  it("returns '0' for zero", () => {
    expect(formatTinybarToHbar("0")).toBe("0");
  });

  it("converts 1e8 tinybar to 1 HBAR", () => {
    expect(formatTinybarToHbar("100000000")).toBe("1");
  });

  it("converts fractional amounts", () => {
    expect(formatTinybarToHbar("50000000")).toBe("0.5");
  });
});

describe("formatContractAmountToHbar", () => {
  it("routes large values through wei conversion", () => {
    // >= 1e15 is treated as wei
    expect(formatContractAmountToHbar("1000000000000000000")).toBe("1");
  });

  it("routes small values through tinybar conversion", () => {
    // < 1e15 is treated as tinybar
    expect(formatContractAmountToHbar("100000000")).toBe("1");
  });

  it("returns '0' for empty input", () => {
    expect(formatContractAmountToHbar("")).toBe("0");
  });
});

describe("formatPriceForDisplay", () => {
  it("returns '0' for null/undefined", () => {
    expect(formatPriceForDisplay(null)).toBe("0");
    expect(formatPriceForDisplay(undefined)).toBe("0");
  });

  it("returns string as-is for normal HBAR values", () => {
    expect(formatPriceForDisplay("84")).toBe("84");
  });

  it("converts long numeric strings as wei", () => {
    expect(formatPriceForDisplay("1000000000000000000")).toBe("1");
  });
});
