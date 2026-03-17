import { describe, it, expect } from "vitest";

/**
 * Pure-function tests for CORS origin helpers.
 * These functions are extracted from src/index.ts for testability.
 */

function isLocalNetworkOrigin(origin: string): boolean {
  try {
    const u = new URL(origin);
    const host = u.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1") return true;
    if (host.startsWith("192.168.") || host.startsWith("10.")) return true;
    if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)) return true;
    return false;
  } catch {
    return false;
  }
}

describe("isLocalNetworkOrigin", () => {
  it("allows localhost", () => {
    expect(isLocalNetworkOrigin("http://localhost:3000")).toBe(true);
  });

  it("allows 127.0.0.1", () => {
    expect(isLocalNetworkOrigin("http://127.0.0.1:4000")).toBe(true);
  });

  it("allows 192.168.x.x", () => {
    expect(isLocalNetworkOrigin("http://192.168.1.50:3000")).toBe(true);
  });

  it("allows 10.x.x.x", () => {
    expect(isLocalNetworkOrigin("http://10.0.0.5:3000")).toBe(true);
  });

  it("allows 172.16-31.x.x", () => {
    expect(isLocalNetworkOrigin("http://172.16.0.1:3000")).toBe(true);
    expect(isLocalNetworkOrigin("http://172.31.255.255:3000")).toBe(true);
  });

  it("rejects public origins", () => {
    expect(isLocalNetworkOrigin("https://example.com")).toBe(false);
    expect(isLocalNetworkOrigin("https://hashpop.vercel.app")).toBe(false);
  });

  it("rejects invalid URLs", () => {
    expect(isLocalNetworkOrigin("not-a-url")).toBe(false);
  });
});
