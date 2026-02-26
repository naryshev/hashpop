"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Wallet } from "lucide-react";
import { useHashpackWallet } from "../../lib/hashpackWallet";

export default function AnimatedSignIn() {
  const router = useRouter();
  const { connect, isConnecting, isReady, error, isConnected } = useHashpackWallet();
  const lastPressAtRef = useRef(0);

  useEffect(() => {
    if (!isConnected) return;
    router.replace("/dashboard");
  }, [isConnected, router]);

  useEffect(() => {
    router.prefetch("/dashboard");
  }, [router]);

  const handleConnectPress = useCallback(() => {
    const now = Date.now();
    // Ignore duplicate click/touch events fired in quick succession.
    if (now - lastPressAtRef.current < 300) return;
    lastPressAtRef.current = now;
    // Yield one frame so pressed/disabled state can paint before wallet connect work starts.
    window.setTimeout(() => {
      void connect();
    }, 0);
  }, [connect]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#071b38]">
      <div className="pointer-events-none absolute -top-28 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-cyan-400/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-100px] left-[-80px] h-72 w-72 rounded-full bg-emerald-400/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-110px] right-[-90px] h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="mb-5 flex items-center justify-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/hashpop-cart-3d.PNG"
              alt="Hashpop cart"
              className="h-16 w-auto object-contain drop-shadow-[0_12px_24px_rgba(0,0,0,0.35)]"
            />
            <span className="bg-[linear-gradient(100deg,#ff2f3d_0%,#ff8f00_32%,#13a0ff_62%,#6ddf85_100%)] bg-clip-text text-4xl font-extrabold tracking-tight text-transparent">
              hashpop
            </span>
          </div>

          <div className="rounded-3xl border border-white/15 bg-[#15181f]/90 p-6 shadow-[0_16px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:p-8">
          <button
            type="button"
            onClick={handleConnectPress}
            disabled={!isReady || isConnecting}
            className="btn-frost-cta flex w-full items-center justify-center gap-2 py-3 text-sm font-semibold disabled:opacity-60"
            style={{ touchAction: "manipulation" }}
          >
            <Wallet size={16} />
            {!isReady ? "Loading wallet..." : isConnecting ? "Connecting..." : "Continue with HashPack"}
          </button>

          <div className="mt-6 space-y-3">
            <Feature title="Trade trusted listings" detail="Buy and sell with transparent on-chain records." />
            <Feature title="Verify item history" detail="Track listing status, updates, and ownership signals." />
            <Feature title="Faster marketplace discovery" detail="Swipe featured items or search by category instantly." />
            <Feature title="Secure wallet-first sign in" detail="No passwords - authenticate directly with HashPack." />
          </div>

          {error ? <p className="mt-3 text-center text-xs text-amber-300">{error}</p> : null}
          </div>
        </div>
      </div>
    </main>
  );
}

function Feature({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/20 text-[10px] text-white/80">
        ✓
      </span>
      <div>
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="text-sm text-slate-300/90">{detail}</p>
      </div>
    </div>
  );
}
