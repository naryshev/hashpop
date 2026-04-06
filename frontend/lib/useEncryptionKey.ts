"use client";

import { useCallback, useRef, useState } from "react";
import type { BoxKeyPair } from "tweetnacl";
import { useHashpackWallet } from "./hashpackWallet";
import { deriveEncryptionKeypair, encodeBase64, KEY_DERIVATION_MESSAGE } from "./chatEncryption";
import { getApiUrl } from "./apiUrl";

type EncryptionKeyState = {
  keypair: BoxKeyPair | null;
  isLoading: boolean;
  error: string | null;
  ensureKeypair: () => Promise<BoxKeyPair | null>;
};

/**
 * Hook that manages the user's encryption keypair for the session.
 * On first call to ensureKeypair(), prompts wallet signature to derive keypair, caches in memory.
 * Also registers public key with backend if not already registered.
 */
export function useEncryptionKey(): EncryptionKeyState {
  const { hashconnect, accountId, address } = useHashpackWallet();
  const keypairRef = useRef<BoxKeyPair | null>(null);
  const [keypair, setKeypair] = useState<BoxKeyPair | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initPromiseRef = useRef<Promise<BoxKeyPair | null> | null>(null);

  const ensureKeypair = useCallback(async (): Promise<BoxKeyPair | null> => {
    if (keypairRef.current) return keypairRef.current;
    if (initPromiseRef.current) return initPromiseRef.current;

    if (!hashconnect || !accountId || !address) {
      setError("Wallet not connected");
      return null;
    }

    const promise = (async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Sign the fixed derivation message with the wallet
        const signResult = await (hashconnect as any).signMessages(accountId, [
          KEY_DERIVATION_MESSAGE,
        ]);
        const signatureHex: string = Array.isArray(signResult)
          ? signResult[0]
          : (signResult?.signedMessages?.[0] ?? signResult);

        if (!signatureHex || typeof signatureHex !== "string") {
          throw new Error("Failed to get signature from wallet");
        }

        const kp = await deriveEncryptionKeypair(signatureHex);
        keypairRef.current = kp;
        setKeypair(kp);

        // Check if public key is already registered
        const pubKeyB64 = encodeBase64(kp.publicKey);
        const res = await fetch(
          `${getApiUrl()}/api/user/${encodeURIComponent(address.toLowerCase())}/public-key`,
        );
        const data = await res.json();

        if (data.publicKey !== pubKeyB64) {
          // Register public key — sign proof message
          const proofMessage = `hashpop.pubkey:${pubKeyB64}`;
          const proofResult = await (hashconnect as any).signMessages(accountId, [proofMessage]);
          const proofSig: string = Array.isArray(proofResult)
            ? proofResult[0]
            : (proofResult?.signedMessages?.[0] ?? proofResult);

          await fetch(`${getApiUrl()}/api/user/public-key`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              address: address.toLowerCase(),
              publicKey: pubKeyB64,
              signature: proofSig,
            }),
          });
        }

        return kp;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to derive encryption key";
        setError(msg);
        return null;
      } finally {
        setIsLoading(false);
        initPromiseRef.current = null;
      }
    })();

    initPromiseRef.current = promise;
    return promise;
  }, [hashconnect, accountId, address]);

  return { keypair, isLoading, error, ensureKeypair };
}
