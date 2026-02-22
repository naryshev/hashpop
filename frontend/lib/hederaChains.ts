import { defineChain } from "viem";

export const hederaTestnet = defineChain({
  id: 296,
  name: "Hedera Testnet",
  nativeCurrency: { name: "HBAR", symbol: "HBAR", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://testnet.hashio.io/api"] },
    public: { http: ["https://testnet.hashio.io/api"] },
  },
  blockExplorers: {
    default: { name: "HashScan", url: "https://hashscan.io/testnet" },
  },
});

export const hederaMainnet = defineChain({
  id: 295,
  name: "Hedera Mainnet",
  nativeCurrency: { name: "HBAR", symbol: "HBAR", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://mainnet.hashio.io/api"] },
    public: { http: ["https://mainnet.hashio.io/api"] },
  },
  blockExplorers: {
    default: { name: "HashScan", url: "https://hashscan.io/mainnet" },
  },
});

/** Active Hedera chain: mainnet if NEXT_PUBLIC_HEDERA_NETWORK=mainnet, else testnet. */
export const activeHederaChain =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_HEDERA_NETWORK === "mainnet"
    ? hederaMainnet
    : hederaTestnet;
