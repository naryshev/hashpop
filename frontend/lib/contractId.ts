import { activeHederaChain } from "./hederaChains";

// EVM contract address → "0.0.x" id, resolved once per session via the
// mirror node so UI surfaces can show a real Hedera contract id (never 0x).
const contractIdCache = new Map<string, string>();

export async function resolveContractIdDisplay(address: string): Promise<string | null> {
  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) return null;
  const cached = contractIdCache.get(address.toLowerCase());
  if (cached) return cached;
  try {
    const mirrorBase =
      activeHederaChain.id === 295
        ? "https://mainnet.mirrornode.hedera.com"
        : "https://testnet.mirrornode.hedera.com";
    const res = await fetch(`${mirrorBase}/api/v1/contracts/${address.toLowerCase()}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { contract_id?: string };
    if (typeof data?.contract_id === "string" && /^\d+\.\d+\.\d+$/.test(data.contract_id)) {
      contractIdCache.set(address.toLowerCase(), data.contract_id);
      return data.contract_id;
    }
  } catch {
    // caller hides the row / detail line when the mirror node is unreachable
  }
  return null;
}
