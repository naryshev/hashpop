const MIRROR_BY_NETWORK: Record<string, string> = {
  mainnet: "https://mainnet.mirrornode.hedera.com",
  testnet: "https://testnet.mirrornode.hedera.com",
  previewnet: "https://previewnet.mirrornode.hedera.com",
};

/**
 * Mirror node base URL. `MIRROR_URL` wins. Otherwise derive it from
 * `HEDERA_NETWORK` (`mainnet` → mainnet mirror). Never falls back to testnet.
 * Throws when neither is set, including in production.
 */
export function resolveMirrorBase(env: NodeJS.ProcessEnv = process.env): string {
  const explicit = env.MIRROR_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const network = env.HEDERA_NETWORK?.trim().toLowerCase();
  if (network && MIRROR_BY_NETWORK[network]) return MIRROR_BY_NETWORK[network];
  const where = env.NODE_ENV === "production" ? "production" : "this environment";
  throw new Error(
    `MIRROR_URL is unset in ${where}. Set MIRROR_URL or HEDERA_NETWORK (mainnet, testnet, previewnet).`,
  );
}
