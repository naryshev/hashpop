"use client";

import { useEffect, useRef } from "react";
import { useHashpackWallet } from "../lib/hashpackWallet";

import { getApiUrl } from "../lib/apiUrl";

/**
 * When a wallet is connected, ensure an account (User) exists on the backend
 * so the user can view, sell, buy, and bid.
 */
export function WalletAccountSync() {
  const { address } = useHashpackWallet();
  const registered = useRef<Set<string>>(new Set());

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
