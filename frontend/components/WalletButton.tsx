"use client";

import { useEffect, useState } from "react";
import { AddressDisplay } from "./AddressDisplay";
import { useHashpackWallet } from "../lib/hashpackWallet";
import { ConnectWalletButton } from "./ConnectWalletButton";

const HASHPACK_CONNECT_URL = "https://docs.hashpack.app/dapp-developers/hashconnect";

function formatHbarFromTinybar(value: bigint | null): string {
  if (value === null) return "—";
  const num = Number(value) / 100_000_000;
  if (num >= 1e6) return num.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (num >= 1) return num.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 3 });
  return num.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 4 });
}

type WalletButtonProps = {
  onConnectPress?: () => void;
};

export function WalletButton({ onConnectPress }: WalletButtonProps) {
  const [mounted, setMounted] = useState(false);
  const {
    address,
    isConnected,
    disconnect,
    isReady,
    isConnecting,
    error,
    balanceTinybar,
  } = useHashpackWallet();

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="flex items-center gap-3" suppressHydrationWarning>
        <div className="flex flex-col items-end">
          <span className="text-sm text-white font-medium tabular-nums opacity-0">0x0000…0000</span>
          <span className="text-sm text-silver tabular-nums opacity-0">— ℏ</span>
        </div>
        <div className="btn-frost text-sm py-1.5 px-3 opacity-50 cursor-default">Connect</div>
      </div>
    );
  }

  if (isConnected && address) {
    const hbarFormatted = formatHbarFromTinybar(balanceTinybar);
    return (
      <div className="flex items-center gap-3">
        <div className="flex flex-col items-end">
          <span className="text-sm text-white font-medium tabular-nums">
            <AddressDisplay address={address} />
          </span>
          <span className="text-sm text-silver tabular-nums">
            {hbarFormatted} ℏ
          </span>
        </div>
        <button
          onClick={() => void disconnect()}
          className="btn-frost text-sm py-1.5 px-3"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {error && (
        <span
          className="text-xs text-amber-400 max-w-[260px] text-right"
          title={error}
        >
          {error}
        </span>
      )}
      {error && (
        <span className="text-xs text-silver/80 max-w-[260px] text-right">
          Tip: Open in incognito or disable extensions if Connect still fails.
        </span>
      )}
      <a
        href={HASHPACK_CONNECT_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-chrome hover:text-white underline"
      >
        HashPack connect docs →
      </a>
      <ConnectWalletButton
        className="btn-frost-cta disabled:opacity-50 disabled:cursor-not-allowed"
        onPress={onConnectPress}
      >
        {!isReady ? "Loading wallet…" : isConnecting ? "Connecting…" : "Connect Wallet"}
      </ConnectWalletButton>
    </div>
  );
}
