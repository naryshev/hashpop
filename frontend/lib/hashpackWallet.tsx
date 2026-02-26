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

function openHashPackMobileDeepLink(pairingUri: string): void {
  if (typeof window === "undefined" || !pairingUri) return;
  const encoded = encodeURIComponent(pairingUri);
  const deeplink = `hashpack://wc?uri=${encoded}`;
  // Attempt multiple techniques for iOS/Android browsers.
  try {
    window.location.assign(deeplink);
  } catch {
    // Ignore and continue fallback.
  }
  const iframe = document.createElement("iframe");
  iframe.style.display = "none";
  iframe.src = deeplink;
  document.body.appendChild(iframe);
  window.setTimeout(() => {
    iframe.remove();
  }, 1500);
}

async function getPairingUri(hc: HashConnect): Promise<string | null> {
  const direct = (hc as unknown as { pairingString?: string }).pairingString;
  if (direct && direct.startsWith("wc:")) return direct;
  const generate = (hc as unknown as { generatePairingString?: () => Promise<{ uri?: string }> }).generatePairingString;
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
  const mobilePairingUriRef = useRef<string | null>(null);

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
        // Pre-cache a pairing URI so mobile can deep-link immediately from a user gesture.
        void getPairingUri(hc).then((uri) => {
          if (uri) mobilePairingUriRef.current = uri;
        });
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
          hc = await getOrCreateHashConnect(network, projectId).catch(() => null);
          if (hc) setHashconnect(hc);
        }
      }
      if (!hc) {
        setError("Wallet initialization failed. Refresh and try again.");
        return;
      }

      if ((hc.connectedAccountIds?.length ?? 0) > 0) return;

      const mobileBrowser = isMobileBrowser();

      // 1) Mobile: deep-link directly into HashPack.
      if (mobileBrowser) {
        const immediatePairingUri =
          mobilePairingUriRef.current ??
          ((hc as unknown as { pairingString?: string }).pairingString ?? null);
        if (immediatePairingUri && immediatePairingUri.startsWith("wc:")) {
          openHashPackMobileDeepLink(immediatePairingUri);
        }

        const pairingUri = immediatePairingUri && immediatePairingUri.startsWith("wc:")
          ? immediatePairingUri
          : await getPairingUri(hc);
        if (!pairingUri) {
          setError("Could not create a wallet pairing URI on mobile. Try refreshing and connecting again.");
          return;
        }
        mobilePairingUriRef.current = pairingUri;
        openHashPackMobileDeepLink(pairingUri);
        await waitForPairing(connectWaitRef, PAIRING_WAIT_MS);
        return;
      }

      // 2) Desktop: extension-only connect to avoid WalletConnect verify failures.
      const maybeConnectToExtension = (hc as unknown as { connectToExtension?: () => Promise<unknown> }).connectToExtension;
      if (typeof maybeConnectToExtension !== "function") {
        setError(
          "HashPack extension connection is unavailable. Install/unlock HashPack extension and disable conflicting wallet extensions on this site."
        );
        return;
      }
      const extErr = await maybeConnectToExtension.call(hc).then(() => null).catch((err: unknown) => err);
      if (extErr) {
        setError(
          "Could not connect to HashPack extension. Ensure HashPack is installed/unlocked and disable MetaMask/Brave Wallet for this site."
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
