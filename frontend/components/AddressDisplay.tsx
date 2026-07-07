"use client";

import { useEffect, useState } from "react";
import { BadgeCheck } from "lucide-react";

import { getApiUrl } from "../lib/apiUrl";
import { profileDisplayName, useProfile } from "../lib/profiles";
import { activeHederaChain } from "../lib/hederaChains";

const MIRROR_BASE =
  activeHederaChain.id === 295
    ? "https://mainnet.mirrornode.hedera.com"
    : "https://testnet.mirrornode.hedera.com";

/**
 * Renders a wallet identity: the HashPack wallet username when set, otherwise
 * the Hedera account ID (0.0.x). EVM 0x addresses are never shown — they are
 * resolved to the account id via the relay, with the public mirror node as a
 * fallback ("…" while resolving). Shows a verified badge for KYC'd users.
 */
export function AddressDisplay({
  address,
  className,
  showVerified = true,
  preferName = true,
}: {
  address: string;
  className?: string;
  showVerified?: boolean;
  /** false = always render the account id / address, never the display name. */
  preferName?: boolean;
}) {
  const [accountId, setAccountId] = useState<string | null>(null);
  const profile = useProfile(address);

  useEffect(() => {
    if (!address || !address.startsWith("0x") || address.length !== 42) {
      setAccountId(null);
      return;
    }
    setAccountId(null);
    let cancelled = false;
    const evm = address.toLowerCase();
    const fromMirror = () =>
      fetch(`${MIRROR_BASE}/api/v1/accounts/${evm}`)
        .then((r) => (r.ok ? r.json() : Promise.reject(r)))
        .then((data: { account?: string }) => data.account ?? null);
    fetch(`${getApiUrl()}/api/relay/account-id?evmAddress=${encodeURIComponent(evm)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data: { accountId?: string }) => data.accountId ?? fromMirror())
      .catch(fromMirror)
      .then((id) => {
        if (!cancelled && typeof id === "string" && id) setAccountId(id);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [address]);

  const displayName = preferName ? profileDisplayName(profile) : null;
  const isEvm = !!address && address.startsWith("0x") && address.length === 42;
  // Never show a 0x address: while the account id resolves (or in the rare
  // case both lookups fail) render an ellipsis instead.
  const fallback = accountId ?? (isEvm ? "…" : address);
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
