"use client";

import { useHashpackWallet } from "../lib/hashpackWallet";
import { useSignInModal } from "../lib/signInModal";

type ConnectWalletButtonProps = {
  className?: string;
  children?: React.ReactNode;
  "data-testid"?: string;
  onPress?: () => void;
};

/**
 * Single source of truth for "Connect wallet" actions. Opens the site-wide
 * HashPack sign-in modal so the gated action can resume in place rather than
 * navigating to a separate page.
 */
export function ConnectWalletButton({
  className = "btn-frost-cta disabled:opacity-50 disabled:cursor-not-allowed",
  children,
  "data-testid": dataTestId = "connect-wallet-button",
  onPress,
}: ConnectWalletButtonProps) {
  const { isConnecting, isReady } = useHashpackWallet();
  const { openSignIn } = useSignInModal();

  const handleClick = () => {
    if (process.env.NODE_ENV !== "production") {
      console.debug("[wallet] connect button clicked");
    }
    onPress?.();
    openSignIn();
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
