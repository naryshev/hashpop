/**
 * Wallet-init helpers used by HashpackWalletProvider.
 *
 * HashConnect.init() sits on WalletConnect SignClient + a relay WebSocket.
 * That handshake can hang forever (invalid/missing-at-runtime project id,
 * blocked relay, stale WC storage). The UI must not stay on "Loading wallet…"
 * when that happens.
 */

export const INIT_TIMEOUT_MS = 12_000;

export const INIT_TIMEOUT_MESSAGE =
  "Couldn't initialize HashPack. Check NEXT_PUBLIC_WC_PROJECT_ID and your network, then refresh.";

export const MISSING_WC_PROJECT_ID_MESSAGE =
  "Missing NEXT_PUBLIC_WC_PROJECT_ID. Add it to frontend/.env.local.";

export function getWalletConnectProjectId(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): string | null {
  const id = env.NEXT_PUBLIC_WC_PROJECT_ID?.trim();
  return id ? id : null;
}

export function isInitTimeoutError(error: unknown): boolean {
  return error instanceof Error && error.message === INIT_TIMEOUT_MESSAGE;
}

/** Stale pairing errors are worth a storage wipe + retry. A hung relay is not. */
export function shouldRetryHashConnectInit(error: unknown): boolean {
  return !isInitTimeoutError(error);
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
