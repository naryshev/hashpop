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

export type MirrorSource = "MIRROR_URL" | "HEDERA_NETWORK" | "HEDERA_RPC_URL";

/**
 * Mirror node base URL and where it came from. An explicit `MIRROR_URL`
 * always wins, whatever `HEDERA_NETWORK` or `HEDERA_RPC_URL` say. Only when
 * it is unset is the network inferred: first `HEDERA_NETWORK`, then the
 * network named in `HEDERA_RPC_URL`'s host. Never falls back to a hard-coded
 * testnet default. Throws when none of them names a network.
 */
export function resolveMirrorChoice(env: NodeJS.ProcessEnv = process.env): {
  url: string;
  source: MirrorSource;
} {
  const explicit = env.MIRROR_URL?.trim();
  if (explicit) return { url: explicit.replace(/\/+$/, ""), source: "MIRROR_URL" };
  const network = env.HEDERA_NETWORK?.trim().toLowerCase();
  if (network && MIRROR_BY_NETWORK[network]) {
    return { url: MIRROR_BY_NETWORK[network], source: "HEDERA_NETWORK" };
  }
  const rpcNetwork = networkFromRpcUrl(env.HEDERA_RPC_URL);
  if (rpcNetwork) return { url: MIRROR_BY_NETWORK[rpcNetwork], source: "HEDERA_RPC_URL" };
  const where = env.NODE_ENV === "production" ? "production" : "this environment";
  throw new Error(
    `MIRROR_URL is unset in ${where}. Set MIRROR_URL, HEDERA_NETWORK (mainnet, testnet, previewnet), or a network-specific HEDERA_RPC_URL.`,
  );
}

/** Mirror node base URL. See `resolveMirrorChoice`. */
export function resolveMirrorBase(env: NodeJS.ProcessEnv = process.env): string {
  return resolveMirrorChoice(env).url;
}

/** Boot-time log line naming the mirror and why it was picked. */
export function logMirrorChoice(
  log: { info: (obj: object, msg: string) => void; warn: (obj: object, msg: string) => void },
  env: NodeJS.ProcessEnv = process.env,
): void {
  const { url, source } = resolveMirrorChoice(env);
  if (source === "MIRROR_URL") {
    log.info({ mirror: url, source }, "Mirror node configured from MIRROR_URL");
  } else {
    log.warn(
      { mirror: url, source },
      `MIRROR_URL is unset; inferred mirror ${url} from ${source}. Set MIRROR_URL to pin it.`,
    );
  }
}
