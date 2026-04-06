import { createPublicClient, http } from "viem";
import { activeHederaChain, hederaMainnet, hederaTestnet } from "./hederaChains";

const fallbackRpcByChain: Record<295 | 296, string> = {
  295: "https://mainnet.hashio.io/api",
  296: "https://testnet.hashio.io/api",
};

const configuredRpc = process.env.NEXT_PUBLIC_HEDERA_RPC?.trim() || "";
const activeRpc = configuredRpc || fallbackRpcByChain[activeHederaChain.id as 295 | 296];

export const hederaPublicClient = createPublicClient({
  chain: activeHederaChain,
  transport: http(activeRpc),
});

export const hederaReadTransports = {
  [hederaTestnet.id]: http(
    activeHederaChain.id === hederaTestnet.id ? activeRpc : fallbackRpcByChain[hederaTestnet.id],
  ),
  [hederaMainnet.id]: http(
    activeHederaChain.id === hederaMainnet.id ? activeRpc : fallbackRpcByChain[hederaMainnet.id],
  ),
};
