"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useHashpackWallet } from "../lib/hashpackWallet";

import { getApiUrl } from "../lib/apiUrl";

/**
 * When a wallet is connected, ensure an account (User) exists on the backend
 * so the user can view, sell, buy, and bid.
 */
export function WalletAccountSync() {
  const { address, accountId } = useHashpackWallet();
  const queryClient = useQueryClient();
  const registered = useRef<Set<string>>(new Set());
  const previousWalletKey = useRef<string | null>(null);

  useEffect(() => {
    const currentWalletKey = address && accountId ? `${address.toLowerCase()}::${accountId}` : null;
    const prev = previousWalletKey.current;
    if (prev !== null && prev !== currentWalletKey) {
      registered.current.clear();
      queryClient.clear();
      // Broadcast wallet-state transition so pages can optionally drop local ephemeral UI state.
      window.dispatchEvent(new CustomEvent("hashpop:wallet-changed"));
    }
    previousWalletKey.current = currentWalletKey;
  }, [address, accountId, queryClient]);

  useEffect(() => {
    if (!address) return;
    const addrLower = address.toLowerCase();
    if (registered.current.has(addrLower)) return;

    fetch(`${getApiUrl()}/api/user/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: addrLower }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then(() => {
        registered.current.add(addrLower);
      })
      .catch(() => {});
  }, [address]);

  return null;
}
