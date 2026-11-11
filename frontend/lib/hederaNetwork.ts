/**
 * Active Hedera network id without pulling viem into the root client bundle.
 * Wallet and marketplace chrome only need the id; the viem Chain object lives
 * next to the public client that actually sends RPC.
 */
export const ACTIVE_HEDERA_CHAIN_ID: 295 | 296 =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_HEDERA_NETWORK === "mainnet"
    ? 295
    : 296;

const FALLBACK_RPC_BY_CHAIN: Record<295 | 296, string> = {
  295: "https://mainnet.hashio.io/api",
  296: "https://testnet.hashio.io/api",
};

/** RPC URL the public client uses: NEXT_PUBLIC_HEDERA_RPC, or Hashio for the active chain. */
export function hederaRpcUrl(): string {
  return (
    process.env.NEXT_PUBLIC_HEDERA_RPC?.trim() || FALLBACK_RPC_BY_CHAIN[ACTIVE_HEDERA_CHAIN_ID]
  );
}

/** Origin for a preconnect hint. Null if the configured RPC URL is unparseable. */
export function hederaRpcOrigin(): string | null {
  try {
    return new URL(hederaRpcUrl()).origin;
  } catch {
    return null;
  }
}
