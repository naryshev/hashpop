"use client";

/**
 * HashPack wallet integration rebuilt from scratch around HashConnect.
 * This provider owns wallet lifecycle, account session restore, and pairing.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { MutableRefObject } from "react";
import type { HashConnect } from "hashconnect";
import { activeHederaChain } from "./hederaChains";
import {
  INIT_TIMEOUT_MESSAGE,
  INIT_TIMEOUT_MS,
  MISSING_WC_PROJECT_ID_MESSAGE,
  bootstrapHashConnect,
  getWalletConnectProjectId,
  isInitTimeoutError,
  shouldRetryHashConnectInit,
  withTimeout,
} from "./hashpackWalletInit";
import {
  buildHashPackDeepLink,
  openHashPackDeepLinkIfMobile,
  selectHashPackConnectChannel,
} from "./hashpackConnectChannel";
import { buildHashpackDappMetadata } from "./hashpackDappMetadata";
import { markAwaitingHashpackReturn } from "./hashpackRestore";
import {
  HASHPACK_NICKNAME_REQUIRED_MESSAGE,
  classifyDesktopConnectTimeout,
  isHashPackExtensionAnnounce,
} from "./hashpackSessionAlias";

type HederaNetwork = "mainnet" | "testnet";

type HashpackWalletContextValue = {
  hashconnect: HashConnect | null;
  address: `0x${string}` | null;
  accountId: string | null;
  balanceTinybar: bigint | null;
  isReady: boolean;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  /** True when a desktop connect attempt elapsed without any wallet response — HashPack is likely not installed. */
  notDetected: boolean;
  /**
   * True when the HashPack extension answered but did not approve.
   * The extension sets `sessionProperties.alias` from the selected account's
   * wallet nickname (`account.nickname`), not the social profile username.
   * The next connect mints a new pairing URI. Do not tell the user their
   * nickname is empty — ask them to confirm Wallet Name on that account.
   */
  nicknameRequired: boolean;
  network: HederaNetwork;
  /** Pre-cached WalletConnect pairing URI. Use this for synchronous deep-links in click handlers. */
  pairingUri: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  refreshAccountData: () => Promise<void>;
};

const HashpackWalletContext = createContext<HashpackWalletContextValue | null>(null);

const PAIRING_WAIT_MS = 120_000;
// On desktop, if no wallet (extension) responds within this window we assume
// HashPack isn't installed and surface an actionable "not detected" state
// instead of spinning indefinitely.
const DETECT_TIMEOUT_MS = 6_000;
const WALLET_SESSION_STORAGE_KEY = "hashpop.wallet.session.v1";

let sharedHashconnect: HashConnect | null = null;
let sharedHashconnectInitPromise: Promise<HashConnect> | null = null;
let sharedHashconnectKey: string | null = null;

function getNetwork(): HederaNetwork {
  return activeHederaChain.id === 295 ? "mainnet" : "testnet";
}

function getMirrorBase(network: HederaNetwork): string {
  return network === "mainnet"
    ? "https://mainnet.mirrornode.hedera.com"
    : "https://testnet.mirrornode.hedera.com";
}

type StoredWalletSession = {
  network: HederaNetwork;
  accountId: string;
  address?: `0x${string}`;
};

function isMobileBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent);
}

/**
 * True when the app runs inside an iframe — which is exactly what HashPack's
 * dApp browser is. In that context deep links must never fire (navigating a
 * framed page to hashpack:// replaces the app with the browser's
 * "content blocked" page); pairing happens via hashconnect's iframe
 * messaging to the surrounding wallet instead.
 */
function isFramed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.self !== window.top;
  } catch {
    // Cross-origin parent throws — definitely framed.
    return true;
  }
}

/**
 * Build the HashPack deep-link URI for the given WalletConnect pairing string.
 * Mobile only — desktop Chrome has no hashpack:// handler.
 */
export { buildHashPackDeepLink };

/**
 * Open HashPack via the mobile `hashpack://` OS handler.
 * No-ops on desktop and inside a framed wallet browser. Desktop pairing goes
 * through the extension relay (`connectToExtension`); a missing extension
 * falls through to the notDetected install/QR state, not a deep link.
 */
export function openHashPackDeepLink(pairingUri: string): void {
  if (typeof window === "undefined" || !pairingUri) return;
  openHashPackDeepLinkIfMobile({
    pairingUri,
    mobile: isMobileBrowser(),
    framed: isFramed(),
    navigation: {
      // location.href fires a custom-scheme deep link synchronously inside
      // the click. window.open is blocked after a promise and, with "_self",
      // is what Chrome rejects as an unregistered hashpack:// handler.
      assignHref: (href) => {
        window.location.href = href;
      },
      markAwaitingReturn: markAwaitingHashpackReturn,
    },
  });
}

// WalletConnect pairing URIs expire ~5 minutes after creation. A stale URI
// makes wallets show a pairing prompt that can never complete (greyed-out
// Pair button) and reads as "HashPack not detected" on desktop.
const PAIRING_URI_MAX_AGE_MS = 3 * 60 * 1000;

async function getPairingUri(hc: HashConnect): Promise<string | null> {
  // Prefer generating a FRESH pairing string — hc.pairingString is minted at
  // init time and may already be expired by the time the user clicks connect.
  const generate = (hc as unknown as { generatePairingString?: () => Promise<{ uri?: string }> })
    .generatePairingString;
  if (typeof generate === "function") {
    const data = await generate.call(hc).catch(() => null);
    const uri = data?.uri;
    if (uri && uri.startsWith("wc:")) return uri;
  }
  const direct = (hc as unknown as { pairingString?: string }).pairingString;
  if (direct && direct.startsWith("wc:")) return direct;
  return null;
}

function readStoredWalletSession(network: HederaNetwork): StoredWalletSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(WALLET_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredWalletSession;
    if (!parsed || parsed.network !== network || !parsed.accountId) return null;
    return parsed;
  } catch {
    return null;
  }
}

function persistWalletSession(session: StoredWalletSession): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(WALLET_SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Ignore storage errors.
  }
}

function clearWalletSessionStorage(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(WALLET_SESSION_STORAGE_KEY);
  } catch {
    // no-op
  }
}

/**
 * Clear stale WalletConnect pairings from localStorage to prevent
 * "Missing or invalid. Record was recently deleted" errors on init.
 */
function clearStalePairings(): void {
  if (typeof window === "undefined") return;
  try {
    const wcKey = "wc@2:core:0.3//pairing";
    const raw = window.localStorage.getItem(wcKey);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Array<{ active?: boolean; expiry?: number }>;
    if (!Array.isArray(parsed)) return;
    const now = Math.floor(Date.now() / 1000);
    const valid = parsed.filter((p) => p.active !== false && (p.expiry == null || p.expiry > now));
    if (valid.length !== parsed.length) {
      window.localStorage.setItem(wcKey, JSON.stringify(valid));
    }
  } catch {
    // If the format is unexpected, wipe all pairings to avoid init errors.
    try {
      window.localStorage.removeItem("wc@2:core:0.3//pairing");
    } catch {
      // no-op
    }
  }
}

function clearWalletConnectorStorage(): void {
  if (typeof window === "undefined") return;
  const patterns = ["hashpop.wallet.", "hashconnect", "hashpack", "walletconnect", "wc@", "wc:"];
  try {
    const localKeys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key) localKeys.push(key);
    }
    for (const key of localKeys) {
      const k = key.toLowerCase();
      if (patterns.some((p) => k.includes(p))) {
        window.localStorage.removeItem(key);
      }
    }
    const sessionKeys: string[] = [];
    for (let i = 0; i < window.sessionStorage.length; i += 1) {
      const key = window.sessionStorage.key(i);
      if (key) sessionKeys.push(key);
    }
    for (const key of sessionKeys) {
      const k = key.toLowerCase();
      if (patterns.some((p) => k.includes(p))) {
        window.sessionStorage.removeItem(key);
      }
    }
  } catch {
    // no-op
  }
}

function normalizeAccountId(raw: string | null): string | null {
  if (!raw) return null;
  if (/^\d+\.\d+\.\d+$/.test(raw)) return raw;
  const parts = raw.split(":");
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    if (/^\d+\.\d+\.\d+$/.test(parts[i] ?? "")) return parts[i]!;
  }
  return null;
}

async function fetchMirrorAccount(
  accountId: string,
  network: HederaNetwork,
): Promise<{
  evmAddress: `0x${string}` | null;
  balanceTinybar: bigint | null;
}> {
  const res = await fetch(
    `${getMirrorBase(network)}/api/v1/accounts/${encodeURIComponent(accountId)}`,
  );
  if (!res.ok) {
    return { evmAddress: null, balanceTinybar: null };
  }

  const data = (await res.json()) as {
    evm_address?: string;
    balance?: { balance?: number | string };
  };

  const rawEvm = data.evm_address?.toLowerCase();
  const evmAddress = rawEvm && /^0x[0-9a-f]{40}$/.test(rawEvm) ? (rawEvm as `0x${string}`) : null;

  const rawBal = data.balance?.balance;
  const balanceTinybar =
    rawBal == null
      ? null
      : typeof rawBal === "number"
        ? BigInt(Math.trunc(rawBal))
        : BigInt(rawBal);

  return { evmAddress, balanceTinybar };
}

function accountIdToLongZeroAddress(accountId: string): `0x${string}` {
  const [shardRaw, realmRaw, numRaw] = accountId.split(".");
  const shard = BigInt(shardRaw || "0");
  const realm = BigInt(realmRaw || "0");
  const num = BigInt(numRaw || "0");
  const shardHex = shard.toString(16).padStart(8, "0");
  const realmHex = realm.toString(16).padStart(16, "0");
  const numHex = num.toString(16).padStart(16, "0");
  return `0x${(shardHex + realmHex + numHex).toLowerCase()}` as `0x${string}`;
}

function waitForPairing(
  connectWaitRef: MutableRefObject<((value: void | PromiseLike<void>) => void) | null>,
  timeoutMs: number,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      connectWaitRef.current = null;
      reject(new Error("Timed out waiting for wallet approval."));
    }, timeoutMs);
    connectWaitRef.current = () => {
      clearTimeout(timeout);
      resolve();
    };
  });
}

async function getOrCreateHashConnect(
  network: HederaNetwork,
  projectId: string,
  forceFresh = false,
): Promise<HashConnect> {
  if (forceFresh) {
    sharedHashconnect = null;
    sharedHashconnectInitPromise = null;
    sharedHashconnectKey = null;
  }
  const key = `${network}:${projectId}`;
  if (sharedHashconnect && sharedHashconnectKey === key) return sharedHashconnect;
  if (sharedHashconnectInitPromise && sharedHashconnectKey === key)
    return sharedHashconnectInitPromise;

  sharedHashconnectKey = key;
  sharedHashconnectInitPromise = (async () => {
    const [{ HashConnect }, sdk] = await Promise.all([
      import("hashconnect"),
      import("@hashgraph/sdk"),
    ]);
    const ledgerId = network === "mainnet" ? sdk.LedgerId.MAINNET : sdk.LedgerId.TESTNET;
    const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
    const metadata = buildHashpackDappMetadata(origin);
    const hc = new HashConnect(ledgerId, projectId, metadata, false);
    await hc.init();
    sharedHashconnect = hc;
    return hc;
  })();

  try {
    const hc = await sharedHashconnectInitPromise;
    return hc;
  } catch (e) {
    sharedHashconnect = null;
    sharedHashconnectKey = null;
    throw e;
  } finally {
    sharedHashconnectInitPromise = null;
  }
}

export function HashpackWalletProvider({ children }: { children: React.ReactNode }) {
  const [hashconnect, setHashconnect] = useState<HashConnect | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [address, setAddress] = useState<`0x${string}` | null>(null);
  const [balanceTinybar, setBalanceTinybar] = useState<bigint | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notDetected, setNotDetected] = useState(false);
  const [nicknameRequired, setNicknameRequired] = useState(false);
  const [pairingUri, setPairingUri] = useState<string | null>(null);
  const network = getNetwork();
  const connectWaitRef = useRef<((value: void | PromiseLike<void>) => void) | null>(null);
  const initPromiseRef = useRef<Promise<HashConnect | null> | null>(null);
  const connectInFlightRef = useRef(false);
  const mobilePairingUriRef = useRef<string | null>(null);
  const mobilePairingUriAtRef = useRef<number>(0);
  const pairingRefreshTimerRef = useRef<number | null>(null);
  const listenersRef = useRef<{
    pairing: ((s: any) => void) | null;
    disconnect: (() => void) | null;
  }>({ pairing: null, disconnect: null });
  const wireClientRef = useRef<(hc: HashConnect) => Promise<HashConnect | null>>(async () => null);

  const resetWalletState = useCallback((clearConnectorData = false) => {
    setAccountId(null);
    setAddress(null);
    setBalanceTinybar(null);
    setError(null);
    setNotDetected(false);
    setNicknameRequired(false);
    clearWalletSessionStorage();
    if (clearConnectorData) clearWalletConnectorStorage();
  }, []);

  const refreshAccountData = useCallback(async () => {
    if (!accountId) return;
    const mirrorData = await fetchMirrorAccount(accountId, network);
    setAddress(mirrorData.evmAddress ?? accountIdToLongZeroAddress(accountId));
    setBalanceTinybar(mirrorData.balanceTinybar);
  }, [accountId, network]);

  useEffect(() => {
    let mounted = true;
    setIsReady(false);
    setHashconnect(null);
    const restored = readStoredWalletSession(network);
    if (restored) {
      setAccountId(restored.accountId);
      setAddress(restored.address ?? accountIdToLongZeroAddress(restored.accountId));
    }
    const projectId = getWalletConnectProjectId();
    if (!projectId) {
      setError(MISSING_WC_PROJECT_ID_MESSAGE);
      setIsReady(true);
      return;
    }

    const wireClient = async (hc: HashConnect): Promise<HashConnect | null> => {
      // Remove any previously registered listeners to prevent duplicates
      // (React StrictMode, re-mounts, network changes, late init after UI timeout).
      if (listenersRef.current.pairing) {
        hc.pairingEvent.off(listenersRef.current.pairing);
      }
      if (listenersRef.current.disconnect) {
        hc.disconnectionEvent.off(listenersRef.current.disconnect);
      }

      const pairingHandler = async (session: { accountIds: string[] }) => {
        if (!mounted) return;
        const first = normalizeAccountId(session.accountIds[0] ?? null);
        setAccountId(first);
        setError(null);
        setNotDetected(false);
        setNicknameRequired(false);
        if (first) {
          const mirrorData = await fetchMirrorAccount(first, network);
          if (!mounted) return;
          const normalized = mirrorData.evmAddress ?? accountIdToLongZeroAddress(first);
          setAddress(normalized);
          setBalanceTinybar(mirrorData.balanceTinybar);
          persistWalletSession({ network, accountId: first, address: normalized });
        } else {
          resetWalletState();
        }
        // Resolve connect() only after address is fully set so isConnected is
        // true by the time any caller awaits connect().
        connectWaitRef.current?.();
        connectWaitRef.current = null;
      };

      const disconnectHandler = () => {
        if (!mounted) return;
        resetWalletState(true);
      };

      listenersRef.current = { pairing: pairingHandler, disconnect: disconnectHandler };
      hc.pairingEvent.on(pairingHandler);
      hc.disconnectionEvent.on(disconnectHandler);

      if (!mounted) return null;
      setHashconnect(hc);
      setIsReady(true);
      setError(null);
      const first = normalizeAccountId(hc.connectedAccountIds[0]?.toString() ?? null);
      if (first) {
        setAccountId(first);
        const mirrorData = await fetchMirrorAccount(first, network);
        if (!mounted) return null;
        const normalized = mirrorData.evmAddress ?? accountIdToLongZeroAddress(first);
        setAddress(normalized);
        setBalanceTinybar(mirrorData.balanceTinybar);
        persistWalletSession({ network, accountId: first, address: normalized });
      } else {
        resetWalletState();
      }
      // Pre-cache pairing URI so click/tap can deep-link immediately
      // without waiting on an async call (which browsers block for deep
      // links) — and keep it FRESH: pairing URIs expire after ~5 minutes,
      // and handing the wallet a stale one produces an unpairable prompt.
      const refreshPairingUri = () => {
        if (!mounted || (hc.connectedAccountIds?.length ?? 0) > 0) return;
        void getPairingUri(hc).then((uri) => {
          if (uri && mounted) {
            mobilePairingUriRef.current = uri;
            mobilePairingUriAtRef.current = Date.now();
            setPairingUri(uri);
          }
        });
      };
      refreshPairingUri();
      if (pairingRefreshTimerRef.current !== null) {
        window.clearInterval(pairingRefreshTimerRef.current);
      }
      pairingRefreshTimerRef.current = window.setInterval(
        refreshPairingUri,
        PAIRING_URI_MAX_AGE_MS,
      );
      return hc;
    };
    wireClientRef.current = wireClient;

    initPromiseRef.current = (async () => {
      try {
        // Prune expired/inactive WalletConnect pairings to avoid
        // "Record was recently deleted" errors during init.
        clearStalePairings();

        const result = await bootstrapHashConnect({
          createClient: (forceFresh) => getOrCreateHashConnect(network, projectId, forceFresh),
          wipeStorage: clearWalletConnectorStorage,
        });

        if (result.timedOut) {
          // UI circuit breaker: leave "Loading wallet…" without killing the
          // in-flight HashConnect. If it later resolves, wire listeners then.
          if (mounted) {
            setError(result.error);
            setIsReady(true);
          }
          if (!result.pending) return null;
          try {
            const late = await result.pending;
            return await wireClient(late);
          } catch {
            return null;
          }
        }

        if (!result.client) {
          if (mounted) {
            setError(result.error ?? "Failed to initialize HashPack connection.");
            setIsReady(true);
          }
          return null;
        }

        return await wireClient(result.client);
      } catch (e) {
        if (!mounted) return null;
        const msg = e instanceof Error ? e.message : "Failed to initialize HashPack connection.";
        setError(msg);
        setIsReady(true);
        return null;
      }
    })();

    return () => {
      mounted = false;
      initPromiseRef.current = null;
      // Unregister event listeners to prevent memory leaks and duplicate handlers.
      if (sharedHashconnect) {
        if (listenersRef.current.pairing) {
          sharedHashconnect.pairingEvent.off(listenersRef.current.pairing);
        }
        if (listenersRef.current.disconnect) {
          sharedHashconnect.disconnectionEvent.off(listenersRef.current.disconnect);
        }
      }
      listenersRef.current = { pairing: null, disconnect: null };
      if (pairingRefreshTimerRef.current !== null) {
        window.clearInterval(pairingRefreshTimerRef.current);
        pairingRefreshTimerRef.current = null;
      }
    };
  }, [network, resetWalletState]);

  const connect = useCallback(async () => {
    if (connectInFlightRef.current) return;
    connectInFlightRef.current = true;
    setIsConnecting(true);
    setNotDetected(false);
    setNicknameRequired(false);
    let extensionSeen = false;
    let removeExtensionListener: (() => void) | null = null;
    try {
      const projectId = getWalletConnectProjectId();
      if (!projectId) {
        setError(MISSING_WC_PROJECT_ID_MESSAGE);
        return;
      }
      setError(null);
      let hc = hashconnect;
      if (!hc && initPromiseRef.current) {
        try {
          hc = await withTimeout(initPromiseRef.current, INIT_TIMEOUT_MS, INIT_TIMEOUT_MESSAGE);
        } catch (e) {
          if (isInitTimeoutError(e)) {
            setError(INIT_TIMEOUT_MESSAGE);
            return;
          }
          hc = null;
        }
      }
      if (!hc) {
        hc = await withTimeout(
          getOrCreateHashConnect(network, projectId),
          INIT_TIMEOUT_MS,
          INIT_TIMEOUT_MESSAGE,
        ).catch(async (e) => {
          if (!shouldRetryHashConnectInit(e)) return null;
          clearWalletConnectorStorage();
          return getOrCreateHashConnect(network, projectId, true).catch(() => null);
        });
        if (hc) {
          const wired = await wireClientRef.current(hc);
          hc = wired;
        }
      }
      if (!hc) {
        setError(INIT_TIMEOUT_MESSAGE);
        return;
      }

      if ((hc.connectedAccountIds?.length ?? 0) > 0) return;

      // Use the pre-cached URI only while it's fresh — expired pairing URIs
      // make the wallet show an unpairable prompt (greyed-out Pair) and read
      // as "not detected" on desktop. Otherwise mint a fresh one.
      const cachedUri = mobilePairingUriRef.current;
      const cacheFresh =
        !!cachedUri &&
        cachedUri.startsWith("wc:") &&
        Date.now() - mobilePairingUriAtRef.current < PAIRING_URI_MAX_AGE_MS;
      const pairingUri = cacheFresh ? cachedUri : await getPairingUri(hc);
      if (!pairingUri) {
        setError("Could not create a HashPack pairing URI. Refresh and try again.");
        return;
      }
      mobilePairingUriRef.current = pairingUri;
      mobilePairingUriAtRef.current = Date.now();

      const channel = selectHashPackConnectChannel({
        mobile: isMobileBrowser(),
        framed: isFramed(),
      });

      // hashpack:// only on mobile. Desktop Chrome has no protocol handler;
      // navigating there fails the launch and drops the extension handshake.
      if (channel === "deeplink") openHashPackDeepLink(pairingUri);

      const extensionClient = hc as unknown as {
        findLocalWallets?: () => Promise<unknown>;
        connectToExtension?: () => Promise<unknown>;
      };
      // Listen before the query so a fast content-script reply is not missed.
      // HashPack posts hashconnect-query-extension-response (and the Hedera
      // extension reply) when the extension is installed.
      if (typeof window !== "undefined") {
        const onWindowMessage = (event: MessageEvent) => {
          if (event.source !== window) return;
          if (isHashPackExtensionAnnounce(event.data)) extensionSeen = true;
        };
        window.addEventListener("message", onWindowMessage);
        removeExtensionListener = () => window.removeEventListener("message", onWindowMessage);
      }
      // Desktop: ask the extension content script for metadata, then hand it
      // the WalletConnect URI via postMessage. HashConnect's constructor
      // listener calls connectToExtension again when the query response
      // arrives. If neither message is answered, the detect timeout below
      // sets notDetected — we do not fall back to hashpack://.
      if (channel === "extension" && typeof extensionClient.findLocalWallets === "function") {
        void extensionClient.findLocalWallets.call(hc).catch(() => {});
      }
      if (typeof extensionClient.connectToExtension === "function") {
        void extensionClient.connectToExtension.call(hc).catch(() => {});
      }

      if (channel === "iframe") {
        // Wallet dApp browser: pair with the surrounding wallet over
        // hashconnect's iframe messaging. init() already sends a pairing
        // request on load; re-send it for this explicit user gesture, then
        // wait for the wallet's approval like the mobile flow does.
        const anyHc = hc as unknown as Record<string, unknown>;
        const iframePair =
          (anyHc.connectToIframeParent as (() => unknown) | undefined) ??
          (anyHc._connectToIframeParent as (() => unknown) | undefined);
        if (typeof iframePair === "function") {
          try {
            void iframePair.call(hc);
          } catch {
            // fall through to waiting — the init-time request may still land
          }
        }
        await waitForPairing(connectWaitRef, PAIRING_WAIT_MS);
      } else if (channel === "deeplink") {
        // Mobile pairs via the deep link / QR; give the user time to approve
        // in the HashPack app and come back.
        await waitForPairing(connectWaitRef, PAIRING_WAIT_MS);
      } else {
        // Desktop pairs via the browser extension, which responds near-instantly
        // when installed. If nothing responds within DETECT_TIMEOUT_MS, assume
        // HashPack isn't installed and surface guidance instead of hanging. The
        // shared pairing listener stays registered, so a late approval still
        // connects.
        const paired = await new Promise<boolean>((resolve) => {
          const timeout = setTimeout(() => {
            connectWaitRef.current = null;
            resolve(false);
          }, DETECT_TIMEOUT_MS);
          connectWaitRef.current = () => {
            clearTimeout(timeout);
            resolve(true);
          };
        });
        if (!paired) {
          // HashPack deletes the proposal after a failed approve, so the URI
          // we just handed the extension cannot be approved on a retry.
          mobilePairingUriRef.current = null;
          mobilePairingUriAtRef.current = 0;
          setPairingUri(null);
          if (classifyDesktopConnectTimeout(extensionSeen) === "nickname-required") {
            setNicknameRequired(true);
            setError(HASHPACK_NICKNAME_REQUIRED_MESSAGE);
          } else {
            setNotDetected(true);
          }
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Wallet connection failed.";
      setError(msg);
      return;
    } finally {
      removeExtensionListener?.();
      setIsConnecting(false);
      connectInFlightRef.current = false;
    }
  }, [hashconnect, network]);

  const disconnect = useCallback(async () => {
    try {
      if (hashconnect) {
        await hashconnect.disconnect();
      }
    } finally {
      resetWalletState(true);
    }
  }, [hashconnect, resetWalletState]);

  const value = useMemo<HashpackWalletContextValue>(
    () => ({
      hashconnect,
      address,
      accountId,
      balanceTinybar,
      isReady,
      isConnected: !!address && !!accountId,
      isConnecting,
      error,
      notDetected,
      nicknameRequired,
      network,
      pairingUri,
      connect,
      disconnect,
      refreshAccountData,
    }),
    [
      hashconnect,
      address,
      accountId,
      balanceTinybar,
      isReady,
      isConnecting,
      error,
      notDetected,
      nicknameRequired,
      network,
      pairingUri,
      connect,
      disconnect,
      refreshAccountData,
    ],
  );

  return <HashpackWalletContext.Provider value={value}>{children}</HashpackWalletContext.Provider>;
}

export function useHashpackWallet(): HashpackWalletContextValue {
  const ctx = useContext(HashpackWalletContext);
  if (!ctx) {
    throw new Error("useHashpackWallet must be used within HashpackWalletProvider");
  }
  return ctx;
}
