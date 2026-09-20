import { describe, expect, it } from "vitest";
import { Wallet } from "ethers";
import { isAdminAddress, verifyAdminToken } from "../adminAuth";

function encodeToken(payload: unknown): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

async function signedToken(
  wallet: {
    address: string;
    signMessage: (message: string | Uint8Array) => Promise<string>;
  },
  t = Date.now(),
) {
  const address = wallet.address.toLowerCase();
  const signature = await wallet.signMessage(`hashpop.admin.session:${t}`);
  return { address, t, signature };
}

describe("isAdminAddress", () => {
  it("rejects empty addresses", () => {
    expect(isAdminAddress(null, "0xabc")).toBe(false);
    expect(isAdminAddress("", "0xabc")).toBe(false);
  });

  it("matches a comma-separated allowlist case-insensitively", () => {
    const list = "0xAAA, 0xBBB ";
    expect(isAdminAddress("0xaaa", list)).toBe(true);
    expect(isAdminAddress("0xbbb", list)).toBe(true);
    expect(isAdminAddress("0xccc", list)).toBe(false);
  });
});

describe("verifyAdminToken", () => {
  it("rejects a missing token", () => {
    const result = verifyAdminToken({ headers: {} }, { allowlist: "0xabc" });
    expect(result).toEqual({ ok: false, error: "Missing admin token", status: 401 });
  });

  it("rejects malformed base64", () => {
    const result = verifyAdminToken(
      { headers: { "x-admin-token": "%%%not-base64%%%" } },
      { allowlist: "0xabc" },
    );
    expect(result).toEqual({ ok: false, error: "Malformed admin token", status: 401 });
  });

  it("rejects a payload missing required fields", () => {
    const result = verifyAdminToken(
      { headers: { "x-admin-token": encodeToken({ address: "0x1" }) } },
      { allowlist: "0x1" },
    );
    expect(result).toEqual({ ok: false, error: "Malformed admin token", status: 401 });
  });

  it("rejects an expired session", async () => {
    const wallet = Wallet.createRandom();
    const t = Date.now() - 25 * 60 * 60 * 1000;
    const token = await signedToken(wallet, t);
    const result = verifyAdminToken(
      { headers: { "x-admin-token": encodeToken(token) } },
      { allowlist: wallet.address, now: Date.now() },
    );
    expect(result).toEqual({ ok: false, error: "Admin session expired", status: 401 });
  });

  it("rejects a future timestamp", async () => {
    const wallet = Wallet.createRandom();
    const t = Date.now() + 60_000;
    const token = await signedToken(wallet, t);
    const result = verifyAdminToken(
      { headers: { "x-admin-token": encodeToken(token) } },
      { allowlist: wallet.address, now: Date.now() },
    );
    expect(result).toEqual({ ok: false, error: "Admin session expired", status: 401 });
  });

  it("rejects an invalid signature", async () => {
    const wallet = Wallet.createRandom();
    const t = Date.now();
    const result = verifyAdminToken(
      {
        headers: {
          "x-admin-token": encodeToken({
            address: wallet.address.toLowerCase(),
            t,
            signature: "0xdead",
          }),
        },
      },
      { allowlist: wallet.address, now: t },
    );
    expect(result).toEqual({ ok: false, error: "Invalid admin signature", status: 401 });
  });

  it("rejects a signature that does not match the claimed address", async () => {
    const signer = Wallet.createRandom();
    const claimed = Wallet.createRandom();
    const t = Date.now();
    const signature = await signer.signMessage(`hashpop.admin.session:${t}`);
    const result = verifyAdminToken(
      {
        headers: {
          "x-admin-token": encodeToken({
            address: claimed.address.toLowerCase(),
            t,
            signature,
          }),
        },
      },
      { allowlist: `${signer.address},${claimed.address}`, now: t },
    );
    expect(result).toEqual({ ok: false, error: "Admin signature mismatch", status: 401 });
  });

  it("rejects a valid signature from a wallet that is not allowlisted", async () => {
    const wallet = Wallet.createRandom();
    const token = await signedToken(wallet);
    const result = verifyAdminToken(
      { headers: { "x-admin-token": encodeToken(token) } },
      { allowlist: Wallet.createRandom().address, now: Date.now() },
    );
    expect(result).toEqual({ ok: false, error: "Not authorised", status: 403 });
  });

  it("accepts a signed session for an allowlisted wallet", async () => {
    const wallet = Wallet.createRandom();
    const t = Date.now();
    const token = await signedToken(wallet, t);
    const result = verifyAdminToken(
      { headers: { "x-admin-token": encodeToken(token) } },
      { allowlist: wallet.address, now: t },
    );
    expect(result).toEqual({ ok: true, address: wallet.address.toLowerCase() });
  });
});
