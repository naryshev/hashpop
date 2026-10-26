const MIRROR_BY_NETWORK: Record<string, string> = {
  mainnet: "https://mainnet.mirrornode.hedera.com",
  testnet: "https://testnet.mirrornode.hedera.com",
  previewnet: "https://previewnet.mirrornode.hedera.com",
};

/** `https://mainnet.hashio.io/api` → `mainnet`. Only exact host labels count. */
function networkFromRpcUrl(raw: string | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  let host: string;
  try {
    host = new URL(value).hostname.toLowerCase();
  } catch {
    return null;
  }
  const labels = host.split(".");
  const found = Object.keys(MIRROR_BY_NETWORK).filter((network) => labels.includes(network));
  return found.length === 1 ? found[0] : null;
}

/**
 * Mirror node base URL. `MIRROR_URL` wins. Otherwise derive it from
 * `HEDERA_NETWORK` (`mainnet` → mainnet mirror), then from the network named
 * in `HEDERA_RPC_URL`'s host, so the mirror always matches the RPC the
 * backend already uses. Never falls back to a hard-coded testnet default.
 * Throws when none of them names a network, including in production.
 */
export function resolveMirrorBase(env: NodeJS.ProcessEnv = process.env): string {
  const explicit = env.MIRROR_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const network = env.HEDERA_NETWORK?.trim().toLowerCase();
  if (network && MIRROR_BY_NETWORK[network]) return MIRROR_BY_NETWORK[network];
  const rpcNetwork = networkFromRpcUrl(env.HEDERA_RPC_URL);
  if (rpcNetwork) return MIRROR_BY_NETWORK[rpcNetwork];
  const where = env.NODE_ENV === "production" ? "production" : "this environment";
  throw new Error(
    `MIRROR_URL is unset in ${where}. Set MIRROR_URL, HEDERA_NETWORK (mainnet, testnet, previewnet), or a network-specific HEDERA_RPC_URL.`,
  );
}
