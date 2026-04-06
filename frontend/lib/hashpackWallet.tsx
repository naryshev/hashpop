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
  network: HederaNetwork;
  /** Pre-cached WalletConnect pairing URI. Use this for synchronous deep-links in click handlers. */
  pairingUri: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  refreshAccountData: () => Promise<void>;
};

const HashpackWalletContext = createContext<HashpackWalletContextValue | null>(null);

const PAIRING_WAIT_MS = 120_000;
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
 * Build the HashPack deep-link URI for the given WalletConnect pairing string.
 * On mobile, navigating to this URI will open (or prompt to install) HashPack.
 */
export function buildHashPackDeepLink(pairingUri: string): string {
  return `hashpack://wc?uri=${encodeURIComponent(pairingUri)}`;
}

function openHashPackDeepLink(pairingUri: string): void {
  if (typeof window === "undefined" || !pairingUri) return;
  const deeplink = buildHashPackDeepLink(pairingUri);
  try {
    if (isMobileBrowser()) {
      // location.href is the most reliable way to fire a custom-scheme deep link
      // on mobile because it happens synchronously within the current document
      // navigation, unlike window.open which browsers restrict post-promise.
      window.location.href = deeplink;
    } else {
      // On desktop, window.open works fine and keeps the tab open.
      const popup = window.open(deeplink, "_self");
      if (popup === null) return;
    }
  } catch {
    // Custom protocol not registered — browser extension will handle it.
  }
}

async function getPairingUri(hc: HashConnect): Promise<string | null> {
  const direct = (hc as unknown as { pairingString?: string }).pairingString;
  if (direct && direct.startsWith("wc:")) return direct;
  const generate = (hc as unknown as { generatePairingString?: () => Promise<{ uri?: string }> })
    .generatePairingString;
  if (typeof generate === "function") {
    const data = await generate.call(hc).catch(() => null);
    const uri = data?.uri;
    if (uri && uri.startsWith("wc:")) return uri;
  }
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
    const metadata = {
      name: "Hashpop",
      description: "Hashpop marketplace - HashConnect wallet (HashPack)",
      icons: ["https://hashpack.app/favicon.ico"],
      url: typeof window !== "undefined" ? window.location.origin : "http://localhost:3000",
    };
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
  const [pairingUri, setPairingUri] = useState<string | null>(null);
  const network = getNetwork();
  const connectWaitRef = useRef<((value: void | PromiseLike<void>) => void) | null>(null);
  const initPromiseRef = useRef<Promise<HashConnect | null> | null>(null);
  const connectInFlightRef = useRef(false);
  const mobilePairingUriRef = useRef<string | null>(null);
  const listenersRef = useRef<{
    pairing: ((s: any) => void) | null;
    disconnect: (() => void) | null;
  }>({ pairing: null, disconnect: null });

  const resetWalletState = useCallback((clearConnectorData = false) => {
    setAccountId(null);
    setAddress(null);
    setBalanceTinybar(null);
    setError(null);
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
    const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID?.trim();
    if (!projectId) {
      setError("Missing NEXT_PUBLIC_WC_PROJECT_ID. Add it to frontend/.env.local.");
      setIsReady(true);
      return;
    }

    initPromiseRef.current = (async () => {
      try {
        // Prune expired/inactive WalletConnect pairings to avoid
        // "Record was recently deleted" errors during init.
        clearStalePairings();

        const createClient = async (forceFresh: boolean) => {
          const client = await getOrCreateHashConnect(network, projectId, forceFresh);
          return client;
        };

        let hc: HashConnect;
        try {
          hc = await createClient(false);
        } catch {
          clearWalletConnectorStorage();
          hc = await createClient(true);
        }

        // Remove any previously registered listeners to prevent duplicates
        // (React StrictMode, re-mounts, network changes).
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
        // without waiting on an async call (which browsers block for deep links).
        void getPairingUri(hc).then((uri) => {
          if (uri && mounted) {
            mobilePairingUriRef.current = uri;
            setPairingUri(uri);
          }
        });
        return hc;
      } catch (e) {
        if (!mounted) return null;
        const msg = e instanceof Error ? e.message : "Failed to initialize HashPack connection.";
        setError(msg);
        setIsReady(true);
        throw e;
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
    };
  }, [network, resetWalletState]);

  const connect = useCallback(async () => {
    if (connectInFlightRef.current) return;
    connectInFlightRef.current = true;
    setIsConnecting(true);
    setError(null);
    try {
      let hc = hashconnect;
      if (!hc && initPromiseRef.current) {
        try {
          hc = await initPromiseRef.current;
        } catch {
          hc = null;
        }
      }
      if (!hc) {
        const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID?.trim();
        if (projectId) {
          hc = await getOrCreateHashConnect(network, projectId).catch(async () => {
            clearWalletConnectorStorage();
            return getOrCreateHashConnect(network, projectId, true).catch(() => null);
          });
          if (hc) setHashconnect(hc);
        }
      }
      if (!hc) {
        setError("Wallet initialization failed. Refresh and try again.");
        return;
      }

      if ((hc.connectedAccountIds?.length ?? 0) > 0) return;

      const immediatePairingUri =
        mobilePairingUriRef.current ??
        (hc as unknown as { pairingString?: string }).pairingString ??
        null;
      const pairingUri =
        immediatePairingUri && immediatePairingUri.startsWith("wc:")
          ? immediatePairingUri
          : await getPairingUri(hc);
      if (!pairingUri) {
        setError("Could not create a HashPack pairing URI. Refresh and try again.");
        return;
      }
      mobilePairingUriRef.current = pairingUri;

      // Direct HashPack deep-link first on both desktop and mobile.
      openHashPackDeepLink(pairingUri);

      const maybeConnectToExtension = (
        hc as unknown as { connectToExtension?: () => Promise<unknown> }
      ).connectToExtension;
      if (typeof maybeConnectToExtension === "function") {
        void maybeConnectToExtension.call(hc).catch(() => {});
      }

      await waitForPairing(connectWaitRef, PAIRING_WAIT_MS);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Wallet connection failed.";
      setError(msg);
      return;
    } finally {
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
