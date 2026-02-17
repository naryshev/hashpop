"use client";

import { useEffect, useState } from "react";
import { useAccount, useBalance, useConnect, useDisconnect } from "wagmi";
import { formatUnits } from "viem";

const WC_CLOUD_URL = "https://cloud.walletconnect.com";
const HASHPACK_ECDSA_URL = "https://hashpack.app/post/using-evm-addresses-with-hashpack";

function formatHbar(value: bigint | undefined, decimals: number = 18): string {
  if (value === undefined) return "—";
  const raw = formatUnits(value, decimals);
  const num = parseFloat(raw);
  if (num >= 1e6) return num.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (num >= 1) return num.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 3 });
  return num.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 4 });
}

export function WalletButton() {
  const [mounted, setMounted] = useState(false);
  const { address, isConnected } = useAccount();
  const { data: balance } = useBalance({ address });
  const { connect, connectors, error, isPending, reset: resetConnect } = useConnect();
  const { disconnect } = useDisconnect();

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex flex-col items-end">
          <span className="text-sm text-white font-medium tabular-nums opacity-0">0x0000…0000</span>
          <span className="text-sm text-silver tabular-nums opacity-0">— ℏ</span>
        </div>
        <div className="btn-frost text-sm py-1.5 px-3 opacity-50 cursor-default">Connect</div>
      </div>
    );
  }

  if (isConnected) {
    const hbarFormatted = formatHbar(balance?.value, balance?.decimals ?? 18);
    return (
      <div className="flex items-center gap-3">
        <div className="flex flex-col items-end">
          <span className="text-sm text-white font-medium tabular-nums">
            {address?.slice(0, 6)}...{address?.slice(-4)}
          </span>
          <span className="text-sm text-silver tabular-nums">
            {hbarFormatted} ℏ
          </span>
        </div>
        <button
          onClick={() => disconnect()}
          className="btn-frost text-sm py-1.5 px-3"
        >
          Disconnect
        </button>
      </div>
    );
  }

  const connector = connectors[0];
  const noConnector = connectors.length === 0;

  const errMsg = error?.message ?? "";
  const errLower = errMsg.toLowerCase();
  const isProviderNotFound = errLower.includes("provider not found");
  const isEcdsaOnly =
    errLower.includes("ecdsa") || errLower.includes("only ecdsa");
  const friendlyMessage = isProviderNotFound
    ? "Connection failed. Try again or use the WalletConnect modal."
    : isEcdsaOnly
      ? "This dApp needs an ECDSA (EVM) account. Create one in HashPack or link an existing EVM address."
      : errMsg || undefined;

  const handleConnect = () => {
    if (!connector) return;
    resetConnect();
    connect({ connector });
  };

  if (noConnector) {
    return (
      <div className="flex flex-col items-end gap-1">
        <span className="text-xs text-amber-400 max-w-[220px] text-right">
          Add NEXT_PUBLIC_WC_PROJECT_ID to .env.local to connect (HashPack via WalletConnect).
        </span>
        <a
          href={WC_CLOUD_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-frost-cta inline-block text-center no-underline text-sm"
        >
          Get free Project ID →
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {friendlyMessage && (
        <span
          className="text-xs text-amber-400 max-w-[220px] text-right"
          title={error?.message}
        >
          {friendlyMessage}
        </span>
      )}
      {isEcdsaOnly && (
        <a
          href={HASHPACK_ECDSA_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-chrome hover:text-white underline"
        >
          How to use EVM / ECDSA with HashPack →
        </a>
      )}
      <button
        onClick={handleConnect}
        disabled={!connector || isPending}
        className="btn-frost-cta disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? "Connecting…" : "Connect Wallet"}
      </button>
    </div>
  );
}
