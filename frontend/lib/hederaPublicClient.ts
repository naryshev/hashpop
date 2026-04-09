import { createPublicClient, http } from "viem";
import { activeHederaChain } from "./hederaChains";

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
