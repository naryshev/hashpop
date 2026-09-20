"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldAlert } from "lucide-react";
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
import { truncateAdminAddr } from "../../lib/adminFormat";

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
      const message = `hashpop.admin.session:${t}`;
      const signResult = await (
        hashconnect as unknown as {
          signMessages: (accountId: string, messages: string[]) => Promise<unknown>;
        }
      ).signMessages(accountId, [message]);
      const signature = Array.isArray(signResult)
        ? (signResult[0] as string)
        : ((signResult as { signedMessages?: string[] })?.signedMessages?.[0] ??
          (signResult as string));
      if (!signature || typeof signature !== "string") {
        throw new Error("Could not get a signature from your wallet.");
      }
      const tok: AdminToken = { address: address.toLowerCase(), t, signature };
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

  if (view === "connect") {
    return (
      <main className="min-h-screen">
        <div className="mx-auto max-w-md space-y-4 px-4 py-16 text-center">
          <p className="text-sm text-silver">Sign in to continue.</p>
          <ConnectWalletButton />
        </div>
      </main>
    );
  }

  if (view === "checking") {
    return (
      <main className="min-h-screen">
        <div className="mx-auto max-w-md px-4 py-16 text-center text-sm text-silver">
          Checking access…
        </div>
      </main>
    );
  }

  if (view === "empty") {
    return (
      <main className="min-h-screen">
        <div className="mx-auto max-w-md px-4 py-16 text-center text-sm text-silver">
          Nothing here.
        </div>
      </main>
    );
  }

  if (view === "signin" || !session) {
    return (
      <main className="min-h-screen">
        <div className="mx-auto max-w-md space-y-4 px-4 py-16 text-center">
          <div className="inline-flex items-center justify-center rounded-full bg-amber-400/10 p-3">
            <ShieldAlert size={28} className="text-amber-300" />
          </div>
          <h1 className="text-xl font-bold text-white">Admin sign-in</h1>
          <p className="text-sm text-silver">
            You&apos;ll be asked to sign a session message in HashPack. The signature is kept on
            this device for 24 hours.
          </p>
          {error && <p className="text-xs text-rose-300">{error}</p>}
          <button
            type="button"
            onClick={() => void signIn()}
            disabled={signing}
            className="rounded-full bg-[#00ffa3] px-5 py-2.5 text-sm font-bold text-black disabled:opacity-60"
          >
            {signing ? "Waiting on wallet…" : "Sign in"}
          </button>
        </div>
      </main>
    );
  }

  return (
    <AdminSessionContext.Provider value={session}>
      <div className="min-h-screen md:flex">
        <aside
          className={`${material.regular} sticky top-0 z-10 shrink-0 border-b border-white/10 md:sticky md:top-14 md:h-[calc(100dvh-3.5rem)] md:w-56 md:border-b-0 md:border-r`}
        >
          <div className="flex items-center justify-between gap-3 px-4 py-3 md:block md:px-4 md:py-5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-rose-300/80">
                Restricted
              </p>
              <h1 className="text-lg font-extrabold tracking-tight text-white">Ops</h1>
              <p className="hidden font-mono text-[11px] text-silver md:block">
                {truncateAdminAddr(session.address)}
              </p>
            </div>
            <button
              type="button"
              onClick={session.signOut}
              className="rounded-full border border-rose-500/60 bg-rose-500/10 px-3 py-1.5 text-[11px] font-semibold text-rose-300 hover:bg-rose-500/20 md:mt-3"
            >
              Sign out
            </button>
          </div>
          <nav
            className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:overflow-visible md:px-3 md:pb-0"
            aria-label="Admin"
          >
            {ADMIN_NAV.map((item) => {
              if (item.comingSoon) {
                return (
                  <span
                    key={item.id}
                    className="flex shrink-0 items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs text-white/35"
                    title={`${item.phase ?? "Later"} — not in this release`}
                  >
                    <span>{item.label}</span>
                    <span className="hidden text-[9px] uppercase tracking-wider md:inline">
                      {item.phase ?? "Soon"}
                    </span>
                  </span>
                );
              }
              const active = item.id === activeTab;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`shrink-0 rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                    active
                      ? "bg-[#00ffa3]/15 text-[#00ffa3]"
                      : "text-white/70 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <div className="min-w-0 flex-1 px-4 py-5 sm:px-6">
          {error && (
            <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
              {error}
            </div>
          )}
          {children}
        </div>
      </div>
    </AdminSessionContext.Provider>
  );
}
