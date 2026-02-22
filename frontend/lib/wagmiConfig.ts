import { createConfig, http } from "wagmi";
import { activeHederaChain, hederaMainnet, hederaTestnet } from "./hederaChains";

const fallbackRpcByChain: Record<295 | 296, string> = {
  295: "https://mainnet.hashio.io/api",
  296: "https://testnet.hashio.io/api",
};

const configuredRpc = process.env.NEXT_PUBLIC_HEDERA_RPC?.trim() || "";
const activeRpc =
  configuredRpc || fallbackRpcByChain[activeHederaChain.id as 295 | 296];

export const config = createConfig({
  chains: [hederaTestnet, hederaMainnet],
  transports: {
    [hederaTestnet.id]: http(
      activeHederaChain.id === hederaTestnet.id
        ? activeRpc
        : fallbackRpcByChain[hederaTestnet.id]
    ),
    [hederaMainnet.id]: http(
      activeHederaChain.id === hederaMainnet.id
        ? activeRpc
        : fallbackRpcByChain[hederaMainnet.id]
    ),
  },
  connectors: [],
  multiInjectedProviderDiscovery: false,
});
