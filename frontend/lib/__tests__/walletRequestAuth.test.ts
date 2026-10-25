import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { canonicalRequestPath, canonicalWalletAuthMessage } from "../walletAuthMessage";
import { authorizedFetch } from "../walletRequestAuth";

const libDir = path.resolve(process.cwd(), "lib");

describe("wallet write signatures", () => {
  it("builds the canonical message the backend verifies", () => {
    expect(
      canonicalWalletAuthMessage({
        accountId: "0.0.5",
        method: "patch",
        path: "/api/listing/abc",
        bodyHash: "aa",
        issuedAt: 10,
        nonce: "nonce-1",
      }),
    ).toBe(
      [
        "hashpop.wallet.v1",
        "account:0.0.5",
        "method:PATCH",
        "path:/api/listing/abc",
        "body:aa",
        "iat:10",
        "nonce:nonce-1",
      ].join("\n"),
    );
  });

  it("signs the path and query without dropping the search string", () => {
    expect(canonicalRequestPath("http://localhost:4000/api/wishlist?address=0xabc&itemId=1")).toBe(
      "/api/wishlist?address=0xabc&itemId=1",
    );
  });

  it("asks HashConnect for a string message and sends the signature headers", async () => {
    const signMessages = vi.fn(async () => ({ signature: new Uint8Array([1, 2, 3]) }));
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    try {
      await authorizedFetch(
        "http://localhost:4000/api/listing/abc",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sellerAddress: "0x1", title: "Hat" }),
        },
        { accountId: "0.0.5", signer: { signMessages } },
      );
      expect(signMessages).toHaveBeenCalledTimes(1);
      expect(signMessages.mock.calls[0][0]).toBe("0.0.5");
      const message = signMessages.mock.calls[0][1] as string;
      expect(typeof message).toBe("string");
      expect(message).toContain("method:PATCH");
      expect(message).toContain("path:/api/listing/abc");
      expect(message).toContain("account:0.0.5");
      const headers = fetchMock.mock.calls[0][1].headers as Headers;
      expect(headers.get("x-hashpop-account")).toBe("0.0.5");
      expect(headers.get("x-hashpop-signature")).toMatch(/^0x010203$/);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("does not put HashConnect on the first-load import graph", () => {
    const auth = readFileSync(path.join(libDir, "walletRequestAuth.ts"), "utf8");
    const message = readFileSync(path.join(libDir, "walletAuthMessage.ts"), "utf8");
    const wallet = readFileSync(path.join(libDir, "hashpackWallet.tsx"), "utf8");
    expect(auth).not.toMatch(/from\s+["']hashconnect["']/);
    expect(auth).not.toMatch(/import\s*\(\s*["']hashconnect["']\s*\)/);
    expect(message).not.toMatch(/from\s+["']hashconnect["']/);
    expect(message).not.toMatch(/import\s*\(\s*["']hashconnect["']\s*\)/);
    expect(wallet).not.toMatch(/import\s+(?!type\b)[^;]*from\s+["']hashconnect["']/);
    expect(wallet).toContain('import("hashconnect")');
    expect(wallet).toContain("export async function ensureHashpackClient");
  });
});
