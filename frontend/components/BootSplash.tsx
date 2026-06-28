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
    const MIN_VISIBLE_MS = 450;
    const start = performance.now();

    const finish = () => {
      const elapsed = performance.now() - start;
      const wait = Math.max(0, MIN_VISIBLE_MS - elapsed);
      window.setTimeout(() => setHidden(true), wait);
    };

    if (document.readyState === "complete") {
      finish();
    } else {
      window.addEventListener("load", finish, { once: true });
      // Safety net in case `load` never fires (cached assets, etc.).
      const fallback = window.setTimeout(finish, 2500);
      return () => {
        window.removeEventListener("load", finish);
        window.clearTimeout(fallback);
      };
    }
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
      className={`fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#0b111b] transition-opacity duration-500 ease-out ${
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
      </div>
    </div>
  );
}
