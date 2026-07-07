"use client";

import { useEffect, useState } from "react";

/**
 * Full-screen boot splash. Rendered visible by default so it's present in the
 * server HTML and covers the chrome on first paint (no footer flash). After
 * hydration + window load it fades out smoothly, then unmounts.
 */
export function BootSplash() {
  const [hidden, setHidden] = useState(false);
  const [removed, setRemoved] = useState(false);

  useEffect(() => {
    const MIN_VISIBLE_MS = 400;
    // Hard cap so the splash never hangs on routes that don't emit a ready
    // signal (or if data is unusually slow).
    const MAX_VISIBLE_MS = 3500;
    const start = performance.now();
    let done = false;

    const finish = () => {
      if (done) return;
      done = true;
      const wait = Math.max(0, MIN_VISIBLE_MS - (performance.now() - start));
      window.setTimeout(() => setHidden(true), wait);
    };

    // The active page dispatches `hashpop:ready` once its real content has
    // mounted (see MarketplacePageClient). If it already fired before this
    // effect ran, the global flag catches it.
    if ((window as unknown as { __hashpopReady?: boolean }).__hashpopReady) {
      finish();
      return;
    }
    window.addEventListener("hashpop:ready", finish, { once: true });
    const cap = window.setTimeout(finish, MAX_VISIBLE_MS);
    return () => {
      window.removeEventListener("hashpop:ready", finish);
      window.clearTimeout(cap);
    };
  }, []);

  // Unmount after the fade-out transition completes.
  useEffect(() => {
    if (!hidden) return;
    const t = window.setTimeout(() => setRemoved(true), 600);
    return () => window.clearTimeout(t);
  }, [hidden]);

  if (removed) return null;

  return (
    <div
      aria-hidden
      className={`hp-splash-overlay fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#0b111b] transition-opacity duration-500 ease-out ${
        hidden ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <div className="flex flex-col items-center gap-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/hashpop-cart-3d.PNG"
          alt=""
          className="hp-splash-logo h-16 w-auto object-contain drop-shadow-[0_0_24px_rgba(0,255,163,0.25)]"
        />
        <div className="h-1 w-40 overflow-hidden rounded-full bg-white/10">
          <div className="hp-splash-bar h-full w-1/3 rounded-full bg-[linear-gradient(90deg,transparent,#00ffa3,#00e5ff,transparent)]" />
        </div>
        {/* Filled by the boot error catcher in layout.tsx when a fatal error
            hits before/at hydration — makes webview failures screenshotable. */}
        <pre
          id="hp-boot-error"
          className="hidden max-h-40 max-w-[85vw] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-300"
        />
      </div>
    </div>
  );
}
