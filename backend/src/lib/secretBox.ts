import crypto from "crypto";

/**
 * Application-level encryption for PII (shipping addresses). AES-256-GCM
 * with a random 96-bit IV per record; the key lives only in the app
 * environment (SHIPPING_ADDRESS_KEY), so a database dump on its own leaks
 * nothing.
 *
 * SHIPPING_ADDRESS_KEY accepts any non-trivial secret string — it is hashed
 * with SHA-256 to derive the 32-byte AES key, so a 64-char hex key, a base64
 * key, or a long passphrase all work. Generate one with:
 *   openssl rand -hex 32
 *
 * Stored format: "v1:<iv b64>:<auth tag b64>:<ciphertext b64>"
 */

const VERSION = "v1";

let cachedKey: Buffer | null | undefined;

function getKey(): Buffer | null {
  if (cachedKey !== undefined) return cachedKey;
  const raw = (process.env.SHIPPING_ADDRESS_KEY || "").trim();
  // Refuse trivially guessable keys — fail closed instead of storing PII
  // under something like "test".
  cachedKey = raw.length >= 16 ? crypto.createHash("sha256").update(raw, "utf8").digest() : null;
  return cachedKey;
}

/** True when a usable encryption key is configured. */
export function secretBoxConfigured(): boolean {
  return getKey() !== null;
}

export function encryptJson(value: unknown): string {
  const key = getKey();
  if (!key) {
    throw new Error("SHIPPING_ADDRESS_KEY is not configured (min 16 chars)");
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(value), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64"), tag.toString("base64"), ciphertext.toString("base64")].join(":");
}

export function decryptJson<T>(payload: string): T {
  const key = getKey();
  if (!key) {
    throw new Error("SHIPPING_ADDRESS_KEY is not configured (min 16 chars)");
  }
  const [version, ivB64, tagB64, dataB64] = payload.split(":");
  if (version !== VERSION || !ivB64 || !tagB64 || !dataB64) {
    throw new Error("Unrecognized encrypted payload format");
  }
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);
  return JSON.parse(plaintext.toString("utf8")) as T;
}
