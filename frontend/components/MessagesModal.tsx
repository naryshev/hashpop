"use client";

import { Suspense, useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { MessagesPageContent } from "./MessagesContent";

/**
 * Desktop messages overlay. Renders the full conversations experience inside
 * a centered modal so chatting never navigates away from the marketplace.
 */
export function MessagesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Messages"
      onClick={onClose}
    >
      <div
        className="relative flex h-[85vh] w-[min(1150px,94vw)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0b111b] shadow-[0_24px_64px_rgba(0,0,0,0.55)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close messages"
          className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white hover:bg-white/10"
        >
          <X size={18} />
        </button>
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center text-sm text-silver">
              Loading messages…
            </div>
          }
        >
          <MessagesPageContent embedded />
        </Suspense>
      </div>
    </div>,
    document.body,
  );
}
