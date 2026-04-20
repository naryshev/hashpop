"use client";

import { useRouter } from "next/navigation";
import { useHashpackWallet } from "../lib/hashpackWallet";

type ConnectWalletButtonProps = {
  className?: string;
  children?: React.ReactNode;
  "data-testid"?: string;
  onPress?: () => void;
  /** Override the URL to return to after sign-in. Defaults to current pathname+search. */
  returnTo?: string;
};

/**
 * Single source of truth for "Connect wallet" actions.
 * Navigates to /signin?returnTo=<current page> so the user lands back
 * where they were after connecting.
 */
export function ConnectWalletButton({
  className = "btn-frost-cta disabled:opacity-50 disabled:cursor-not-allowed",
  children,
  "data-testid": dataTestId = "connect-wallet-button",
  onPress,
  returnTo,
}: ConnectWalletButtonProps) {
  const router = useRouter();
  const { isConnecting, isReady } = useHashpackWallet();

  const handleClick = () => {
    if (process.env.NODE_ENV !== "production") {
      console.debug("[wallet] connect button clicked");
    }
    onPress?.();
    // Read current path at click time to avoid useSearchParams Suspense requirement
    const back = returnTo ?? (typeof window !== "undefined"
      ? window.location.pathname + window.location.search
      : "/");
    router.push(`/signin?returnTo=${encodeURIComponent(back)}`);
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
