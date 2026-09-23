import { describe, expect, it, vi } from "vitest";
import { extractHashpackSignature, signAdminSession } from "../hashpackSignature";

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
});
