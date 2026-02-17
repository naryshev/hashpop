import { createConfig, http } from "wagmi";
import { walletConnect } from "wagmi/connectors";
import { hederaTestnet } from "./hederaChains";

// HashPack connects via WalletConnect (extension doesn't inject window.hedera into page context).
// Set NEXT_PUBLIC_WC_PROJECT_ID in .env.local (free at https://cloud.walletconnect.com).
const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID?.trim() || "";
const connectors = projectId ? [walletConnect({ projectId })] : [];

export const config = createConfig({
  chains: [hederaTestnet],
  transports: {
    [hederaTestnet.id]: http(process.env.NEXT_PUBLIC_HEDERA_RPC || "https://testnet.hashio.io/api"),
  },
  connectors,
  multiInjectedProviderDiscovery: false,
});
