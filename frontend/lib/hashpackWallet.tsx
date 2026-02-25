"use client";

/**
 * HashConnect wallet integration.
 * All Hedera wallet functionality (connect, disconnect, send transactions, sign)
 * is implemented via the HashConnect SDK (https://hashpack.app / hashconnect package),
 * which connects this dApp to HashPack and other compatible wallets.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
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
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  refreshAccountData: () => Promise<void>;
};

const HashpackWalletContext = createContext<HashpackWalletContextValue | null>(null);

const EXTENSION_WAIT_MS = 10_000;
const PAIRING_WAIT_MS = 120_000; // Time for user to approve in HashPack (extension or modal)

let sharedHashconnect: HashConnect | null = null;
let sharedHashconnectInitPromise: Promise<HashConnect> | null = null;
let sharedHashconnectKey: string | null = null;
const WALLET_SESSION_STORAGE_KEY = "hashpop.wallet.session.v1";

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
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent || "";
  return /android|iphone|ipad|ipod|mobile/i.test(ua);
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
    // Ignore storage errors.
  }
}

function clearWalletConnectorStorage(): void {
  if (typeof window === "undefined") return;
  const patterns = [
    "hashpop.wallet.",
    "hashconnect",
    "hashpack",
    "walletconnect",
    "wc@",
    "wc:",
  ];
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
    // Ignore storage errors.
  }
}

async function fetchMirrorAccount(accountId: string, network: HederaNetwork): Promise<{
  evmAddress: `0x${string}` | null;
  balanceTinybar: bigint | null;
}> {
  const res = await fetch(`${getMirrorBase(network)}/api/v1/accounts/${encodeURIComponent(accountId)}`);
  if (!res.ok) {
    return { evmAddress: null, balanceTinybar: null };
  }

  const data = (await res.json()) as {
    evm_address?: string;
    balance?: { balance?: number | string };
  };

  const rawEvm = data.evm_address?.toLowerCase();
  const evmAddress =
    rawEvm && /^0x[0-9a-f]{40}$/.test(rawEvm)
      ? (rawEvm as `0x${string}`)
      : null;

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

function waitForPairing(connectWaitRef: MutableRefObject<((value: void | PromiseLike<void>) => void) | null>, timeoutMs: number): Promise<void> {
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

async function getOrCreateHashConnect(network: HederaNetwork, projectId: string): Promise<HashConnect> {
  const key = `${network}:${projectId}`;
  if (sharedHashconnect && sharedHashconnectKey === key) return sharedHashconnect;
  if (sharedHashconnectInitPromise && sharedHashconnectKey === key) return sharedHashconnectInitPromise;

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
  const network = getNetwork();
  const connectWaitRef = useRef<((value: void | PromiseLike<void>) => void) | null>(null);
  const initPromiseRef = useRef<Promise<HashConnect | null> | null>(null);
  const connectInFlightRef = useRef(false);

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
        const hc = await getOrCreateHashConnect(network, projectId);
        hc.pairingEvent.on(async (session: { accountIds: string[] }) => {
          if (!mounted) return;
          const first = session.accountIds[0] ?? null;
          setAccountId(first);
          setError(null);
          connectWaitRef.current?.();
          connectWaitRef.current = null;
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
        });

        hc.disconnectionEvent.on(() => {
          if (!mounted) return;
          resetWalletState(true);
        });

        if (!mounted) return null;
        setHashconnect(hc);
        setIsReady(true);
        const first = hc.connectedAccountIds[0]?.toString() ?? null;
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
        return hc;
      } catch (e) {
        if (!mounted) return null;
        const msg = e instanceof Error ? e.message : "Failed to initialize HashPack connection";
        setError(msg + " Try a private/incognito window or disable browser extensions (e.g. MetaMask) that use SES.");
        setIsReady(true);
        throw e;
      }
    })();

    return () => {
      mounted = false;
      initPromiseRef.current = null;
    };
  }, [network, resetWalletState]);

  const connect = useCallback(async () => {
    if (connectInFlightRef.current) return;
    connectInFlightRef.current = true;
    let hc = hashconnect;
    if (!hc && initPromiseRef.current) {
      try {
        hc = await initPromiseRef.current;
      } catch {
        hc = null;
      }
    }
    if (!hc) {
      setError("Wallet initialization failed. Refresh and try again.");
      return;
    }
    setIsConnecting(true);
    setError(null);
    try {
      if ((hc.connectedAccountIds?.length ?? 0) > 0) return;

      const extensionOnly = process.env.NEXT_PUBLIC_HASHPACK_EXTENSION_ONLY === "true";
      const maybeConnectToExtension = (hc as unknown as { connectToExtension?: () => Promise<unknown> }).connectToExtension;
      const mobileBrowser = isMobileBrowser();

      // 1) On desktop, try HashPack extension first (no modal).
      // On mobile, skip this to preserve direct user-gesture flow into the wallet modal/deeplink.
      if (!mobileBrowser && typeof maybeConnectToExtension === "function") {
        await maybeConnectToExtension.call(hc).catch(() => {});
        try {
          await waitForPairing(connectWaitRef, EXTENSION_WAIT_MS);
          return;
        } catch {
          // Fall through to modal unless extension-only mode is enabled.
        }
      }

      if (extensionOnly) {
        setError("HashPack extension-only mode is enabled and extension pairing failed. Ensure HashPack extension is installed, unlocked, and on this profile.");
        return;
      }

      // 2) Fallback to HashConnect pairing modal (QR / deep link).
      const openModal = (hc as { openPairingModal?: (theme?: unknown) => Promise<void> }).openPairingModal;
      if (typeof openModal !== "function") {
        setError("HashConnect pairing not available. Try refreshing or use a private window.");
        return;
      }
      const modalErr = await openModal
        .call(hc, { themeMode: "dark" })
        .then(() => null)
        .catch(async () => openModal.call(hc, "dark").then(() => null).catch((err: unknown) => err));
      if (modalErr) {
        const modalMsg =
          modalErr instanceof Error
            ? modalErr.message
            : typeof modalErr === "string"
              ? modalErr
              : "";
        if (/pairing already exists/i.test(modalMsg)) {
          // Recover from stale WC sessions by resetting connector storage and requesting a fresh pairing.
          await hc.disconnect().catch(() => {});
          clearWalletConnectorStorage();
          const retryErr = await openModal
            .call(hc, { themeMode: "dark" })
            .then(() => null)
            .catch(async () => openModal.call(hc, "dark").then(() => null).catch((err: unknown) => err));
          if (retryErr) {
            setError("Pairing session already existed. We reset stale pairing data, but opening a new pairing still failed. Please try again.");
            return;
          }
          await waitForPairing(connectWaitRef, PAIRING_WAIT_MS);
          return;
        }
        setError(
          mobileBrowser
            ? "Could not open HashPack on mobile. Try opening this dApp in HashPack's in-app browser, then connect again."
            : "Could not open wallet pairing. Try a private/incognito window or disable browser extensions."
        );
        return;
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
  }, [hashconnect]);

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
      connect,
      disconnect,
      refreshAccountData,
    }),
    [hashconnect, address, accountId, balanceTinybar, isReady, isConnecting, error, network, connect, disconnect, refreshAccountData]
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
