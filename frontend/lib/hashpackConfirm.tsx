"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

type HashPackConfirmContextValue = {
  show: () => void;
  hide: () => void;
  /**
   * Optional one-line mono context shown under the title (e.g.
   * "escrow 0.0.88231 · locking 100 ℏ"). Set before triggering the write;
   * cleared automatically on hide().
   */
  setDetail: (detail: string | null) => void;
};

const HashPackConfirmContext = createContext<HashPackConfirmContextValue>({
  show: () => {},
  hide: () => {},
  setDetail: () => {},
});

const HASHPACK_DEEP_LINK = "hashpack://";

function sendBrowserNotification(): Notification | null {
  if (typeof window === "undefined" || !("Notification" in window)) return null;
  if (Notification.permission !== "granted") return null;
  try {
    const n = new Notification("Confirm in HashPack", {
      body: "Open the HashPack app to approve your transaction",
      icon: "https://hashpack.app/favicon.ico",
      tag: "hashpack-confirm",
      requireInteraction: true,
    });
    n.onclick = () => {
      window.focus();
      window.location.href = HASHPACK_DEEP_LINK;
      n.close();
    };
    return n;
  } catch {
    return null;
  }
}

function requestAndNotify(activeNotifRef: React.MutableRefObject<Notification | null>) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission === "granted") {
    activeNotifRef.current?.close();
    activeNotifRef.current = sendBrowserNotification();
  } else if (Notification.permission === "default") {
    // Permission request tied to user gesture (click on Buy/Confirm triggers this path)
    void Notification.requestPermission().then((perm) => {
      if (perm === "granted") {
        activeNotifRef.current?.close();
        activeNotifRef.current = sendBrowserNotification();
      }
    });
  }
  // "denied" → silently skip; the in-page modal is still shown
}

function ConfirmModal({ onClose, detail }: { onClose: () => void; detail: string | null }) {
  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Approve your transaction in HashPack"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Panel — demo-video "Submitting to the Hashgraph…" sheet: bottom
          sheet on mobile, centered card on desktop, glowing spinner ring,
          bold title, and a mono context line. */}
      <div
        className="relative z-10 w-full max-w-md rounded-t-3xl border border-white/10 bg-[#10161f] px-6 pt-3 shadow-[0_-12px_40px_rgba(0,0,0,0.5)] animate-[fadeSlideUp_0.25s_ease-out] sm:rounded-3xl"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 24px)" }}
      >
        <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-white/15 sm:invisible" />

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full text-white/40 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Dismiss"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path
              d="M1 1l10 10M11 1L1 11"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
            />
          </svg>
        </button>

        <div className="flex flex-col items-center gap-5 py-6 text-center">
          {/* Glowing spinner ring */}
          <div
            className="h-20 w-20 animate-spin rounded-full border-4 border-[#00ffa3]/15 border-t-[#00ffa3]"
            style={{
              boxShadow: "0 0 32px rgba(0,255,163,0.25), inset 0 0 18px rgba(0,255,163,0.12)",
              animationDuration: "1.1s",
            }}
            aria-hidden
          />

          {/* Copy */}
          <div className="space-y-2">
            <h2 className="text-xl font-extrabold tracking-tight text-white">
              Submitting to the Hashgraph…
            </h2>
            <p className="text-sm leading-relaxed text-silver">
              Approve the transaction in HashPack to continue.
            </p>
            {detail && (
              <p className="font-mono text-[13px] text-silver/70">{detail}</p>
            )}
          </div>

          {/* CTA */}
          <a
            href={HASHPACK_DEEP_LINK}
            className="btn-mint w-full py-3.5 text-center text-sm uppercase tracking-[0.2em]"
            onClick={() => setTimeout(onClose, 800)}
          >
            Open HashPack
          </a>

          {/* Download fallback */}
          <p className="text-xs text-white/30">
            Don&apos;t have HashPack?{" "}
            <a
              href="https://www.hashpack.app/download"
              target="_blank"
              rel="noopener noreferrer"
              className="underline transition-colors hover:text-white/60"
              onClick={onClose}
            >
              Download it here
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

export function HashPackConfirmProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [detail, setDetailState] = useState<string | null>(null);
  const activeNotifRef = useRef<Notification | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const show = useCallback(() => {
    setIsOpen(true);
    requestAndNotify(activeNotifRef);
  }, []);

  const hide = useCallback(() => {
    setIsOpen(false);
    setDetailState(null);
    activeNotifRef.current?.close();
    activeNotifRef.current = null;
  }, []);

  const setDetail = useCallback((value: string | null) => {
    setDetailState(value);
  }, []);

  return (
    <HashPackConfirmContext.Provider value={{ show, hide, setDetail }}>
      {children}
      {mounted &&
        isOpen &&
        createPortal(<ConfirmModal onClose={hide} detail={detail} />, document.body)}
    </HashPackConfirmContext.Provider>
  );
}

export function useHashPackConfirm(): HashPackConfirmContextValue {
  return useContext(HashPackConfirmContext);
}
