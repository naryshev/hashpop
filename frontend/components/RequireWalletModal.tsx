"use client";

import { useEffect } from "react";
import { useHashpackWallet } from "../lib/hashpackWallet";
import { SignInCard } from "./ui/SignInCard";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Optional title shown above the sign-in card (e.g. "Sign in to make an offer"). */
  title?: string;
  /** Fired once the user successfully connects from inside the modal. */
  onConnected?: () => void;
};

/**
 * Reusable popup that prompts the user to sign in with HashPack before
 * proceeding with a gated action (Buy, Offer, etc.). Auto-closes on connect
 * and forwards the success to onConnected so the caller can resume the flow.
 */
export function RequireWalletModal({ open, onClose, title, onConnected }: Props) {
  const { isConnected } = useHashpackWallet();

  // Lock body scroll while the modal is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Auto-close once the wallet finishes connecting.
  useEffect(() => {
    if (!open) return;
    if (isConnected) {
      onConnected?.();
      onClose();
    }
  }, [open, isConnected, onConnected, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Sign in with HashPack"
    >
      <div className="relative w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-3 -right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-[#15181f] text-sm text-white shadow-lg hover:bg-white/10"
          aria-label="Close"
        >
          ×
        </button>
        {title && <p className="mb-3 text-center text-sm font-medium text-white/80">{title}</p>}
        <SignInCard />
      </div>
    </div>
  );
}
