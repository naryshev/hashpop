"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { activeHederaChain } from "./hederaChains";

type HederaNetwork = "mainnet" | "testnet";
type HashConnectInstance = any;

type HashpackWalletContextValue = {
  hashconnect: HashConnectInstance | null;
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

const CONNECT_TIMEOUT_MS = 120_000;
const EXTENSION_WAIT_MS = 8_000;

function getNetwork(): HederaNetwork {
  return activeHederaChain.id === 295 ? "mainnet" : "testnet";
}

function getMirrorBase(network: HederaNetwork): string {
  return network === "mainnet"
    ? "https://mainnet.mirrornode.hedera.com"
    : "https://testnet.mirrornode.hedera.com";
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

export function HashpackWalletProvider({ children }: { children: React.ReactNode }) {
  const [hashconnect, setHashconnect] = useState<HashConnectInstance | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [address, setAddress] = useState<`0x${string}` | null>(null);
  const [balanceTinybar, setBalanceTinybar] = useState<bigint | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const network = getNetwork();
  const connectWaitRef = useRef<((value: void | PromiseLike<void>) => void) | null>(null);
  const initPromiseRef = useRef<Promise<HashConnectInstance> | null>(null);

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
    const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID?.trim();
    if (!projectId) {
      setError("Missing NEXT_PUBLIC_WC_PROJECT_ID. Add it to frontend/.env.local.");
      setIsReady(true);
      return;
    }

    initPromiseRef.current = (async () => {
      try {
        const [{ HashConnect }, sdk] = await Promise.all([
          import("hashconnect"),
          import("@hashgraph/sdk"),
        ]);
        const ledgerId = network === "mainnet" ? sdk.LedgerId.MAINNET : sdk.LedgerId.TESTNET;
        const metadata = {
          name: "hbay",
          description: "Hedera marketplace - HashPack native wallet flow",
          icons: ["https://hashpack.app/favicon.ico"],
          url: typeof window !== "undefined" ? window.location.origin : "http://localhost:3000",
        };

        const hc = new HashConnect(ledgerId, projectId, metadata, false);
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
            setAddress(mirrorData.evmAddress ?? accountIdToLongZeroAddress(first));
            setBalanceTinybar(mirrorData.balanceTinybar);
          }
        });

        hc.disconnectionEvent.on(() => {
          if (!mounted) return;
          setAccountId(null);
          setAddress(null);
          setBalanceTinybar(null);
        });

        await hc.init();
        if (!mounted) return;
        setHashconnect(hc);
        setIsReady(true);
        const first = hc.connectedAccountIds[0]?.toString() ?? null;
        if (first) {
          setAccountId(first);
          const mirrorData = await fetchMirrorAccount(first, network);
          if (!mounted) return;
          setAddress(mirrorData.evmAddress ?? accountIdToLongZeroAddress(first));
          setBalanceTinybar(mirrorData.balanceTinybar);
        }
        return hc;
      } catch (e) {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : "Failed to initialize HashPack connection");
        setIsReady(true);
        throw e;
      }
    })();

    return () => {
      mounted = false;
      initPromiseRef.current = null;
    };
  }, [network]);

  const connect = useCallback(async () => {
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
      // Extension-first flow: trigger the internal extension pairing path when available.
      const maybeConnectToExtension = (hc as { connectToExtension?: () => Promise<unknown> }).connectToExtension;
      if (typeof maybeConnectToExtension === "function") {
        await maybeConnectToExtension.call(hc).catch(() => {});
      }

      // Do not open WalletConnect modal; wait for extension pairing event.
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          connectWaitRef.current = null;
          reject(new Error("No response from HashPack extension. Open HashPack, unlock it, and click Connect again."));
        }, EXTENSION_WAIT_MS);
        connectWaitRef.current = () => {
          clearTimeout(timeout);
          resolve();
        };
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Wallet connection failed.";
      setError(msg);
      return;
    } finally {
      setIsConnecting(false);
    }
  }, [hashconnect]);

  const disconnect = useCallback(async () => {
    if (!hashconnect) return;
    await hashconnect.disconnect();
    setAccountId(null);
    setAddress(null);
    setBalanceTinybar(null);
  }, [hashconnect]);

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
