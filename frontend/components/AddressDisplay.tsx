"use client";

import { useEffect, useState } from "react";

import { getApiUrl } from "../lib/apiUrl";

function truncateEvm(address: string): string {
  if (!address || address.length < 12) return address;
  if (address.startsWith("0x") && address.length === 42)
    return `${address.slice(0, 6)}…${address.slice(-4)}`;
  return address;
}

/**
 * Displays an EVM address (0x...) as Hedera account ID (0.0.xxxxx) when resolvable; otherwise truncated 0x.
 */
export function AddressDisplay({ address, className }: { address: string; className?: string }) {
  const [accountId, setAccountId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!address || !address.startsWith("0x") || address.length !== 42) {
      setAccountId(null);
      setLoaded(true);
      return;
    }
    setAccountId(null);
    setLoaded(false);
    const evm = address.toLowerCase();
    fetch(`${getApiUrl()}/api/relay/account-id?evmAddress=${encodeURIComponent(evm)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data: { accountId?: string }) => {
        setAccountId(data.accountId ?? null);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [address]);

  const display =
    accountId ??
    (address && address.startsWith("0x") && address.length === 42 ? truncateEvm(address) : address);
  const title = accountId ? `${accountId} (${address})` : address;

  return (
    <span className={className} title={title}>
      {display}
    </span>
  );
}
