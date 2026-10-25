/**
 * Active Hedera network id without pulling viem into the root client bundle.
 * Wallet and marketplace chrome only need the id; the viem Chain object lives
 * next to the public client that actually sends RPC.
 */
export const ACTIVE_HEDERA_CHAIN_ID: 295 | 296 =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_HEDERA_NETWORK === "mainnet"
    ? 295
    : 296;
