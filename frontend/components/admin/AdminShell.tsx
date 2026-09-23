"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useHashpackWallet } from "../../lib/hashpackWallet";
import { ConnectWalletButton } from "../ConnectWalletButton";
import { getApiUrl } from "../../lib/apiUrl";
import { material } from "../../lib/materials";
import { resolveAdminGateView } from "../../lib/adminGate";
import { ADMIN_NAV, adminTabFromPath } from "../../lib/adminNav";
import {
  adminHeader,
  loadAdminToken,
  saveAdminToken,
  type AdminToken,
} from "../../lib/adminSession";
import { AdminWallet } from "./AdminBadge";
import { signAdminSession } from "../../lib/hashpackSignature";

type AdminSessionValue = {
  token: AdminToken;
  headers: Record<string, string>;
  address: string;
  signOut: () => void;
  handleAuthStatus: (status: number) => boolean;
};

const AdminSessionContext = createContext<AdminSessionValue | null>(null);

export function useAdminSession(): AdminSessionValue {
  const ctx = useContext(AdminSessionContext);
  if (!ctx) throw new Error("useAdminSession must be used within AdminShell");
  return ctx;
}

function GateCanvas({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-bg px-4">
      <div className="mx-auto max-w-md text-center">{children}</div>
    </main>
  );
}

function HydratingSkeleton() {
  return (
    <main className="min-h-[100dvh] bg-bg p-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className={`${material.regular} h-[88px] animate-pulse rounded-[14px] bg-white/[0.04]`}
          />
        ))}
      </div>
    </main>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { address, accountId, hashconnect, isConnected } = useHashpackWallet();
  const pathname = usePathname();
  const [token, setToken] = useState<AdminToken | null>(null);
  const [tokenHydrated, setTokenHydrated] = useState(false);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setToken(loadAdminToken());
    setTokenHydrated(true);
  }, []);

  useEffect(() => {
    if (!address) {
      setIsAdmin(null);
      return;
    }
    let cancelled = false;
    fetch(`${getApiUrl()}/api/admin/check?address=${encodeURIComponent(address)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((d: { isAdmin?: boolean }) => {
        if (!cancelled) setIsAdmin(!!d.isAdmin);
      })
      .catch(() => {
        if (!cancelled) setIsAdmin(false);
      });
    return () => {
      cancelled = true;
    };
  }, [address]);

  useEffect(() => {
    if (!token || !address) return;
    if (token.address.toLowerCase() !== address.toLowerCase()) {
      saveAdminToken(null);
      setToken(null);
    }
  }, [token, address]);

  const signOut = useCallback(() => {
    saveAdminToken(null);
    setToken(null);
  }, []);

  const handleAuthStatus = useCallback(
    (status: number) => {
      if (status === 401 || status === 403) {
        signOut();
        setError("Admin session expired. Please sign in again.");
        return true;
      }
      return false;
    },
    [signOut],
  );

  const signIn = useCallback(async () => {
    if (!address || !accountId || !hashconnect) return;
    setSigning(true);
    setError(null);
    try {
      const t = Date.now();
      const signature = await signAdminSession(
        hashconnect as unknown as {
          signMessages: (accountId: string, message: string) => Promise<unknown>;
        },
        accountId,
        t,
      );
      const tok: AdminToken = { address: address.toLowerCase(), t, signature };
      const res = await fetch(`${getApiUrl()}/api/admin/session`, { headers: adminHeader(tok) });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || "Admin sign-in was rejected.");
      }
      saveAdminToken(tok);
      setToken(tok);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to sign in.");
    } finally {
      setSigning(false);
    }
  }, [address, accountId, hashconnect]);

  const view = resolveAdminGateView({
    isConnected,
    tokenHydrated,
    isAdmin,
    hasToken: !!token,
  });
  const activeTab = adminTabFromPath(pathname);

  const session = useMemo<AdminSessionValue | null>(() => {
    if (!token) return null;
    return {
      token,
      headers: adminHeader(token),
      address: token.address,
      signOut,
      handleAuthStatus,
    };
  }, [token, signOut, handleAuthStatus]);

  if (view === "checking") return <HydratingSkeleton />;

  if (view === "connect") {
    return (
      <GateCanvas>
        <p className="text-sm text-silver">Sign in to continue.</p>
        <div className="mt-4">
          <ConnectWalletButton />
        </div>
      </GateCanvas>
    );
  }

  if (view === "empty") {
    return (
      <GateCanvas>
        <h1 className="text-xl font-bold text-white">Nothing here.</h1>
      </GateCanvas>
    );
  }

  if (view === "signin" || !session) {
    return (
      <GateCanvas>
        <h1 className="text-xl font-bold text-white">Admin sign-in</h1>
        <p className="mt-2 text-sm text-silver">
          Sign a session message in HashPack. The signature stays on this device for 24 hours.
        </p>
        {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
        <button
          type="button"
          onClick={() => void signIn()}
          disabled={signing}
          className="mt-4 rounded-[14px] bg-[#00ffa3] px-5 py-2.5 text-sm font-bold text-on-chrome disabled:opacity-60"
        >
          {signing ? "Waiting on wallet…" : "Sign to continue"}
        </button>
      </GateCanvas>
    );
  }

  return (
    <AdminSessionContext.Provider value={session}>
      <div className="min-h-[100dvh] bg-bg md:flex">
        <aside
          className={`${material.thick} hidden w-[220px] shrink-0 border-r border-hairline md:flex md:flex-col`}
        >
          <div className="px-4 py-5">
            <p className="text-sm font-semibold text-white">Ops</p>
          </div>
          <nav className="flex flex-1 flex-col gap-1 px-3 pb-4" aria-label="Admin">
            {ADMIN_NAV.filter((item) => !item.secondary).map((item) => {
              if (item.comingSoon) {
                return (
                  <span
                    key={item.id}
                    className="flex items-center justify-between rounded-[12px] px-3 py-2 text-sm text-silver"
                  >
                    {item.label}
                    <span className={`${material.regular} rounded-full px-2 py-0.5 text-[10px]`}>
                      Soon
                    </span>
                  </span>
                );
              }
              const active = item.id === activeTab;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`rounded-[12px] px-3 py-2 text-sm font-medium ${
                    active ? `${material.chrome} text-chrome` : "text-silver hover:bg-white/[0.04]"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            <div className="mt-auto border-t border-hairline pt-3">
              {ADMIN_NAV.filter((item) => item.secondary).map((item) => {
                const active = item.id === activeTab;
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={`block rounded-[12px] px-3 py-2 text-[13px] ${
                      active ? "text-white/70" : "text-white/35 hover:text-white/55"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header
            className={`${material.regular} sticky top-0 z-20 flex h-12 items-center gap-3 border-b border-hairline px-4`}
          >
            <span className="text-sm font-semibold text-white">Ops</span>
            <span className="text-silver">·</span>
            <AdminWallet address={session.address} isAdmin />
            <div className="flex-1" />
            <button
              type="button"
              onClick={session.signOut}
              className="rounded-[12px] px-3 py-1.5 text-xs font-medium text-silver hover:bg-white/[0.04] hover:text-white"
            >
              Sign out
            </button>
          </header>

          <nav
            className="flex gap-1 overflow-x-auto border-b border-hairline px-3 py-2 md:hidden"
            aria-label="Admin"
          >
            {ADMIN_NAV.map((item) => {
              if (item.comingSoon) {
                return (
                  <span
                    key={item.id}
                    className="shrink-0 rounded-[12px] px-3 py-1.5 text-xs text-silver"
                  >
                    {item.label}
                    <span className="ml-1 text-[10px] text-white/35">Soon</span>
                  </span>
                );
              }
              const active = item.id === activeTab;
              const tone = item.secondary
                ? `text-[11px] ${active ? "text-white/70" : "text-white/35"}`
                : `text-xs ${active ? `${material.chrome} text-chrome` : "text-silver"}`;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`shrink-0 rounded-[12px] px-3 py-1.5 font-medium ${tone}`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="min-w-0 flex-1 px-4 py-4 sm:px-6">
            {error && (
              <div className="mb-3 rounded-[14px] border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                {error}
              </div>
            )}
            {children}
          </div>
        </div>
      </div>
    </AdminSessionContext.Provider>
  );
}
