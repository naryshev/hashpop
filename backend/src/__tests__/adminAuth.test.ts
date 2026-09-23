import { generateKeyPairSync, sign as signEd25519 } from "node:crypto";
import { describe, expect, it } from "vitest";
import { SigningKey, Wallet, getBytes, hexlify, keccak256 } from "ethers";
import {
  authenticateAdmin,
  isAdminAddress,
  parseMirrorAccountKey,
  prefixHederaMessage,
  verifyAdminToken,
  verifyHederaSignedMessage,
} from "../adminAuth";

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

  it("expands a Hedera 0.0.x allowlist entry to the long-zero-padded EVM alias", () => {
    const evm = "0x000000000000000000000000000000000093ddbb";
    expect(isAdminAddress(evm, "0.0.9690555")).toBe(true);
    expect(isAdminAddress(evm.toUpperCase(), "0.0.9690555")).toBe(true);
    expect(isAdminAddress("0x93ddbb", "0.0.9690555")).toBe(true);
    expect(isAdminAddress("0.0.9690555", "0.0.9690555")).toBe(true);
    expect(isAdminAddress("0x000000000000000000000000000000000093ddbc", "0.0.9690555")).toBe(false);
  });

  it("accepts mixed Hedera and 0x entries in a comma-separated list", () => {
    const list = "0.0.9690555, 0xAAA";
    expect(isAdminAddress("0x000000000000000000000000000000000093ddbb", list)).toBe(true);
    expect(isAdminAddress("0xaaa", list)).toBe(true);
    expect(isAdminAddress("0xbbb", list)).toBe(false);
  });

  it("keeps 0x-only allowlists working", () => {
    const evm = "0x000000000000000000000000000000000093ddbb";
    expect(isAdminAddress(evm, evm)).toBe(true);
    expect(isAdminAddress("0x93ddbb", evm)).toBe(true);
    expect(isAdminAddress(evm, "0x93DDBB")).toBe(true);
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

describe("Hedera admin signatures", () => {
  it("parses mirror account keys", () => {
    const key = "500e4b92ce2ded94f35937e22321c9e2d67cab0110c58d7b479b1894f9d8ba23";
    expect(parseMirrorAccountKey({ _type: "ED25519", key })).toEqual({
      type: "ED25519",
      key,
    });
    expect(parseMirrorAccountKey({ _type: "ED25519", key: `1220${key}` })).toEqual({
      type: "ED25519",
      key,
    });
    const compressed = `02${"ab".repeat(32)}`;
    expect(parseMirrorAccountKey({ _type: "ECDSA_SECP256K1", key: compressed })).toEqual({
      type: "ECDSA_SECP256K1",
      key: compressed,
    });
    expect(parseMirrorAccountKey({ _type: "THRESHOLD", key })).toBeNull();
  });

  it("accepts an ED25519 HIP-820 signature for the claimed account", async () => {
    const { publicKey, privateKey } = generateKeyPairSync("ed25519");
    const der = publicKey.export({ format: "der", type: "spki" });
    const raw = Buffer.from(der).subarray(der.length - 32);
    const address = "0x000000000000000000000000000000000093ddbb";
    const t = 1_700_000_000_000;
    const message = `hashpop.admin.session:${t}`;
    const signature = signEd25519(null, Buffer.from(prefixHederaMessage(message)), privateKey);
    const token = { address, t, signature: `0x${signature.toString("hex")}` };

    const result = await authenticateAdmin(
      { headers: { "x-admin-token": encodeToken(token) } },
      {
        allowlist: "0.0.9690555",
        now: t,
        fetchKey: async () => ({ type: "ED25519", key: raw.toString("hex") }),
      },
    );
    expect(result).toEqual({ ok: true, address });
    expect(
      verifyHederaSignedMessage(message, token.signature, {
        type: "ED25519",
        key: raw.toString("hex"),
      }),
    ).toBe(true);
  });

  it("accepts an ECDSA HIP-820 signature checked against the account key", async () => {
    const wallet = Wallet.createRandom();
    const address = wallet.address.toLowerCase();
    const t = 1_700_000_000_000;
    const message = `hashpop.admin.session:${t}`;
    const digest = keccak256(Buffer.from(prefixHederaMessage(message)));
    const signed = wallet.signingKey.sign(digest);
    const compact = Buffer.concat([
      Buffer.from(getBytes(signed.r)),
      Buffer.from(getBytes(signed.s)),
    ]);
    const compressed = SigningKey.computePublicKey(wallet.signingKey.publicKey, true);
    const token = { address, t, signature: hexlify(compact) };

    const result = await authenticateAdmin(
      { headers: { "x-admin-token": encodeToken(token) } },
      {
        allowlist: address,
        now: t,
        fetchKey: async () => ({
          type: "ECDSA_SECP256K1",
          key: compressed.slice(2),
        }),
      },
    );
    expect(result).toEqual({ ok: true, address });
  });

  it("rejects a Hedera signature that does not match the account key", async () => {
    const { privateKey } = generateKeyPairSync("ed25519");
    const other = generateKeyPairSync("ed25519");
    const otherDer = other.publicKey.export({ format: "der", type: "spki" });
    const otherRaw = Buffer.from(otherDer).subarray(otherDer.length - 32);
    const address = "0x000000000000000000000000000000000093ddbb";
    const t = 1_700_000_000_000;
    const message = `hashpop.admin.session:${t}`;
    const signature = signEd25519(null, Buffer.from(prefixHederaMessage(message)), privateKey);
    const token = { address, t, signature: `0x${signature.toString("hex")}` };

    const result = await authenticateAdmin(
      { headers: { "x-admin-token": encodeToken(token) } },
      {
        allowlist: address,
        now: t,
        fetchKey: async () => ({ type: "ED25519", key: otherRaw.toString("hex") }),
      },
    );
    expect(result).toEqual({ ok: false, error: "Invalid admin signature", status: 401 });
  });

  it("does not look up a key for a wallet that is not allowlisted", async () => {
    let fetched = false;
    const result = await authenticateAdmin(
      {
        headers: {
          "x-admin-token": encodeToken({
            address: "0x000000000000000000000000000000000093ddbb",
            t: 1_700_000_000_000,
            signature: "0x11",
          }),
        },
      },
      {
        allowlist: "0xabc",
        now: 1_700_000_000_000,
        fetchKey: async () => {
          fetched = true;
          return null;
        },
      },
    );
    expect(fetched).toBe(false);
    expect(result).toEqual({ ok: false, error: "Not authorised", status: 403 });
  });
});
