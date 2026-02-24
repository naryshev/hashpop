const HEDERA_MAINNET_CHAIN_ID = 295;
const HEDERA_TESTNET_CHAIN_ID = 296;

function getHashscanBase(chainId?: number): string {
  if (chainId === HEDERA_MAINNET_CHAIN_ID) return "https://hashscan.io/mainnet";
  return "https://hashscan.io/testnet";
}

export function getTransactionExplorerUrl(txId: string | null | undefined, chainId?: number): string | null {
  if (!txId || txId === "submitted") return null;
  const normalized = txId.trim();
  if (!normalized) return null;
  return `${getHashscanBase(chainId)}/transaction/${encodeURIComponent(normalized)}`;
}
