"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Wallet, Copy, Check, QrCode, ChevronUp } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useHashpackWallet } from "../../lib/hashpackWallet";
import { buildHashPackDeepLink } from "../../lib/hashpackWallet";

export default function AnimatedSignIn() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { connect, isConnecting, isReady, error, isConnected, pairingUri } = useHashpackWallet();
  const lastPressAtRef = useRef(0);
  const [deepLinkFired, setDeepLinkFired] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [copied, setCopied] = useState(false);

  const returnTo = searchParams.get("returnTo");

  useEffect(() => {
    if (!isConnected) return;
    const dest = returnTo && returnTo.startsWith("/") ? returnTo : "/dashboard";
    router.replace(dest);
  }, [isConnected, router, returnTo]);

  useEffect(() => {
    const dest = returnTo && returnTo.startsWith("/") ? returnTo : "/dashboard";
    router.prefetch(dest);
  }, [router, returnTo]);

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

  const handleCopyPairingString = useCallback(async () => {
    if (!pairingUri) return;
    try {
      await navigator.clipboard.writeText(pairingUri);
    } catch {
      // Fallback for browsers without clipboard API
      const el = document.createElement("textarea");
      el.value = pairingUri;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [pairingUri]);

  const buttonLabel = !isReady
    ? "Loading wallet..."
    : isConnecting
      ? "Connecting..."
      : "Continue with HashPack";

  const canShowQr = !!pairingUri && isReady && !isConnecting;

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

            {/* QR / pairing string section */}
            {canShowQr && (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setShowQr((v) => !v)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
                >
                  {showQr ? (
                    <>
                      <ChevronUp size={13} />
                      Hide QR code
                    </>
                  ) : (
                    <>
                      <QrCode size={13} />
                      Scan QR code with HashPack
                    </>
                  )}
                </button>

                {showQr && (
                  <div className="mt-4 flex flex-col items-center gap-4">
                    {/* QR code */}
                    <div className="rounded-2xl bg-white p-4 shadow-lg">
                      <QRCodeSVG
                        value={pairingUri}
                        size={200}
                        bgColor="#ffffff"
                        fgColor="#0b111b"
                        level="M"
                        imageSettings={{
                          src: "/hashpop-cart-3d.PNG",
                          height: 36,
                          width: 36,
                          excavate: true,
                        }}
                      />
                    </div>
                    <p className="text-center text-xs text-slate-400">
                      Open HashPack → Scan QR to pair
                    </p>

                    {/* Copy pairing string */}
                    <div className="w-full">
                      <p className="mb-1.5 text-center text-xs font-medium text-slate-400">
                        Or paste the pairing string into HashPack
                      </p>
                      <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#0d1220] px-3 py-2">
                        <span className="flex-1 truncate font-mono text-[10px] text-slate-400 select-all">
                          {pairingUri}
                        </span>
                        <button
                          type="button"
                          onClick={handleCopyPairingString}
                          title="Copy pairing string"
                          className="flex shrink-0 items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
                        >
                          {copied ? (
                            <>
                              <Check size={12} className="text-emerald-400" />
                              <span className="text-emerald-400">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy size={12} />
                              Copy
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
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
