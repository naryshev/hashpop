"use client";

import { useRouter } from "next/navigation";
import { useHashpackWallet } from "../lib/hashpackWallet";

type ConnectWalletButtonProps = {
  className?: string;
  children?: React.ReactNode;
  "data-testid"?: string;
  onPress?: () => void;
};

/**
 * Single source of truth for "Connect wallet" actions.
 * Use this component anywhere you need a button that opens the HashConnect pairing flow.
 */
export function ConnectWalletButton({
  className = "btn-frost-cta disabled:opacity-50 disabled:cursor-not-allowed",
  children,
  "data-testid": dataTestId = "connect-wallet-button",
  onPress,
}: ConnectWalletButtonProps) {
  const router = useRouter();
  const { isConnecting, isReady } = useHashpackWallet();

  const handleClick = () => {
    // Keep a tiny runtime breadcrumb for debugging click wiring in devtools.
    if (process.env.NODE_ENV !== "production") {
      console.debug("[wallet] connect button clicked");
    }
    onPress?.();
    router.push("/signin");
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!isReady || isConnecting}
      className={className}
      data-connect-wallet
      data-testid={dataTestId}
    >
      {children ?? (!isReady ? "Loading wallet…" : isConnecting ? "Connecting…" : "Connect wallet")}
    </button>
  );
}
