"use client";

import { Wallet } from "lucide-react";
import { useHashpackWallet } from "../../lib/hashpackWallet";

export default function AnimatedSignIn() {
  const { connect, isConnecting, isReady, error } = useHashpackWallet();

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#071b38]">
      <div className="pointer-events-none absolute -top-28 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-cyan-400/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-100px] left-[-80px] h-72 w-72 rounded-full bg-emerald-400/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-110px] right-[-90px] h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center px-4 py-8">
        <div className="w-full max-w-md rounded-2xl border border-white/15 bg-white/10 p-6 backdrop-blur-xl sm:p-8">
          <div className="mb-5 flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/hashpop-cart-3d.PNG"
              alt="Hashpop"
              className="h-16 w-auto object-contain drop-shadow-[0_12px_24px_rgba(0,0,0,0.35)]"
            />
          </div>

          <h1 className="text-center text-2xl font-bold text-white">Welcome to Hashpop</h1>
          <p className="mt-2 text-center text-sm text-slate-200">Connect your HashPack wallet to continue.</p>

          <button
            type="button"
            onClick={() => void connect()}
            disabled={!isReady || isConnecting}
            className="btn-frost-cta mt-6 flex w-full items-center justify-center gap-2 py-3 text-sm font-semibold disabled:opacity-60"
          >
            <Wallet size={16} />
            {!isReady ? "Loading wallet..." : isConnecting ? "Connecting..." : "Continue with HashPack"}
          </button>

          {error ? <p className="mt-3 text-center text-xs text-amber-300">{error}</p> : null}
        </div>
      </div>
    </main>
  );
}
