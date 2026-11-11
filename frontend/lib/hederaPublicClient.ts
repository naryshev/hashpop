import { createPublicClient, http } from "viem";
import { activeHederaChain } from "./hederaChains";
import { hederaRpcUrl } from "./hederaNetwork";

export const hederaPublicClient = createPublicClient({
  chain: activeHederaChain,
  transport: http(hederaRpcUrl()),
});
