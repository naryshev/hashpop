"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useHashpackWallet } from "./hashpackWallet";
import { SignInCard } from "../components/ui/SignInCard";

type OpenOptions = {
  /** Title rendered above the card (e.g. "Sign in to make an offer"). */
  title?: string;
  /** Fired exactly once when the wallet finishes connecting. */
  onConnected?: () => void;
};

type SignInModalContext = {
  openSignIn: (opts?: OpenOptions) => void;
  closeSignIn: () => void;
  isOpen: boolean;
};

const Ctx = createContext<SignInModalContext | null>(null);

/**
 * Site-wide HashPack sign-in popup. Provides a single modal that any component
 * can open via `useSignInModal().openSignIn()`. Replaces the dedicated /signin
 * page so gated actions resume in place instead of navigating away.
 */
export function SignInModalProvider({ children }: { children: React.ReactNode }) {
  const { isConnected } = useHashpackWallet();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState<string | undefined>(undefined);
  const onConnectedRef = useRef<(() => void) | undefined>(undefined);
  const wasOpenRef = useRef(false);

  const openSignIn = useCallback((opts?: OpenOptions) => {
    setTitle(opts?.title);
    onConnectedRef.current = opts?.onConnected;
    setOpen(true);
  }, []);

  const closeSignIn = useCallback(() => {
    setOpen(false);
    onConnectedRef.current = undefined;
  }, []);

  // Lock page scroll while the modal is open (html + body — some browsers
  // scroll the root element rather than body).
  useEffect(() => {
    if (!open) return;
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
    };
  }, [open]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSignIn();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeSignIn]);

  // Once the wallet connects while the modal is showing, fire onConnected and
  // close. Only fires for *new* connections inside this modal session.
  useEffect(() => {
    if (open) {
      wasOpenRef.current = true;
      return;
    }
    wasOpenRef.current = false;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!isConnected) return;
    const cb = onConnectedRef.current;
    closeSignIn();
    cb?.();
  }, [open, isConnected, closeSignIn]);

  const value = useMemo<SignInModalContext>(
    () => ({ openSignIn, closeSignIn, isOpen: open }),
    [openSignIn, closeSignIn, open],
  );

  // Portal target. Computed on the client only — server render returns null
  // since document doesn't exist there.
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setPortalTarget(typeof document !== "undefined" ? document.body : null);
  }, []);

  const modal =
    open && portalTarget
      ? createPortal(
          <div
            className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label="Sign in with HashPack"
            onClick={closeSignIn}
          >
            <div className="relative w-full max-w-md" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={closeSignIn}
                className="absolute top-2 right-3 z-10 text-lg font-medium leading-none text-white/60 hover:text-white"
                aria-label="Close"
              >
                ×
              </button>
              {title && (
                <p className="mb-3 text-center text-sm font-medium text-white/80">{title}</p>
              )}
              <SignInCard />
            </div>
          </div>,
          portalTarget,
        )
      : null;

  return (
    <Ctx.Provider value={value}>
      {children}
      {modal}
    </Ctx.Provider>
  );
}

export function useSignInModal(): SignInModalContext {
  const ctx = useContext(Ctx);
  if (!ctx) {
    // Soft fallback so components rendered outside the provider (e.g. during
    // some SSR paths or tests) don't crash — they just no-op when invoked.
    return {
      openSignIn: () => {},
      closeSignIn: () => {},
      isOpen: false,
    };
  }
  return ctx;
}
