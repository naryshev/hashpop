"use client";

import { useEffect, useState } from "react";
import { getApiUrl } from "../lib/apiUrl";
import { getProfileImage } from "../lib/profileImageCache";

function truncateEvm(address: string): string {
  if (!address || address.length < 12) return address;
  if (address.startsWith("0x") && address.length === 42)
    return `${address.slice(0, 6)}…${address.slice(-4)}`;
  return address;
}

/**
 * Displays an EVM address (0x...) as Hedera account ID (0.0.xxxxx) when resolvable; otherwise truncated 0x.
 * Pass showAvatar to render a small profile image circle to the left.
 */
export function AddressDisplay({
  address,
  className,
  showAvatar = false,
}: {
  address: string;
  className?: string;
  showAvatar?: boolean;
}) {
  const [accountId, setAccountId] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!address || !address.startsWith("0x") || address.length !== 42) {
      setAccountId(null);
      return;
    }
    const evm = address.toLowerCase();
    fetch(`${getApiUrl()}/api/relay/account-id?evmAddress=${encodeURIComponent(evm)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data: { accountId?: string }) => setAccountId(data.accountId ?? null))
      .catch(() => {});
  }, [address]);

  useEffect(() => {
    if (!showAvatar || !address) return;
    getProfileImage(address).then(setAvatarUrl).catch(() => {});
  }, [address, showAvatar]);

  const display =
    accountId ??
    (address && address.startsWith("0x") && address.length === 42 ? truncateEvm(address) : address);
  const title = accountId ? `${accountId} (${address})` : address;

  const avatarLetter = address ? (address[2]?.toUpperCase() ?? "?") : "?";

  if (showAvatar) {
    return (
      <span className={`inline-flex items-center gap-1.5 ${className ?? ""}`} title={title}>
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt=""
            className="h-5 w-5 rounded-full object-cover shrink-0"
          />
        ) : (
          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#00ffa3]/25 text-[9px] font-bold text-[#00ffa3]">
            {avatarLetter}
          </span>
        )}
        <span>{display}</span>
      </span>
    );
  }

  return (
    <span className={className} title={title}>
      {display}
    </span>
  );
}
