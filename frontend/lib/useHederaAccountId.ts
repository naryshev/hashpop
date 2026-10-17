"use client";

import { useEffect, useState } from "react";
import { getApiUrl } from "./apiUrl";
import { activeHederaChain } from "./hederaChains";

const MIRROR_BASE =
  activeHederaChain.id === 295
    ? "https://mainnet.mirrornode.hedera.com"
    : "https://testnet.mirrornode.hedera.com";

const ACCOUNT_ID = /^\d+\.\d+\.\d+$/;

/**
 * Hedera account id for a wallet. A 0.0.x value is used as-is. An EVM address
 * goes through the same relay, then the public mirror node, that AddressDisplay
 * uses. Null until that lookup returns an id, or when it cannot.
 */
export function useHederaAccountId(address: string | null | undefined): string | null {
  const [accountId, setAccountId] = useState<string | null>(null);

  useEffect(() => {
    const value = (address ?? "").trim();
    if (ACCOUNT_ID.test(value)) {
      setAccountId(value);
      return;
    }
    if (!value.startsWith("0x") || value.length !== 42) {
      setAccountId(null);
      return;
    }
    setAccountId(null);
    let cancelled = false;
    const evm = value.toLowerCase();
    const fromMirror = () =>
      fetch(`${MIRROR_BASE}/api/v1/accounts/${evm}`)
        .then((r) => (r.ok ? r.json() : Promise.reject(r)))
        .then((data: { account?: string }) => data.account ?? null);
    fetch(`${getApiUrl()}/api/relay/account-id?evmAddress=${encodeURIComponent(evm)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data: { accountId?: string }) => data.accountId ?? fromMirror())
      .catch(fromMirror)
      .then((id) => {
        if (!cancelled && typeof id === "string" && ACCOUNT_ID.test(id)) setAccountId(id);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [address]);

  return accountId;
}
