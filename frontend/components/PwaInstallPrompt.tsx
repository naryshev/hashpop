"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { QRCodeSVG } from "qrcode.react";
import { X } from "lucide-react";

const SEEN_KEY = "hashpop.pwaPromptSeen";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * First-visit desktop prompt nudging the user to install Hashpop as a PWA on
 * their phone. Shows a QR code that opens the site on mobile (where it can be
 * added to the home screen) and, when the browser supports it, a direct
 * "Install" button for the current desktop. Shown once per browser.
 */
export function PwaInstallPrompt() {
  const [open, setOpen] = useState(false);
  const [origin, setOrigin] = useState("https://hashpop.io");
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Only once per browser.
    let seen = false;
    try {
      seen = window.localStorage.getItem(SEEN_KEY) === "1";
    } catch {
      // ignore
    }
    if (seen) return;

    // Desktop only, and not already running as an installed app.
    const isDesktop = window.matchMedia("(min-width: 768px) and (pointer: fine)").matches;
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (!isDesktop || isStandalone) return;

    setOrigin(window.location.origin);

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    // Delay slightly so it doesn't slam the user the instant the page paints.
    const t = setTimeout(() => setOpen(true), 1200);
    return () => {
      clearTimeout(t);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
    };
  }, []);

  const dismiss = () => {
    setOpen(false);
    try {
      window.localStorage.setItem(SEEN_KEY, "1");
    } catch {
      // ignore
    }
  };

  const installHere = async () => {
    if (!installEvent) return;
    try {
      await installEvent.prompt();
      await installEvent.userChoice;
    } catch {
      // ignore
    } finally {
      dismiss();
    }
  };

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Install Hashpop"
      onClick={dismiss}
    >
      <div
        className="relative grid w-full max-w-2xl overflow-hidden rounded-3xl border border-white/10 shadow-[0_24px_64px_rgba(0,0,0,0.55)] sm:grid-cols-2"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={dismiss}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white/80 hover:bg-black/60 hover:text-white"
        >
          <X size={18} />
        </button>

        {/* Left: pitch */}
        <div className="flex flex-col justify-between gap-6 bg-[#0e1422] p-8">
          <div>
            <h2 className="text-2xl font-extrabold leading-tight text-white">
              Trade verifiably on the go.
            </h2>
            <p className="mt-2 bg-[linear-gradient(100deg,#00ffa3,#00e5ff)] bg-clip-text text-2xl font-extrabold text-transparent">
              Download Hashpop.
            </p>
            <p className="mt-4 max-w-xs text-sm text-silver">
              Add Hashpop to your home screen for one-tap access to the on-chain
              marketplace — buy, sell and track escrow anywhere.
            </p>
          </div>
          {installEvent && (
            <button
              type="button"
              onClick={installHere}
              className="self-start rounded-full bg-[linear-gradient(110deg,#00b37a,#00ffa3,#00e5ff)] px-5 py-2.5 text-sm font-bold text-black shadow-glow"
            >
              Install on this computer
            </button>
          )}
        </div>

        {/* Right: QR */}
        <div className="flex flex-col items-center justify-center gap-4 bg-[linear-gradient(160deg,#0b3b8f,#0b69d4)] p-8 text-center">
          <p className="text-sm font-semibold text-white/90">
            Scan with your phone&apos;s camera
          </p>
          <div className="rounded-2xl bg-white p-3 shadow-lg">
            <QRCodeSVG
              value={origin}
              size={168}
              bgColor="#ffffff"
              fgColor="#0b111b"
              level="M"
              imageSettings={{
                src: "/hashpop-cart-3d.PNG",
                height: 32,
                width: 32,
                excavate: true,
              }}
            />
          </div>
          <p className="max-w-[200px] text-xs text-white/80">
            Open the link, then tap <span className="font-semibold">Share → Add to Home Screen</span>.
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
