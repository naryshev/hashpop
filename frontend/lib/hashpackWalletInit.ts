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
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>,
): string | null {
  // Next.js only inlines NEXT_PUBLIC_* when the member is written as
  // `process.env.NEXT_PUBLIC_WC_PROJECT_ID` — `env.NEXT_PUBLIC_…` stays empty
  // in the client bundle.
  const raw =
    env === undefined ? process.env.NEXT_PUBLIC_WC_PROJECT_ID : env.NEXT_PUBLIC_WC_PROJECT_ID;
  const id = typeof raw === "string" ? raw.trim() : "";
  return id ? id : null;
}

export function isInitTimeoutError(error: unknown): boolean {
  return error instanceof Error && error.message === INIT_TIMEOUT_MESSAGE;
}

/** Stale pairing errors are worth a storage wipe + retry. A hung relay is not. */
export function shouldRetryHashConnectInit(error: unknown): boolean {
  return !isInitTimeoutError(error);
}

export type HashConnectBootstrapTiming = "now" | "idle" | "never";

/**
 * Signed-out visitors must not download or init HashConnect on page load.
 * A framed HashPack dapp browser still inits immediately (pairing is the
 * iframe postMessage channel). A saved session or live WalletConnect pairing
 * restores after idle so returning users stay signed in.
 */
export function shouldBootstrapHashConnectOnLoad(options: {
  framed: boolean;
  hasSavedSession: boolean;
  hasActivePairing: boolean;
}): HashConnectBootstrapTiming {
  if (options.framed) return "now";
  if (options.hasSavedSession || options.hasActivePairing) return "idle";
  return "never";
}

/** True when WalletConnect's pairing store still has a non-expired pairing. */
export function pairingStoreHasActiveSession(
  raw: string | null,
  nowSec = Math.floor(Date.now() / 1000),
): boolean {
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw) as Array<{ active?: boolean; expiry?: number }>;
    if (!Array.isArray(parsed)) return false;
    return parsed.some((entry) => {
      if (!entry || typeof entry !== "object") return false;
      if (entry.active === false) return false;
      if (typeof entry.expiry === "number" && entry.expiry <= nowSec) return false;
      return true;
    });
  } catch {
    return false;
  }
}

/** Run after the browser is idle. Falls back to a short timeout. */
export function scheduleIdle(task: () => void, timeoutMs = 2000): () => void {
  if (typeof window === "undefined") return () => {};
  const host = window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    cancelIdleCallback?: (id: number) => void;
  };
  if (typeof host.requestIdleCallback === "function") {
    const id = host.requestIdleCallback(task, { timeout: timeoutMs });
    return () => host.cancelIdleCallback?.(id);
  }
  const id = window.setTimeout(task, 1);
  return () => window.clearTimeout(id);
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
  // A late reject after we already timed out must not become unhandled.
  promise.catch(() => {});
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export type BootstrapHashConnectResult<T> = {
  client: T | null;
  timedOut: boolean;
  error: string | null;
  /** Still-running first attempt. Attach this after a UI timeout; do not start a second init. */
  pending: Promise<T> | null;
};

/**
 * UI circuit breaker around HashConnect bootstrap.
 * A timeout unblocks the spinner but does not kill or replace the in-flight client.
 */
export async function bootstrapHashConnect<T>(options: {
  createClient: (forceFresh: boolean) => Promise<T>;
  timeoutMs?: number;
  wipeStorage?: () => void;
}): Promise<BootstrapHashConnectResult<T>> {
  const timeoutMs = options.timeoutMs ?? INIT_TIMEOUT_MS;
  const wipeStorage = options.wipeStorage ?? (() => {});
  const first = options.createClient(false);

  try {
    const client = await withTimeout(first, timeoutMs, INIT_TIMEOUT_MESSAGE);
    return { client, timedOut: false, error: null, pending: null };
  } catch (e) {
    if (isInitTimeoutError(e)) {
      return { client: null, timedOut: true, error: INIT_TIMEOUT_MESSAGE, pending: first };
    }
    if (!shouldRetryHashConnectInit(e)) {
      return {
        client: null,
        timedOut: false,
        error: e instanceof Error ? e.message : "Failed to initialize HashPack connection.",
        pending: null,
      };
    }
    wipeStorage();
    try {
      const client = await withTimeout(options.createClient(true), timeoutMs, INIT_TIMEOUT_MESSAGE);
      return { client, timedOut: false, error: null, pending: null };
    } catch (e2) {
      return {
        client: null,
        timedOut: isInitTimeoutError(e2),
        error: e2 instanceof Error ? e2.message : "Failed to initialize HashPack connection.",
        pending: null,
      };
    }
  }
}
