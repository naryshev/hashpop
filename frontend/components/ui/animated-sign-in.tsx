"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Wallet } from "lucide-react";
import { useHashpackWallet } from "../../lib/hashpackWallet";
import { buildHashPackDeepLink } from "../../lib/hashpackWallet";

export default function AnimatedSignIn() {
  const router = useRouter();
  const { connect, isConnecting, isReady, error, isConnected, pairingUri } = useHashpackWallet();
  const lastPressAtRef = useRef(0);
  const [deepLinkFired, setDeepLinkFired] = useState(false);

  useEffect(() => {
    if (!isConnected) return;
    router.replace("/dashboard");
  }, [isConnected, router]);

  useEffect(() => {
    router.prefetch("/dashboard");
  }, [router]);

  const handleConnectPress = useCallback(() => {
    const now = Date.now();
    if (now - lastPressAtRef.current < 300) return;
    lastPressAtRef.current = now;

    // Fire the HashPack deep-link synchronously inside the user gesture so
    // mobile browsers do not block the custom-scheme navigation.
    if (pairingUri) {
      const deeplink = buildHashPackDeepLink(pairingUri);
      const isMobile = /Android|iPhone|iPad|iPod/i.test(
        typeof navigator !== "undefined" ? navigator.userAgent : "",
      );
      if (isMobile) {
        window.location.href = deeplink;
        setDeepLinkFired(true);
      }
    }

    // Yield one frame so pressed state can paint before async wallet work starts.
    window.setTimeout(() => {
      void connect();
    }, 0);
  }, [connect, pairingUri]);

  const buttonLabel = !isReady
    ? "Loading wallet..."
    : isConnecting
      ? "Connecting..."
      : "Continue with HashPack";

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#071b38]">
      {/* Ambient glow orbs */}
      <div className="pointer-events-none absolute -top-28 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-cyan-400/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-100px] left-[-80px] h-72 w-72 rounded-full bg-emerald-400/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-110px] right-[-90px] h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          {/* Logo */}
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
            {/* Primary CTA */}
            <button
              type="button"
              onClick={handleConnectPress}
              disabled={!isReady || isConnecting}
              className="btn-frost-cta flex w-full items-center justify-center gap-2 py-4 text-base font-semibold disabled:opacity-60"
              style={{ touchAction: "manipulation", minHeight: "52px" }}
            >
              <Wallet size={18} />
              {buttonLabel}
            </button>

            {/* After deep-link fires on mobile: show "waiting" hint */}
            {deepLinkFired && isConnecting && (
              <p className="mt-3 text-center text-xs text-slate-300/80">
                Approve the connection in HashPack, then return here.
              </p>
            )}

            {/* Download fallback — shown after a failed attempt or when not ready after a delay */}
            {deepLinkFired && !isConnecting && !isConnected && (
              <p className="mt-3 text-center text-xs text-slate-400">
                HashPack didn&apos;t open?{" "}
                <a
                  href="https://www.hashpack.app/download"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-[#14a4ff] underline underline-offset-2"
                >
                  Download HashPack
                </a>
              </p>
            )}

            {/* Feature list */}
            <div className="mt-6 space-y-3">
              <Feature
                title="Trade trusted listings"
                detail="Buy and sell with transparent on-chain records."
              />
              <Feature
                title="Verify item history"
                detail="Track listing status, updates, and ownership signals."
              />
              <Feature
                title="Faster marketplace discovery"
                detail="Swipe featured items or search by category instantly."
              />
              <Feature
                title="Secure wallet-first sign in"
                detail="No passwords — authenticate directly with HashPack."
              />
            </div>

            {error ? <p className="mt-3 text-center text-xs text-amber-300">{error}</p> : null}
          </div>

          {/* Always-visible download link for first-time visitors */}
          <p className="mt-4 text-center text-xs text-slate-500">
            Don&apos;t have HashPack?{" "}
            <a
              href="https://www.hashpack.app/download"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 underline underline-offset-2 hover:text-white"
            >
              Get it free
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}

function Feature({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/20 text-[10px] text-white/80">
        ✓
      </span>
      <div>
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="text-sm text-slate-300/90">{detail}</p>
      </div>
    </div>
  );
}
