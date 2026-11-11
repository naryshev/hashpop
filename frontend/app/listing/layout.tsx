import { hederaRpcOrigin } from "../../lib/hederaNetwork";

const COINGECKO_ORIGIN = "https://api.coingecko.com";

/**
 * /listing fetches the Hedera RPC (readListingCompat → hederaPublicClient)
 * and CoinGecko (useHbarUsd / fetchHbarUsd) from the browser after hydration.
 * Preconnect here only: these hosts are not needed on / or /marketplace.
 * The RPC origin follows NEXT_PUBLIC_HEDERA_RPC when set, otherwise Hashio
 * for the active chain (mainnet.hashio.io when NEXT_PUBLIC_HEDERA_NETWORK=mainnet).
 */
export default function ListingLayout({ children }: { children: React.ReactNode }) {
  const rpcOrigin = hederaRpcOrigin();
  return (
    <>
      {rpcOrigin ? <link rel="preconnect" href={rpcOrigin} crossOrigin="anonymous" /> : null}
      <link rel="preconnect" href={COINGECKO_ORIGIN} crossOrigin="anonymous" />
      {children}
    </>
  );
}
