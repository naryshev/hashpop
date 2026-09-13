"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "hashpop.cookie.ack.v1";

/**
 * Lightweight storage/cookie notice. Hashpop sets no advertising cookies —
 * analytics are cookieless (Vercel) and local storage holds session
 * conveniences — so this is an informational notice with a single OK, not a
 * consent wall. Dismissal is remembered per browser.
 */
export function CookieNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!window.localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {
      // Storage unavailable (private mode edge cases) — stay hidden rather
      // than show a notice that can never be dismissed.
    }
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {
      // ignore
    }
  };

  return (
    <div
      role="region"
      aria-label="Cookies and storage notice"
      className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+84px)] z-[80] md:inset-x-auto md:bottom-4 md:right-4 md:max-w-sm"
    >
      <div className="rounded-2xl border border-white/10 bg-[#12161f]/95 p-4 shadow-[0_12px_40px_rgba(0,0,0,0.5)] backdrop-blur-xl">
        <p className="text-[13px] leading-relaxed text-silver">
          Hashpop uses local storage for your session and cart, plus cookieless analytics.
          No advertising cookies.{" "}
          <Link href="/privacy" className="font-medium text-[#00ffa3] hover:underline">
            Privacy policy
          </Link>
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="btn-mint mt-3 w-full py-2.5 text-sm font-bold"
        >
          OK
        </button>
      </div>
    </div>
  );
}
