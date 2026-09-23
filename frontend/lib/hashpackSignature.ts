export const MISSING_CHALLENGE_ERROR =
  "Admin sign-in challenge was missing. Refresh the page and try again.";

export function adminSessionMessage(t: number): string {
  if (!Number.isFinite(t)) {
    throw new Error(MISSING_CHALLENGE_ERROR);
  }
  const message = `hashpop.admin.session:${t}`;
  assertSignableChallenge(message);
  return message;
}

/** Refuse blank, missing, or NUL challenges before HashPack is asked to sign. */
export function assertSignableChallenge(message: unknown): asserts message is string {
  if (typeof message !== "string" || message.trim().length === 0 || message.includes("\0")) {
    throw new Error(MISSING_CHALLENGE_ERROR);
  }
}

function bytesToHex(bytes: ArrayLike<number>): string {
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i]!.toString(16).padStart(2, "0");
  }
  return hex;
}

function asHexSignature(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    return trimmed.startsWith("0x") || trimmed.startsWith("0X") ? trimmed : `0x${trimmed}`;
  }
  if (value instanceof Uint8Array) {
    if (value.length === 0) return null;
    return `0x${bytesToHex(value)}`;
  }
  if (Array.isArray(value) && value.length > 0 && value.every((n) => typeof n === "number")) {
    return `0x${bytesToHex(value)}`;
  }
  if (value && typeof value === "object" && "signature" in value) {
    return asHexSignature((value as { signature: unknown }).signature);
  }
  return null;
}

/**
 * HashConnect 3 `signMessages` resolves to `SignerSignature[]`
 * (`{ signature: Uint8Array }`), not a hex string.
 */
export function extractHashpackSignature(signResult: unknown): string | null {
  if (Array.isArray(signResult)) {
    for (const item of signResult) {
      const hex = asHexSignature(item);
      if (hex) return hex;
    }
    return null;
  }
  if (signResult && typeof signResult === "object" && "signedMessages" in signResult) {
    const signed = (signResult as { signedMessages?: unknown }).signedMessages;
    if (Array.isArray(signed)) return extractHashpackSignature(signed);
  }
  return asHexSignature(signResult);
}

type HashpackMessageSigner = {
  signMessages: (accountId: string, message: string) => Promise<unknown>;
};

/**
 * `signMessages(accountId, message)` takes a plain string. Passing `[message]`
 * makes HashConnect `Buffer.from` the array, which is a single 0x00 byte.
 * HashPack still opens the prompt and renders that byte as a blank message.
 */
export async function signAdminSession(
  signer: HashpackMessageSigner,
  accountId: string,
  t: number,
): Promise<string> {
  const message = adminSessionMessage(t);
  assertSignableChallenge(message);
  const signResult = await signer.signMessages(accountId, message);
  const signature = extractHashpackSignature(signResult);
  if (!signature) {
    throw new Error("Could not get a signature from your wallet.");
  }
  return signature;
}
