"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Wallet, Copy, Check, QrCode, ChevronUp } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useHashpackWallet, buildHashPackDeepLink } from "../../lib/hashpackWallet";

type SignInCardProps = {
  onConnected?: () => void;
  className?: string;
};

/**
 * Reusable HashPack sign-in card. Renders the "Continue with HashPack" CTA,
 * QR / pairing-string fallback, and the trust-feature list. Used on /signin
 * and inside RequireWalletModal so both surfaces share connection logic.
 */
export function SignInCard({ onConnected, className }: SignInCardProps) {
  const { connect, isConnecting, isReady, error, isConnected, pairingUri } = useHashpackWallet();
  const lastPressAtRef = useRef(0);
  const [deepLinkFired, setDeepLinkFired] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isConnected) onConnected?.();
  }, [isConnected, onConnected]);

  const handleConnectPress = useCallback(() => {
    const now = Date.now();
    if (now - lastPressAtRef.current < 300) return;
    lastPressAtRef.current = now;

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

    window.setTimeout(() => {
      void connect();
    }, 0);
  }, [connect, pairingUri]);

  const handleCopyPairingString = useCallback(async () => {
    if (!pairingUri) return;
    try {
      await navigator.clipboard.writeText(pairingUri);
    } catch {
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
    <div
      className={
        className ??
        "rounded-3xl border border-white/15 bg-[#15181f]/90 p-6 shadow-[0_16px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:p-8"
      }
    >
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

      {deepLinkFired && isConnecting && (
        <p className="mt-3 text-center text-xs text-slate-300/80">
          Approve the connection in HashPack, then return here.
        </p>
      )}

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
              <p className="text-center text-xs text-slate-400">Open HashPack → Scan QR to pair</p>

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
