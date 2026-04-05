import nacl from "tweetnacl";
import { decodeBase64, encodeBase64, decodeUTF8, encodeUTF8 } from "tweetnacl-util";

/** The fixed message a user signs to derive their encryption keypair. */
export const KEY_DERIVATION_MESSAGE = "hashpop.encryption.v1";

function hexToBytes(hex: string): Uint8Array {
  const h = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(h.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Derives a deterministic X25519 keypair from a wallet signature.
 * The signature bytes are hashed (SHA-256) to produce a 32-byte seed.
 */
export async function deriveEncryptionKeypair(signatureHex: string): Promise<nacl.BoxKeyPair> {
  const sigBytes = hexToBytes(signatureHex);
  const seed = await crypto.subtle.digest("SHA-256", sigBytes as unknown as ArrayBuffer);
  return nacl.box.keyPair.fromSecretKey(new Uint8Array(seed));
}

/**
 * Encrypts a plaintext message for a recipient.
 * Returns { ciphertext: string (base64), nonce: string (base64) }
 */
export function encryptMessage(
  plaintext: string,
  recipientPublicKeyB64: string,
  senderSecretKey: Uint8Array,
): { ciphertext: string; nonce: string } {
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const recipientPublicKey = decodeBase64(recipientPublicKeyB64);
  const messageBytes = decodeUTF8(plaintext);
  const encrypted = nacl.box(messageBytes, nonce, recipientPublicKey, senderSecretKey);
  return {
    ciphertext: encodeBase64(encrypted),
    nonce: encodeBase64(nonce),
  };
}

/**
 * Decrypts a message. Returns plaintext string, or null if decryption fails.
 */
export function decryptMessage(
  ciphertextB64: string,
  nonceB64: string,
  senderPublicKeyB64: string,
  recipientSecretKey: Uint8Array,
): string | null {
  const ciphertext = decodeBase64(ciphertextB64);
  const nonce = decodeBase64(nonceB64);
  const senderPublicKey = decodeBase64(senderPublicKeyB64);
  const decrypted = nacl.box.open(ciphertext, nonce, senderPublicKey, recipientSecretKey);
  return decrypted ? encodeUTF8(decrypted) : null;
}

export { encodeBase64 };
