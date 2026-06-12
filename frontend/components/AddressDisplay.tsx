"use client";

import { useEffect, useState } from "react";
import { BadgeCheck } from "lucide-react";

import { getApiUrl } from "../lib/apiUrl";
import { profileDisplayName, useProfile } from "../lib/profiles";

function truncateEvm(address: string): string {
  if (!address || address.length < 12) return address;
  if (address.startsWith("0x") && address.length === 42)
    return `${address.slice(0, 6)}…${address.slice(-4)}`;
  return address;
}

/**
 * Renders a wallet identity. Prefers the user's display name when set, falling
 * back to the Hedera account ID (0.0.xxxxx) when resolvable, then a truncated
 * 0x address. Shows a verified badge for KYC-verified users.
 */
export function AddressDisplay({
  address,
  className,
  showVerified = true,
}: {
  address: string;
  className?: string;
  showVerified?: boolean;
}) {
  const [accountId, setAccountId] = useState<string | null>(null);
  const profile = useProfile(address);

  useEffect(() => {
    if (!address || !address.startsWith("0x") || address.length !== 42) {
      setAccountId(null);
      return;
    }
    setAccountId(null);
    const evm = address.toLowerCase();
    fetch(`${getApiUrl()}/api/relay/account-id?evmAddress=${encodeURIComponent(evm)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data: { accountId?: string }) => setAccountId(data.accountId ?? null))
      .catch(() => {});
  }, [address]);

  const displayName = profileDisplayName(profile);
  const fallback =
    accountId ??
    (address && address.startsWith("0x") && address.length === 42 ? truncateEvm(address) : address);
  const display = displayName ?? fallback;
  const title = accountId ? `${accountId} (${address})` : address;

  return (
    <span className={className} title={title}>
      {display}
      {showVerified && profile?.kycVerified && (
        <BadgeCheck
          size={13}
          className="ml-1 inline-block align-text-bottom text-[#00ffa3]"
          aria-label="KYC verified"
        />
      )}
    </span>
  );
}
