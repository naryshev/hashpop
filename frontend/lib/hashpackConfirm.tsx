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
};

const HashPackConfirmContext = createContext<HashPackConfirmContextValue>({
  show: () => {},
  hide: () => {},
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

function ConfirmModal({ onClose }: { onClose: () => void }) {
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
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Open HashPack to confirm your transaction"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-sm bg-[#0d0d0d] border border-white/10 rounded-2xl p-6 shadow-2xl animate-[fadeSlideUp_0.2s_ease-out]">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center text-white/40 hover:text-white transition-colors rounded-full hover:bg-white/10"
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

        <div className="flex flex-col items-center text-center gap-5">
          {/* Icon */}
          <div className="w-16 h-16 rounded-2xl overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://hashpack.app/favicon.ico"
              alt=""
              aria-hidden="true"
              width={40}
              height={40}
              className="w-10 h-10"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </div>

          {/* Copy */}
          <div className="space-y-1.5">
            <h2 className="text-white font-semibold text-lg leading-tight">
              Open HashPack to Confirm
            </h2>
            <p className="text-white/50 text-sm leading-relaxed">
              A transaction is waiting for your approval in the HashPack app.
            </p>
          </div>

          {/* CTA */}
          <a
            href={HASHPACK_DEEP_LINK}
            className="w-full bg-white text-black font-bold uppercase tracking-widest py-3.5 text-sm hover:bg-gray-100 active:bg-gray-200 transition-colors text-center"
            onClick={() => setTimeout(onClose, 800)}
          >
            Open HashPack
          </a>

          {/* Download fallback */}
          <p className="text-white/30 text-xs">
            Don&apos;t have HashPack?{" "}
            <a
              href="https://www.hashpack.app/download"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-white/60 transition-colors"
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
    activeNotifRef.current?.close();
    activeNotifRef.current = null;
  }, []);

  return (
    <HashPackConfirmContext.Provider value={{ show, hide }}>
      {children}
      {mounted && isOpen && createPortal(<ConfirmModal onClose={hide} />, document.body)}
    </HashPackConfirmContext.Provider>
  );
}

export function useHashPackConfirm(): HashPackConfirmContextValue {
  return useContext(HashPackConfirmContext);
}
