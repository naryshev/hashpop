import { describe, expect, it, vi } from "vitest";
import {
  MISSING_CHALLENGE_ERROR,
  extractHashpackSignature,
  signAdminSession,
} from "../hashpackSignature";

describe("extractHashpackSignature", () => {
  it("reads raw signature bytes from a HashConnect SignerSignature", () => {
    const result = [{ signature: new Uint8Array([0xab, 0xcd, 0x01]), publicKey: {} }];
    expect(extractHashpackSignature(result)).toBe("0xabcd01");
  });

  it("accepts a hex string returned directly or under signedMessages", () => {
    expect(extractHashpackSignature(["0xabc"])).toBe("0xabc");
    expect(extractHashpackSignature({ signedMessages: ["0xdef"] })).toBe("0xdef");
    expect(extractHashpackSignature("0x123")).toBe("0x123");
  });

  it("returns null when the wallet result has no signature bytes", () => {
    expect(extractHashpackSignature(null)).toBeNull();
    expect(extractHashpackSignature([])).toBeNull();
    expect(extractHashpackSignature([{}])).toBeNull();
    expect(extractHashpackSignature([{ signature: new Uint8Array() }])).toBeNull();
  });
});

describe("signAdminSession", () => {
  it("asks HashConnect to sign the plain session string, not an array", async () => {
    const signMessages = vi.fn(async () => [{ signature: new Uint8Array([1, 2, 3]) }]);
    const signature = await signAdminSession({ signMessages }, "0.0.9690555", 1_700_000_000_000);
    expect(signMessages).toHaveBeenCalledWith("0.0.9690555", "hashpop.admin.session:1700000000000");
    expect(signature).toBe("0x010203");
  });

  it("throws the wallet error when HashConnect returns no signature string", async () => {
    const signMessages = vi.fn(async () => [{ signature: new Uint8Array() }]);
    await expect(signAdminSession({ signMessages }, "0.0.1", 1)).rejects.toThrow(
      "Could not get a signature from your wallet.",
    );
  });

  it("does not open HashPack when the challenge timestamp is missing", async () => {
    const signMessages = vi.fn();
    await expect(signAdminSession({ signMessages }, "0.0.1", Number.NaN)).rejects.toThrow(
      MISSING_CHALLENGE_ERROR,
    );
    await expect(
      signAdminSession({ signMessages }, "0.0.1", undefined as unknown as number),
    ).rejects.toThrow(MISSING_CHALLENGE_ERROR);
    expect(signMessages).not.toHaveBeenCalled();
  });
});

describe("HashConnect message payload", () => {
  it("turns a one-element string array into a NUL byte, which HashPack shows as a blank prompt", () => {
    const challenge = "hashpop.admin.session:1700000000000";
    // hashconnect signMessages does Buffer.from(argument) and sends that UTF-8 string.
    expect(Buffer.from(challenge).toString()).toBe(challenge);
    expect(Buffer.from([challenge] as unknown as number[]).toString()).toBe("\0");
  });
});
