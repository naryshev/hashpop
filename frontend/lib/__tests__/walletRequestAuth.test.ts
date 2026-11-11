import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { canonicalRequestPath, canonicalWalletAuthMessage } from "../walletAuthMessage";
import {
  authorizedFetch,
  fetchWithWalletSession,
  requiresFreshSignature,
} from "../walletRequestAuth";
import { readWalletAuthToken, writeWalletAuthToken } from "../walletAuthSession";

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
    const signMessages = vi.fn(async (_accountId: string, _message: string) => ({
      signature: new Uint8Array([1, 2, 3]),
    }));
    const fetchMock = vi.fn(
      async (_input: string, _init?: RequestInit) => new Response("{}", { status: 200 }),
    );
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
      const init = fetchMock.mock.calls[0][1];
      if (!init || !(init.headers instanceof Headers)) {
        throw new Error("expected fetch headers");
      }
      expect(init.headers.get("x-hashpop-account")).toBe("0.0.5");
      expect(init.headers.get("x-hashpop-signature")).toMatch(/^0x010203$/);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("keeps a fresh signature on high-value writes and a session everywhere else", () => {
    expect(requiresFreshSignature("PATCH", "http://localhost:4000/api/listing/abc")).toBe(true);
    expect(requiresFreshSignature("POST", "/api/sync-cancel")).toBe(true);
    expect(requiresFreshSignature("POST", "/api/listing/abc/cancel-offchain")).toBe(true);
    expect(requiresFreshSignature("POST", "/api/sync-price-update")).toBe(true);
    expect(requiresFreshSignature("POST", "/api/listing/abc/shipping-address")).toBe(true);
    expect(requiresFreshSignature("PATCH", "/api/user/0xabc/profile")).toBe(true);
    expect(requiresFreshSignature("GET", "/api/messages/inbox?address=0xabc")).toBe(false);
    expect(requiresFreshSignature("POST", "/api/messages")).toBe(false);
    expect(requiresFreshSignature("POST", "/api/sync-purchase")).toBe(false);
    expect(requiresFreshSignature("GET", "/api/listings")).toBe(false);
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

describe("wallet session recovery", () => {
  it("drops a rejected session token, mints one new token, and retries once", async () => {
    writeWalletAuthToken({ token: "stale", accountId: "0.0.5", expiresAt: Date.now() + 3_600_000 });
    const signMessages = vi.fn(async () => ({ signature: new Uint8Array([9]) }));
    const sent: Array<{ url: string; session: string | null }> = [];
    const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      sent.push({ url: input, session: headers.get("x-hashpop-session") });
      if (input.endsWith("/api/wallet/session")) {
        return new Response(
          JSON.stringify({ token: "fresh", expiresAt: Date.now() + 86_400_000 }),
          {
            status: 200,
          },
        );
      }
      return new Response("{}", {
        status: headers.get("x-hashpop-session") === "fresh" ? 200 : 401,
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    try {
      const res = await fetchWithWalletSession(
        "http://localhost:4000/api/messages",
        { method: "POST", body: JSON.stringify({ body: "hi" }) },
        { accountId: "0.0.5", signer: { signMessages } },
      );
      expect(res.status).toBe(200);
      expect(signMessages).toHaveBeenCalledTimes(1);
      expect(sent.map((call) => call.session)).toEqual(["stale", null, "fresh"]);
      expect(readWalletAuthToken("0.0.5")).toBe("fresh");
    } finally {
      vi.unstubAllGlobals();
      window.localStorage.clear();
    }
  });

  it("returns the second 401 instead of looping", async () => {
    writeWalletAuthToken({ token: "stale", accountId: "0.0.5", expiresAt: Date.now() + 3_600_000 });
    const signMessages = vi.fn(async () => ({ signature: new Uint8Array([9]) }));
    const fetchMock = vi.fn(async (input: string) => {
      if (input.endsWith("/api/wallet/session")) {
        return new Response(
          JSON.stringify({ token: "also-bad", expiresAt: Date.now() + 86_400_000 }),
          {
            status: 200,
          },
        );
      }
      return new Response("{}", { status: 401 });
    });
    vi.stubGlobal("fetch", fetchMock);
    try {
      const res = await fetchWithWalletSession(
        "http://localhost:4000/api/messages/inbox",
        {},
        { accountId: "0.0.5", signer: { signMessages } },
      );
      expect(res.status).toBe(401);
      expect(fetchMock).toHaveBeenCalledTimes(3);
    } finally {
      vi.unstubAllGlobals();
      window.localStorage.clear();
    }
  });
});
